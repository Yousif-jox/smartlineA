# SQL Injection Audit (Day 6, Task 81)

## Audit result

Every repository query was reviewed for string concatenation of user input.
**The codebase is fully parameterized** — no `pool.query` call concatenates
untrusted values into SQL text. The two spots that interpolate *identifiers*
are safe by construction:

| Location | What is interpolated | Why safe |
|----------|---------------------|----------|
| `employee.repo.js` `update()` | column names in `SET key = $n` | the key is filtered through a **whitelist** `['branch_id','name','phone','status']` |
| `trip.repo.js` `hasActiveConflict()` | `WHERE ${column} = $1` | `column` is only ever `'captain_id'` / `'vehicle_id'` — hardcoded by the two callers (`captainConflict`/`vehicleConflict`) |

All *values* (search text, filters, ids, idempotency keys, statuses) travel as
bound parameters (`$1, $2, …`) — PostgreSQL never interprets them as SQL.

## Regression tests (the proof)

`tests/integration/sql-injection.test.js` runs against the real database:

- `q = "'; DROP TABLE trips; --"` → returns a normal list, and `SELECT count(*) FROM trip` still works after.
- `branchId = "1) OR (1=1) --"` → **422 VALIDATION_ERROR** (bound parameter fails the bigint cast) — it never executes, never returns data.
- `status = "active' AND 1=(SELECT count(*) FROM pg_tables) --"` → zero rows, no boolean-blind oracle.
- `q = "x' UNION SELECT credentials_hash FROM account --"` → no `credentials_hash` can ever appear in a search result.

## The one hardening applied during the audit

`src/middleware/error.js` now maps the PG cast error `22P02` to a clean
**422 VALIDATION_ERROR** envelope (previously a raw 500). Injected non-numeric
fragments now surface as a controlled 422 instead of an internal error — and
the raw PG message (with table/constraint names) is never returned to the
client (NFR-010).

## Interview one-liner

> "There is no string-built SQL in this codebase — every value is a bound
> parameter, and the two identifier interpolations are whitelist-constrained.
> The regression tests prove it against the real DB with the classic payloads,
> including `'; DROP TABLE trips; --` — the table survives every time."
