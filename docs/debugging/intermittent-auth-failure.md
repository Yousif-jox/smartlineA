# The Intermittent Authorization Failure — Root Cause & Fix (Day 6, Task 90)

## The reported symptom

A login that **sometimes** authenticates the wrong account / authorization
that **sometimes** fails, with no code change between the working and failing
cases. Intermittent = data- and timing-dependent, not random.

## Root cause: nondeterministic account selection in `login`

`src/services/auth.service.js` (Day 5) resolved the login lookup with:

```sql
SELECT a.* FROM account a
  JOIN employee e ON e.phone = $1 AND e.company_id = a.company_id
  WHERE a.role = 'employee' AND e.status = 'active'
UNION
SELECT * FROM account WHERE name = $1 AND role <> 'employee'
```

…and took `rows[0]` **with no `ORDER BY`**. PostgreSQL makes **no ordering
promise** for a `UNION` without `ORDER BY` — the same query can return rows in
different orders between runs (parallel workers, hash vs. sort plan, cache
state). Therefore:

- if **two accounts share a name** (e.g., two call-center accounts named
  "Call Center 1" — entirely possible in production),
- or an **employee phone equals a staff account name**,

`rows[0]` is whichever row the planner happened to return first → login
authenticates a *different* account depending on run timing. The failure is
intermittent because it depends on row order, which depends on the query plan,
which changes with load and statistics.

## Why "intermittent" (the interview answer)

A wrong-account login only happens when (a) the data actually contains a
collision **and** (b) the planner returns the colliding row first. With the
seed data (unique names) it never fires — which is exactly why it survived
Day 5's tests. In production with real names/phones, (a) is guaranteed
eventually, and (b) flips with the plan → "sometimes works, sometimes not,
no code changed."

## The fix (deterministic)

1. The SQL now ends with `ORDER BY id` — deterministic order.
2. The selection moved into a **pure, unit-tested function**
   `selectAccount(rows)`: lowest `id` wins, input never mutated.
3. `tests/unit/day6/login-determinism.test.js` proves it: shuffled duplicate
   rows always pick the same account, empty input → null, string BIGINT ids
   handled.

(Additional hardening, documented in `docs/api/authn-authz.md`: enforce a
unique `name` for non-employee accounts in production data; the code no
longer *depends* on it.)

## The second authorization gap found in the same review

The **call-center role** passed RBAC (`complaint.handle` = true) but every
complaint operation 404'd: `req.tenant` is `null` for call-center accounts,
and the repository filtered `WHERE company_id = NULL` → no rows. Fixed in
Day 6: the complaint repository makes the company filter **conditional** —
tenant-scoped actors always get it (404 on cross-tenant), tenant-less actors
(call center/admin, the documented Task-52 exception) look up by id only.

Regression proof: `tests/integration/tenant-isolation.test.js` — the
call-center escalate on a company-1 complaint succeeds; the same call with a
tenant-1 token on a company-2 complaint is a 404.

## Interview one-liner

> "The auth failure was nondeterministic because `UNION` without `ORDER BY`
> doesn't promise row order — with colliding names or phones, `rows[0]` picked
> a different account per query plan, so the bug only fired in production
> data under load. The fix is an explicit deterministic selection (lowest id,
> pure function, unit-tested). I also found the call-center dead end — RBAC
> said yes, the query said 404 — and made the tenant filter conditional."
