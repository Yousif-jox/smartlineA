# Cross-Tenant Reference Injection — Found & Fixed (Day 6, Task 79)

## The bug (found by reading the Day-5 code, not by a scanner)

The Day-5 **read paths** were systemically isolated (middleware binds the
tenant, every repository query filters, a miss is a 404). The **write paths**
had a gap: `POST /trips` and `POST /complaints` accepted *reference ids*
(route/vehicle/captain, employee) **without verifying they belong to the
caller's tenant**.

### Trip create

```js
// BEFORE (Day 5): no ownership check at all
await repo.create(tenant, { routeId, vehicleId, captainId, ... });
```

A company-A manager could:
- create a trip that references company-B's captain/vehicle/route (data
  pollution across tenants — company B's captain now appears on company A's
  schedule),
- probe company-B's schedule through the conflict checks (`captainConflict`
  queries `trip` by captain_id with **no company filter** — a timing oracle),
- get an FK error (23503) whose raw message names company-B's tables.

### Complaint create

```js
// BEFORE: employeeId taken from the body with no tenant validation
repo.create(tenant, { employeeId, ... });
```

An employee (or manager) could file a complaint **attributed to any
employeeId in the system**, including another company's.

## The fix

1. **Trip create** — `trip.repo.ownsReferences(tenant, {routeId, vehicleId,
   captainId})` checks all three references against the tenant **in one
   query** (route resolves through `branch.company_id`); the service rejects
   with **404 NOT_FOUND** — identical to "not found", so the oracle stays
   closed. The check runs **before** the conflict queries.
2. **Complaint create** — `complaint.repo.employeeInTenant(tenant,
   employeeId)`; missing or cross-tenant → 404. Callers without a tenant
   cannot create (RBAC denies it anyway — belt and suspenders).
3. **Error envelope** — FK/unique/check/exclusion codes (`23503/23505/23514/
   23P01`) and the cast error `22P02` are mapped to clean envelopes; raw
   PostgreSQL messages never reach the client (NFR-010).

## Regression proof

`tests/integration/tenant-isolation.test.js`:

- create with company-2 references via tenant 1 → **404**
- create with a missing captain → **404** (same response as cross-tenant)
- complaint for a company-3 employee via tenant 1 → **404**
- the call-center positive case (tenant null, documented Task-52 exception)
  still works: complaint transitions succeed without a company filter

Removing the new checks makes these tests fail — the suite is the guard.

## Interview one-liner

> "The read paths were isolated; the write paths weren't — you could create a
> trip referencing another company's captain and probe their schedule. The fix
> validates every reference against the tenant in one query, returns 404 like
> a missing row, and the regression suite proves both the block and the
> call-center exception still work."
