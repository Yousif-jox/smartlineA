# Backend Layering Strategy — Smart Line

**Task:** Day 4 — Task 47
**Rule:** `routes/controllers → services → repositories → database`. No business logic in controllers; no business rules in repositories; transactions owned by services.

---

## The four layers

| Layer | Responsibility | Explicitly NOT responsible for |
|---|---|---|
| **Routes/Controllers** | HTTP: parse request, call one service, map result to the API envelope (Task 54) | Business logic, validation decisions, transactions |
| **Services** | Business rules (capacity, overlap, state machine, wallet idempotency), **own the transaction boundaries** (Task 38/39), orchestrate repositories | SQL, HTTP details |
| **Repositories** | Data access: parameterized queries, tenant column binding, view-based soft-delete reads (Task 41) | Business decisions |
| **Database** | Constraints (CHECK, UNIQUE, EXCLUDE — Day 3), RLS | — |

## Example walkthrough — Assign Employee to Trip (FR-005..007)

```
Controller  : parse tripId + employeeId; call tripService.assign(tripId, employeeId)
Service     : BEGIN txn → tenant middleware already set context
              → validate trip state (Task 25 machine, FR-004)
              → capacity check via repository (Task 9 semantics, FR-006)
              → captain/employee overlap check (Task 10/38)
              → repository.insertAssignment()
              → COMMIT (on failure: ROLLBACK + typed error)
Repository  : INSERT INTO trip_employee ... WHERE company_id = :tenant
DB          : CHECKs + UNIQUE + EXCLUDE constraints as final guards
```

## Cross-cutting concerns (single implementation, applied everywhere)

- **Tenant middleware (Task 53):** extracts the tenant from the authenticated principal, binds it to the request context, and **injects it into every repository call** — controllers and services never derive the tenant from URLs or body params.
- **Auth middleware (Task 52):** JWT verification + RBAC role check before the controller.
- **Error middleware (Task 54):** maps service exceptions to the API envelope (422/403/404/409) — one place, no per-route error handling.
- **Audit (Task 41):** DB triggers for write audit (guaranteed) + service-level correlation IDs in structured logs (NFR-013).
- **Validation:** request schema validation at the controller boundary (reject before service logic).

## Why services own transactions

The Day 3 transaction patterns (FOR UPDATE serialization, wallet idempotency) are **multi-repository** operations: they must begin/commit/rollback as one unit. Repositories can't own that (they see one statement); controllers shouldn't (HTTP concerns). Services are the only layer with both the business context and the transaction scope.

## Consistency with Day 3

- Repositories read through the soft-delete views (Task 41) and bind `company_id` (Task 36).
- Services reuse the exact rule tables from Day 3 (`trip-assignment.md`, `wallet-idempotency.md`) — no re-derivation.
- This layering is the Day 5 implementation skeleton (Task 63).
