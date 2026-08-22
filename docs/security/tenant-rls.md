# Tenant Isolation at the Database Layer — RLS (Day 6, Task 79)

## Why a second layer at all

Day 5 proved the app-layer isolation (middleware binds the tenant once, every
repository query carries `company_id`, a miss is a 404 — NFR-009). But the app
layer can only protect the *app's own* queries. It cannot protect:

- a future query written by a teammate that forgets the filter,
- direct SQL access by analysts / support tooling,
- credentials that leak (the DB becomes readable *through* the leak),
- a buggy stored procedure or migration.

The Day-4 architecture signed off **RLS as the independent last layer** —
"even a buggy query can't cross tenants." Migration `006_rls.sql` implements
it.

## What the migration does

1. **`app_company_id()`** — reads `current_setting('app.company_id', true)`;
   unset/empty → `NULL` → every policy comparison is `NULL` → **fail closed**
   (zero rows), never fail open.
2. **`ENABLE ROW LEVEL SECURITY`** on all 20 tenant-scoped tables (incl.
   junction tables that have no `company_id` column — their policies resolve
   through the parent, e.g. `trip_employee` → `trip.company_id`).
3. **One policy per table** (`tenant_isolation_<table>`): `USING` for reads,
   `WITH CHECK` for writes — same tenant predicate.
4. **Views become `SECURITY INVOKER`** (`active_employee/captain/vehicle`) —
   without this, a view owned by the (bypass) table owner would *defeat* RLS
   for any caller who can read the view. Now the underlying RLS applies to the
   calling role.
5. **`smartline_rls_test`** — a `NOLOGIN` role with `SELECT` grants only,
   used by the proof script via `SET ROLE` (see below).

## The honest operational model

On Supabase the application connects as `postgres`, which is `BYPASSRLS` —
**RLS does not constrain the app itself**; the app's explicit filters remain
the first line. RLS constrains *every other* access path: leaked credentials,
analyst roles, ad-hoc SQL, future buggy code under a limited role. This is
documented here and in `implementation-summary.md` rather than claimed as
"the app is protected by RLS".

## Proof (run against the real database)

No `psql` needed — the Node runner uses the same DATABASE_URL:

```bash
node scripts/run-sql.js tests/database/rls_policy_test.sql
```

(or paste the file into the Supabase SQL Editor). The script
`SET ROLE smartline_rls_test` (a real non-bypass role) and asserts
**data-relative invariants** — the RLS-limited view must EQUAL the explicit
`company_id` filter, never a hard-coded count, so leftover test data can't
break the proof:

| Step | Query | Expected |
|------|-------|----------|
| no config | `SELECT count(*) FROM employee` | **0** (fail closed) |
| no config | `SELECT count(*) FROM trip` | **0** |
| config = 1 | `rls_count` vs `filter_count (company_id=1)` | **equal** (the invariant), and `> 0` |
| config = 1 | `SELECT count(*) FROM employee WHERE company_id = 2` | **0** (cross-tenant blocked) |
| config = 1 | `junction_count` vs `trip_employee ⋈ trip(company 1)` | **equal** (junction via parent) |
| config = 1 | `view_count (active_employee)` vs `filter_count` | **equal** (view guarded too) |
| config = 2 | `rls_count` vs `filter_count (company_id=2)` | **equal** |

## Removing the layer makes the proof fail

This is the Day-6 verification ritual: run the proof, then `DROP POLICY
tenant_isolation_employee ON employee`, re-run — the cross-tenant count is no
longer 0 — then re-apply the migration. The proof is tied to the policies, so
a regression in the migration is caught.

## Interview one-liner

> "The app layer proves isolation for the app. RLS proves it for *everyone* —
> a non-bypass role sees zero rows without the tenant context and only its own
> company's rows with it. The proof runs as a real limited role via SET ROLE,
> and if you drop the policy, the proof fails."
