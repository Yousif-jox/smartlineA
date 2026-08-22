-- ============================================================
-- Smart Line — Day 6, Task 85 — EXPLAIN ANALYZE before/after
-- Run this BEFORE migration 007 (or after dropping idx_trip_company_date_start),
-- then re-run after applying migration 007. Paste both plans + timings into
-- docs/performance/slow-query-employee-trips.md.
--
--   psql "$DATABASE_URL" -f scripts/benchmark/employee-trips-explain.sql
-- ============================================================

-- ---- The endpoint query shape (employee 20's trips, one week) ----
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.id, t.trip_date, t.start_time, t.end_time, t.state
FROM trip_employee te
JOIN trip t ON t.id = te.trip_id
WHERE te.employee_id = 20
  AND t.company_id = 1
  AND t.trip_date BETWEEN date '2026-08-17' AND date '2026-08-23'
ORDER BY t.trip_date, t.start_time, t.id
LIMIT 21;

-- ---- The dashboard shape the endpoint must not regress (FR-016) ----
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.id, t.trip_date, t.state
FROM trip t
WHERE t.company_id = 1
  AND t.trip_date BETWEEN date '2026-08-17' AND date '2026-08-23'
ORDER BY t.trip_date, t.start_time
LIMIT 21;

-- ---- Deep-page keyset walk (page ~100,000) ----
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.id, t.trip_date, t.start_time, t.state
FROM trip_employee te
JOIN trip t ON t.id = te.trip_id
WHERE te.employee_id = 20
  AND t.company_id = 1
  AND (t.trip_date, t.start_time, t.id) >
      (SELECT trip_date, start_time, id FROM trip WHERE id = 500000)
ORDER BY t.trip_date, t.start_time, t.id
LIMIT 21;

-- What to look for (the 4-second root causes):
--   * Seq Scan on trip            -> the company filter has no usable index (or stale stats)
--   * Sort node                    -> ORDER BY not index-satisfied (needs (company_id, trip_date, start_time))
--   * "actual time=..."            -> before/after numbers for the signoff
--   * Rows Removed by Filter      -> wrong join order (filter on trip AFTER join fan-out)
--   * If the plan is still bad: ANALYZE trip; ANALYZE trip_employee; re-run.
