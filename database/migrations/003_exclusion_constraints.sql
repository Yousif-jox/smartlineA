-- ============================================================
-- Smart Line — Day 3, Practical Challenge
-- Migration 003: exclusion constraints (defense in depth)
--
-- The incident: 12 captains appeared in two overlapping trips
-- even though the application "assumed" it validated. The fix
-- must reject the double-booking AT THE DATABASE LAYER, so it
-- works even if the application code is buggy.
--
-- Requires: btree_gist extension (equality on captain_id/vehicle_id
-- inside the GiST exclusion index).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Captain: no two ACTIVE trips may overlap in time.
-- Cancelled/Failed trips do NOT reserve the captain (partial
-- exclusion constraint — consistent with the Day 2 scheduling model).
-- NOTE: tsrange (not tstzrange) — tstzrange(timestamp) depends on the
-- session timezone (STABLE, not IMMUTABLE) and PostgreSQL rejects it in
-- index expressions. All times are company-local by documented assumption,
-- so tsrange over (date + time) is semantically correct AND immutable.
ALTER TABLE trip ADD CONSTRAINT ex_captain_no_overlap
  EXCLUDE USING gist (
    captain_id WITH =,
    tsrange(trip_date + start_time, trip_date + end_time) WITH &&
  )
  WHERE (state <> 'Cancelled' AND state <> 'Failed');

-- Vehicle: the same guarantee (FR-003 — a vehicle cannot be in two
-- overlapping trips even with different captains).
ALTER TABLE trip ADD CONSTRAINT ex_vehicle_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tsrange(trip_date + start_time, trip_date + end_time) WITH &&
  )
  WHERE (state <> 'Cancelled' AND state <> 'Failed');

-- NOTE (deliberate): the employee-level overlap guard is NOT added
-- today — it is the Day 7 production incident (05) by design, so the
-- candidate must discover the gap themselves.
