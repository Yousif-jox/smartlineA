# Transaction Boundaries — Trip Assignment (anti-overbooking)

**Task:** Day 3 — Task 38
**Problem (from the Morning Brief):** two requests assign the same captain (or exceed vehicle capacity) concurrently — both pass the application check, then both commit → double-booking. This is a TOCTOU race (check-then-act).

**Rule:** the application's double-check is a *convenience*, never the *guarantee*. The guarantee lives in the database.

---

## The transaction (PostgreSQL)

```sql
BEGIN;

-- 1. Serialize on the guardian row (captain or vehicle)
SELECT id FROM captain WHERE id = $1 AND status = 'active' FOR UPDATE;

-- 2. Overlap check against the captain's existing trips (index 1)
SELECT 1 FROM trip
WHERE captain_id = $1
  AND state IN ('Scheduled', 'Assigned', 'Started', 'In Progress')   -- cancelled/failed don't reserve time
  AND trip_date = $2
  AND start_time < $4   -- proposed end
  AND end_time   > $3   -- proposed start
LIMIT 1;

-- 3. Capacity check against the vehicle (Task 9 semantics, unique employees)
SELECT v.capacity, COUNT(DISTINCT te.employee_id) AS assigned
FROM vehicle v
LEFT JOIN trip_employee te ON te.trip_id = $5
WHERE v.id = $6
GROUP BY v.capacity;

-- 4. Insert the assignment
INSERT INTO trip_employee (trip_id, employee_id) VALUES ($5, $7);

COMMIT;
```

## Why this works

1. **`SELECT ... FOR UPDATE` on the guardian row** serializes concurrent assignment attempts for the same captain/vehicle — the second transaction blocks until the first commits, then re-reads the fresh state. The check in step 2/3 sees the first transaction's commit.
2. **Isolation level:** `READ COMMITTED` (default) is sufficient *because* the FOR UPDATE lock turns the check-then-act into a serialized critical section. `SERIALIZABLE` is not needed and costs throughput.
3. **Canceled/failed trips excluded** (step 2): they don't reserve the captain's time — consistent with the Day 2 scheduling-rule model (overlap with Cancelled is allowed).

## Defense in depth (three layers)

| Layer | Mechanism | Fails safe when |
|---|---|---|
| 1 — Application (Day 5, Task 67) | validation + friendly error codes | nothing — it's the UX layer |
| 2 — Transaction + FOR UPDATE (this doc) | serialized critical section | app has a bug — DB still serializes |
| 3 — Exclusion constraint (Day 3 challenge) | `EXCLUDE USING gist` on (captain_id, tsrange) | transaction logic has a gap — DB rejects by definition |

Layer 3 is the answer to the Morning Brief's "double-booked captain" — see the practical challenge.

## Edge cases

- **Same captain, two trips, adjacent times:** allowed (boundary rule, Task 10) — the overlap predicate is strict (`start < end`).
- **Vehicle capacity at the boundary:** `COUNT(DISTINCT employee_id)` matches Task 9's unique-count semantics; duplicates never inflate capacity.
- **Rollback:** any failed step rolls back the whole transaction — no partial assignment records (FR-009 integrity).
