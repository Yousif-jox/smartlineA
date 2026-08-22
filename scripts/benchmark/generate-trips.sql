-- ============================================================
-- Smart Line — Day 6, Task 85/86 — benchmark data generator
-- Generates N trips + trip_employee rows for the 4-second query repro.
-- Run with the Node runner (no psql needed) — prefer a LOCAL Postgres so the
-- shared Supabase DB is never polluted with millions of rows:
--   node scripts/run-sql.js scripts/benchmark/generate-trips.sql --set n=1000000
-- Default: 1,000,000 (enough to see the plan change; 20M on Supabase takes
-- minutes — run it, then EXPLAIN ANALYZE both ways).
-- The data is tagged with a comment marker so it can be removed after:
--   node scripts/run-sql.js --exec "DELETE FROM trip_employee WHERE trip_id > 1000; DELETE FROM trip WHERE id > 1000;"
-- (trips 1..10 are the seed; everything above is benchmark data)
-- ============================================================

\set n 1000000

BEGIN;

-- 1) One trip per (company, day, slot) — spread over 3 companies so the
--    company filter is selective, exactly like production.
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
SELECT gs,
       (gs % 3) + 1,                                    -- company 1..3
       (gs % 3) + 1,                                    -- route 1..3
       CASE WHEN gs % 5 = 0 THEN 5 ELSE (gs % 4) + 1 END,
       CASE WHEN gs % 5 = 0 THEN 5 ELSE (gs % 4) + 1 END,
       date '2026-08-01' + (gs / 96)::int,              -- ~96 trips/day
       make_time(6 + (gs % 12), (gs * 7) % 60, 0),      -- 06:00..17:59
       make_time(6 + (gs % 12), (gs * 7) % 60, 0) + interval '90 minutes',
       CASE gs % 7 WHEN 0 THEN 'Cancelled' WHEN 1 THEN 'Failed'
                   WHEN 2 THEN 'Completed' WHEN 3 THEN 'Scheduled'
                   WHEN 4 THEN 'Assigned'  WHEN 5 THEN 'Started'
                   ELSE 'In Progress' END,
       '[]'
FROM generate_series(11, :n) AS gs
ON CONFLICT (id) DO NOTHING;

-- 2) Assign 5..15 employees per trip (employees 1..50) — the fan-out that
--    made the old join scan expensive.
INSERT INTO trip_employee (trip_id, employee_id)
SELECT t.id, e.gs
FROM generate_series(11, :n) AS t(id)
CROSS JOIN LATERAL generate_series(1, 5 + (t.id % 11)) AS e(gs)
ON CONFLICT DO NOTHING;

-- 3) Fresh planner statistics — without ANALYZE the planner may still guess
--    wrong even with the new index (the classic "why is it still slow" trap).
ANALYZE trip;
ANALYZE trip_employee;

COMMIT;

\echo 'Generated :n benchmark trips (ids 11..:n)'
