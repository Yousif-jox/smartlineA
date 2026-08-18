-- ============================================================
-- Smart Line — Day 3 challenge: exclusion test (Supabase / SQL Editor)
-- NON-DESTRUCTIVE version: everything runs inside BEGIN...ROLLBACK,
-- so no rows persist and Supabase shows no destructive-operation warning.
-- Expected output: 3 PASS notices + final count 0.
-- ============================================================

BEGIN;

-- Test 1: active captain double-booking MUST be rejected by the DB
DO $$
BEGIN
  BEGIN
    INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                      trip_date, start_time, end_time, state, stops_snapshot)
    VALUES (100, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Scheduled', '[]');
    RAISE EXCEPTION 'FAIL: captain double-booking was NOT rejected';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS 1: exclusion constraint rejected captain overlap';
  END;
END $$;

-- Test 2: overlapping CANCELLED trip MUST succeed (no reservation)
DO $$
BEGIN
  BEGIN
    INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                      trip_date, start_time, end_time, state, stops_snapshot)
    VALUES (101, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Cancelled', '[]');
    RAISE NOTICE 'PASS 2: cancelled trip does not reserve the captain';
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL: cancelled insert errored: %', SQLERRM;
  END;
END $$;

-- Test 3: vehicle double-booking MUST be rejected (FR-003)
DO $$
BEGIN
  BEGIN
    INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                      trip_date, start_time, end_time, state, stops_snapshot)
    VALUES (102, 1, 1, 1, 2, '2026-08-17', '07:00', '08:30', 'Scheduled', '[]');
    RAISE EXCEPTION 'FAIL: vehicle double-booking was NOT rejected';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS 3: exclusion constraint rejected vehicle overlap';
  END;
END $$;

-- Final check: zero ACTIVE overlapping trips for the same captain
-- (the test rows from this run are still visible inside the transaction;
--  the Cancelled row is excluded by the filter, so the result is 0)
SELECT count(*) AS violating_rows
FROM trip t1 JOIN trip t2 ON t1.captain_id = t2.captain_id
WHERE t1.id < t2.id
  AND t1.state NOT IN ('Cancelled', 'Failed')
  AND t2.state NOT IN ('Cancelled', 'Failed')
  AND t1.trip_date = t2.trip_date
  AND t1.start_time < t2.end_time
  AND t2.start_time < t1.end_time;

ROLLBACK;
-- EXPECTED: PASS 1, PASS 2, PASS 3, violating_rows = 0, then rollback
