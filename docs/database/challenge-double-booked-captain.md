# Practical Challenge — The Double-Booked Captain Incident

**Day 3 practical challenge**
**Symptom:** 12 captains appeared in two overlapping trips on the same day, even though the application "assumes" it validates overlaps.

---

## Root causes (all four — not just one)

1. **Application-only validation (TOCTOU):** the app checked overlaps *then* inserted — two concurrent requests both passed the check before either committed (the Day 1 challenge scenario, now with real writes).
2. **No database-level constraint:** nothing in the schema rejected two overlapping ACTIVE trips for the same captain — the DB accepted whatever the app wrote.
3. **Race under concurrency:** even with a corrected app check, check-then-act without a lock or constraint races by definition.
4. **Isolation misconfiguration:** default `READ COMMITTED` without any serialization mechanism lets both transactions see the same "no overlap" snapshot.

Any ONE of these is enough to produce the incident; all four were present.

## The safeguard (migration 003)

`EXCLUDE USING gist` constraints at the database layer — **the DB rejects the overlap by definition**, regardless of application correctness:

```sql
ALTER TABLE trip ADD CONSTRAINT ex_captain_no_overlap
  EXCLUDE USING gist (
    captain_id WITH =,
    tstzrange(trip_date + start_time, trip_date + end_time) WITH &&
  )
  WHERE (state <> 'Cancelled' AND state <> 'Failed');
```

Design points:
- **Partial constraint** (`WHERE state <> ...`): Cancelled/Failed trips don't reserve the captain — consistent with the Day 2 scheduling rule ("overlap with a Cancelled trip is allowed").
- **Vehicle constraint too** (`ex_vehicle_no_overlap`): the same guarantee for FR-003 (vehicle double-booking), with the same partial filter.
- **Defense in depth:** app validation (Day 5, Task 67) → transaction lock (Task 38) → exclusion constraint (this challenge) — three independent layers; this one works even if the other two fail.

## The proof — test at the database layer (`tests/database/double_booking_test.sql`)

The test **bypasses the application entirely** — it attempts the violating insert directly in SQL. If the DB rejects it, the guard holds even with buggy application code:

```sql
-- MUST FAIL: two ACTIVE trips, same captain, overlapping time
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES (100, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Scheduled', '[]');
-- -> ERROR: conflicting key value violates exclusion constraint ex_captain_no_overlap

-- MUST SUCCEED: same captain, overlapping time, but Cancelled (no reservation)
INSERT INTO trip (id, company_id, route_id, vehicle_id, captain_id,
                  trip_date, start_time, end_time, state, stops_snapshot)
VALUES (101, 1, 1, 1, 1, '2026-08-17', '07:00', '08:30', 'Cancelled', '[]');
```

The seed data (Task 44) is designed so this test runs against a realistic dataset (trips 1, 5, 9 share captain 1 on different days — no false conflicts; trip 3 is Cancelled).

## What this proves

- The Morning Brief's incident is **impossible by construction** after migration 003 — not "unlikely", impossible.
- The mechanism is consistent with the entire Day 1–3 design thread: Day 1 conflict detector → Day 2 scheduling rule → Day 3 constraint.
- Employee-level overlap is deliberately left open — the Day 7 incident (95) will require the same pattern at the employee level.
