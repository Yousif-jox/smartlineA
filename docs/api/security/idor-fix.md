# IDOR Fix — systemic tenant isolation (the flagship security task)

**Task:** Day 4 — Task 53 (Expert — the most explicitly flagged security scenario)
**Vulnerability class:** Insecure Direct Object Reference — `GET /employees/{employeeId}` verified only that the caller *is a manager*, not that the employee belongs to *their* company. A manager of tenant A could read tenant B's employees.

**This fix is SYSTEMIC, not a patch:** one mechanism, applied to every resource, with no per-endpoint ad-hoc checks left behind.

---

## Attack path (before)

```
Manager of company A (token: companyId=A)
  -> GET /employees/42            (42 belongs to company B)
  -> controller: "is this a manager? yes -> return employee 42"
  -> DATA LEAK (NFR-009 violated)
  (same flaw: /trips/.., /wallets/.., /complaints/.. — one endpoint fixed,
   the others still leak)
```

## The fix (after) — three layers, one mechanism

```
Request -> Auth middleware (verify JWT)
        -> TENANT MIDDLEWARE (the fix):
             tenant := token.companyId        (never from URL/body)
             context.tenant = tenant
        -> Controller (parse only)
        -> Service (business rules)
        -> Repository (ALWAYS filters by context.tenant)

Repository rule (enforced everywhere):
    WHERE company_id = :tenant      -- the column exists on every
                                     -- tenant-scoped table (Day 3, Task 36)
If no row matches tenant -> 404      -- identical to "not found":
                                     -- no existence confirmation (NFR-009)
```

**Why this is systemic:**
- The tenant binding happens **once** in middleware; every repository call receives it (layering, Task 47). An endpoint that forgets its own check still cannot leak — there is no path to the DB without the tenant filter.
- The 404-not-403 choice removes the oracle: an attacker can't distinguish "tenant B has no employee 42" from "employee 42 exists but is not yours" — both return the same response (NFR-009).
- It generalizes to **every** resource (employees, trips, wallets, complaints, attendance) with no per-resource code.

## The one documented exception

Call Center Agent cross-tenant lookup (Task 52) — enforced in the **same middleware** as a role-based, read-only, audited override for verified-key lookups only. The override is a narrow, named capability — not a tenant bypass; any other role gets standard tenant scoping.

## Before/after (interview answer in one line)

> Before: per-endpoint "am I a manager?" checks that leak. After: one middleware binds the tenant once, every repository query carries it, and a miss is a 404 — the leak class is structurally gone.

## Verification hooks

- Day 6 security suite (Task 79): for each of ≥4 tenant-scoped resources, an A-tenant token requesting a B-tenant ID → 404; the call-center positive case still works; removing the middleware makes the suite fail (regression-proof).
- RLS at the DB (Day 3) is the final independent layer: even a buggy query can't cross tenants.
