# Multi-Tenancy at the Schema Level — Smart Line

**Task:** Day 3 — Task 36
**Principle:** tenant isolation is enforced **by the schema**, not by application discipline. A buggy query must not be able to cross company boundaries. (NFR-009: cross-tenant access returns 404 without confirming existence.)

---

## The rule

**Every tenant-scoped table carries `company_id BIGINT NOT NULL`** — either directly, or through a NOT NULL FK chain that cannot cross tenants. There is no tenant-scoped table without a company boundary at the database layer.

## Per-table enforcement

| Table | company_id | How |
|---|---|---|
| branch | direct NOT NULL | column |
| employee | direct NOT NULL | column |
| pickup_location | direct NOT NULL | column |
| captain | direct NOT NULL | column |
| vehicle | direct NOT NULL | column (A9: company fleet) |
| route | via branch_id NOT NULL | FK chain: route → branch → company |
| route_stop | via route_id NOT NULL | FK chain |
| trip | **direct NOT NULL** | column — deliberately denormalized onto trip so every trip query is filtered by one column, not a 3-hop join |
| trip_employee | via trip_id NOT NULL | FK chain |
| attendance | via trip_id NOT NULL | FK chain |
| attendance_event | via attendance_id NOT NULL | FK chain |
| wallet | direct NOT NULL + UNIQUE | 1:1 per company |
| wallet_transaction | via wallet_id NOT NULL | FK chain |
| complaint | direct NOT NULL | column (call center needs company-scoped queue) |
| notification | via recipient account | FK chain |
| audit_log | direct NOT NULL | column (tenant admin reads own audit) |
| **account** | **nullable** | documented exception: Admin and Call Center agents are platform-level (role-based, Task 52) |

## Why direct columns matter (trip example)

`trip.company_id` exists **in addition to** `route.branch_id` because:
1. Every trip query (manager dashboard, dispatch, conflict checks) filters by company — one column, no join, no chance of a wrong join crossing tenants.
2. Row-level security (RLS) policies in production bind to `trip.company_id` directly.
3. A join bug between trip and route cannot leak data — the direct column is the single gate.

## Application-level checks are NOT the mechanism

- The application's tenant middleware (Day 4, Task 53) is the **first line**, but the DB must still reject cross-tenant writes/reads by construction (NOT NULL + FK chains + RLS in production).
- Defense in depth: app middleware (404 semantics) + DB constraints (structure) + RLS (runtime policy) — three independent layers.

## Cross-tenant queries are impossible by construction

```sql
-- Correct: every tenant-scoped read binds company_id
SELECT * FROM trip WHERE company_id = $1 AND trip_date = $2;

-- RLS (production): the policy binds the session tenant
CREATE POLICY tenant_isolation ON trip
  USING (company_id = current_setting('app.company_id')::bigint);
```

## Documented exceptions (narrow, audited)

1. **Call Center Agent** cross-company lookup — read-only, via verified keys only, fully audited (Day 2 interview answer; Task 52/53 reconcile the RBAC).
2. **Admin** — platform-level visibility (no company bound).
3. **account.company_id nullable** — the schema enabler for (1) and (2); every cross-tenant read is recorded in `audit_log`.
