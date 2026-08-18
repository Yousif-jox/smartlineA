# Capacity Allocation — best-fit vehicle selection

**Task:** Day 3 — Task 43
**Goal:** for a trip needing `N` seats, pick the **smallest available vehicle that fits** from the company pool — O(log n) with the right index, deterministic tie-break.

---

## The query

```sql
-- N = number of unique assigned employees (Task 9 semantics)
SELECT id
FROM vehicle
WHERE company_id = $1
  AND status = 'available'
  AND capacity >= $2
ORDER BY capacity ASC, id ASC      -- best-fit + tie-break by smallest id
LIMIT 1;
```

## Why it is O(log n)

`idx_vehicle_pool (company_id, status, capacity)` (migration 002, index 8) positions the scan in O(log n): the planner uses the index to seek the first `capacity >= N` row among `(company_id = $1, status = 'available')` — the ORDER BY `capacity ASC` walks the index in ascending capacity order, so `LIMIT 1` returns the best fit without sorting.

Tie-break `id ASC` makes the result **deterministic**: two vehicles with equal capacity always yield the same pick.

## Placement in the assignment flow (Task 38)

1. The trip's required seats = `COUNT(DISTINCT employee_id)` (Task 9).
2. Best-fit runs **inside** the trip-assignment transaction; the chosen vehicle is locked `FOR UPDATE` so two concurrent trips cannot both pick it.
3. The Day 3 challenge's exclusion constraint remains the final guard — if two trips somehow race past the lock, the DB rejects the overlap by definition.

## Edge cases

- **No vehicle fits** → returns no row → dispatch decision: create a new vehicle, split the trip, or reject the assignment (surfaced as a clear business error, not a silent fallback).
- **`capacity = 0` requested** (empty assignment) → no allocation needed; the query never runs for zero seats.
- **Duplicate employee IDs** → `COUNT(DISTINCT ...)` (Task 9 rule) — duplicates never inflate the seat count.
- **Unavailable vehicles** → excluded by `status = 'available'` — a vehicle under maintenance (scope O3 edge case) is structurally unassignable.

## Verification (Day 6 hook)

A benchmark on a seeded company pool (e.g., 50 vehicles, mixed capacities) asserting: correct smallest-fit pick, deterministic tie-break, and index-backed plan (EXPLAIN shows index scan, not seq scan).
