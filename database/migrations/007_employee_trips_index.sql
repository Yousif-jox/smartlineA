-- ============================================================
-- Smart Line — Day 6, Task 85
-- Migration 007: the index that fixes the 4-second query
--
-- Endpoint: GET /employees/:id/trips (Task 85/86) — employee's trips for a
-- company, ordered by (trip_date, start_time).
--
-- Why the old index set was not enough: idx_trip_company_date is
-- (company_id, trip_date) — it serves the date filter, but ORDER BY
-- start_time forces a SORT of every matching row. At 20M rows that sort
-- (plus the join fan-out to trip_employee) is the ~4-second cost.
--
-- Fix: (company_id, trip_date, start_time) — the index satisfies the filter
-- AND the ORDER BY, so the planner returns rows in order with no sort node,
-- and the per-employee keyset cursor walks the index instead of scanning.
-- ============================================================

CREATE INDEX idx_trip_company_date_start
  ON trip (company_id, trip_date, start_time);

-- Supporting: the per-employee join (employee -> trips) is served by the
-- existing idx_trip_employee_lookup (employee_id, trip_id); the new triple
-- keeps the joined trip side in date order without a separate sort.
ANALYZE trip;
ANALYZE trip_employee;
