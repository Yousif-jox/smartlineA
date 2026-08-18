-- ============================================================
-- Smart Line — Day 3 Practical Challenge: exclusion test
-- Run AFTER migration 003 and seeds 001, against a real PostgreSQL:
--   psql -d smartline -f tests/database/double_booking_test.sql
-- Expected: the first INSERT FAILS (constraint), the second SUCCEEDS,
-- and the final check returns no violating rows.
-- ============================================================

\set ON_ERROR_STOP off
\echo '=== Test 1: double-booking an ACTIVE captain must FAIL at the DB layer ==='
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES (100, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Scheduled', '[]');
\echo '>>> EXPECTED ABOVE: ERROR violating exclusion constraint ex_captain_no_overlap'

\echo ''
\echo '=== Test 2: overlapping CANCELLED trip must SUCCEED (no reservation) ==='
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES (101, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Cancelled', '[]');
\echo '>>> EXPECTED ABOVE: INSERT 0 1'

\echo ''
\echo '=== Test 3: vehicle double-booking must FAIL (FR-003) ==='
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES (102, 1, 1, 1, 2, '2026-08-17', '07:00', '08:30', 'Scheduled', '[]');
\echo '>>> EXPECTED ABOVE: ERROR violating exclusion constraint ex_vehicle_no_overlap'

\echo ''
\echo '=== Cleanup: remove the allowed Cancelled row ==='
DELETE FROM trip WHERE id = 101;

\echo ''
\echo '=== Final check: no ACTIVE overlapping trips for captain 1 ==='
SELECT count(*) AS violating_rows
FROM trip t1 JOIN trip t2 ON t1.captain_id = t2.captain_id
WHERE t1.id < t2.id
  AND t1.state NOT IN ('Cancelled', 'Failed')
  AND t2.state NOT IN ('Cancelled', 'Failed')
  AND t1.trip_date = t2.trip_date
  AND t1.start_time < t2.end_time
  AND t2.start_time < t1.end_time;
\echo '>>> EXPECTED: 0'
