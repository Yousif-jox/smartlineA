# The 4-Second Query — Diagnosis and Fix (Day 6, Task 85)

## The reported incident

> `GET /employees/:companyId/trips` takes **4 seconds** at **20M rows**.

The endpoint did not exist on Day 5 (only the README's dashboard queries were
designed). Day 6 adds it — `GET /api/v1/employees/:id/trips`, tenant-scoped,
keyset-paginated (Task 42) — and fixes the performance class it belongs to.

## Root-cause analysis (before looking at the index)

The query is: employee's trips for a company, ordered by `(trip_date, start_time)`.

```
FROM trip_employee te JOIN trip t ON t.id = te.trip_id
WHERE te.employee_id = $1 AND t.company_id = $2
      AND t.trip_date BETWEEN $3 AND $4
ORDER BY t.trip_date, t.start_time
```

Three independent reasons it can cost ~4s at 20M rows — all three are real
with the Day-5 index set:

1. **ORDER BY not index-satisfied.** `idx_trip_company_date` is
   `(company_id, trip_date)` — it serves the filter, but `start_time` in the
   ORDER BY forces a **Sort node** over every matching row. Sorting a large
   company's week is the dominant cost.
2. **Join fan-out before filter.** If the planner joins `trip_employee`
   (millions of rows for popular employees) to `trip` and only then filters
   `company_id`/`trip_date`, it moves and discards millions of rows.
3. **Stale statistics.** `ANALYZE` was run at migration time (small seed).
   After loading 20M rows the planner still guesses the seed's cardinality →
   wrong join order, seq scans, `Rows Removed by Filter`.

## The fix

Migration `007_employee_trips_index.sql`:

```sql
CREATE INDEX idx_trip_company_date_start
  ON trip (company_id, trip_date, start_time);
```

- The triple **satisfies the filter and the ORDER BY** — the planner returns
  rows in order with **no Sort node**.
- The per-employee keyset predicate `(trip_date, start_time, id) > (…)`
  makes **deep pages O(log n)-ish** — it walks the index, it never scans to
  skip 100,000 pages (the OFFSET trap from Task 42).
- `ANALYZE` re-runs inside the migration so the planner sees fresh stats.

## Evidence — run it (no psql required)

Use the Node runner (same `DATABASE_URL` as `npm run migrate`) — and **do NOT
generate 20M rows on the production/shared Supabase DB**. Preferred: a local
Postgres in Docker (one command), or a small `n` on Supabase with cleanup.

```bash
# OPTION A — local Postgres (recommended, keeps Supabase clean)
docker run -d --name smartline-bench -e POSTGRES_PASSWORD=bench -p 5433:5432 postgres:16
export DATABASE_URL=postgres://postgres:bench@localhost:5433/postgres
npm run migrate                                   # applies 001..007 locally
node scripts/run-sql.js scripts/benchmark/generate-trips.sql --set n=1000000

# BEFORE the index (drop it, capture the plan):
node scripts/run-sql.js --exec "DROP INDEX IF EXISTS idx_trip_company_date_start;"
node scripts/run-sql.js scripts/benchmark/employee-trips-explain.sql

# AFTER the index:
node scripts/run-sql.js --exec "CREATE INDEX idx_trip_company_date_start ON trip (company_id, trip_date, start_time); ANALYZE trip; ANALYZE trip_employee;"
node scripts/run-sql.js scripts/benchmark/employee-trips-explain.sql

# cleanup: docker rm -f smartline-bench

# OPTION B — Supabase without polluting it: EXPLAIN (no ANALYZE) on existing data
node scripts/run-sql.js scripts/benchmark/employee-trips-explain.sql
# (still shows the plan shape; if you must measure on real data, generate with
#  a SMALL n and clean up: node scripts/run-sql.js --exec "DELETE FROM trip_employee WHERE trip_id > 1000; DELETE FROM trip WHERE id > 1000;")
```

Fill the numbers here after the run (honest reporting):

| Query | Before (ms) | After (ms) | Notes |
|-------|------------|------------|-------|
| employee trips, 1 week (page 1) | `____` | `____` | expect Sort node gone |
| company dashboard, 1 week | `____` | `____` | no regression |
| deep page (~100,000) | `____` | `____` | expect index walk, no scan |

**Success criteria:** the deep-page plan shows an Index Scan (no Seq Scan, no
Sort), and the dashboard query is no slower than before the index (migration
007 only ADDS an index — it cannot regress the other indexed queries).

## No-regression check (Task 85 requirement)

Migration 007 only creates one new index; all Day-3/5 indexes stay untouched.
The second EXPLAIN block in the script re-checks the FR-016 dashboard query —
the one the new index was designed to serve — and the existing
`idx_trip_captain_schedule` / `idx_trip_vehicle_schedule` paths are exercised
by the Day-5 integration suite (captain/vehicle conflict tests).

## Interview one-liner

> "The 4-second query had three root causes: an ORDER BY that no index
> satisfied, a join that filtered after fan-out, and stale planner stats after
> bulk load. The fix is one composite index that satisfies filter + order,
> keyset pagination so deep pages walk the index, and ANALYZE after load. The
> proof is EXPLAIN ANALYZE before/after — the Sort and Seq Scan nodes
> disappear, and the dashboard query doesn't regress."
