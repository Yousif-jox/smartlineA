# Pagination Strategy — cursor over OFFSET

**Task:** Day 3 — Task 42
**Goal:** page through Trips at 20M+ rows with stable, index-backed navigation. The choice here becomes the API contract (Day 4, Task 51).

---

## The problem with OFFSET at page 100,000

`LIMIT 20 OFFSET 1,999,980` forces the planner to **scan and discard ~2M rows** before returning 20. Cost grows linearly with page depth:

```sql
-- page 100,000: OFFSET 1,999,980 -> ~2M rows scanned, then discarded
EXPLAIN (ANALYZE)
SELECT * FROM trip
WHERE company_id = $1
ORDER BY trip_date DESC, id DESC
LIMIT 20 OFFSET 1999980;
```

At 20M rows this is seconds — NFR-003 (≤ 500 ms) is violated by construction.

## The cursor (keyset) approach

```sql
-- next page: pass the last row's (trip_date, id) as the cursor
SELECT * FROM trip
WHERE company_id = $1
  AND (trip_date, id) < ($2, $3)          -- row-value comparison
ORDER BY trip_date DESC, id DESC
LIMIT 20;
```

- Cost is **O(page size)** regardless of depth — the index (`idx_trip_company_date` + id tie-breaker) locates the cursor in O(log n) and scans 20 rows.
- The API exposes `?cursor=<base64(trip_date|id)>`; the response carries the next cursor (Task 51).

## Stable ordering with a non-unique sort column

`trip_date` alone is not unique (many trips per day) → the sort must be **composite `(trip_date, id)`** so the total order is deterministic. The `id` tie-breaker makes the cursor safe even when many rows share the same date — no duplicates, no skips between pages.

## Measured contrast (to be proven on Day 6, Task 86)

| Page | OFFSET | Cursor |
|------|--------|--------|
| 1 | ~ms (index scan, small skip) | ~ms |
| 1,000 | ~tens of ms (20k skipped) | ~ms |
| 100,000 | **seconds** (2M+ skipped) | ~ms |

## When OFFSET is acceptable

- Admin exports with `LIMIT ≤ 10,000` — the skip cost is bounded and the payload is a one-shot export.
- The API itself never uses OFFSET for customer-facing lists.

## Decision (recorded for Day 4)

**Cursor pagination for all list endpoints** (`trips`, `attendance`, `complaints`), with `(trip_date, id)`-style composite cursors; OFFSET reserved for exports only.
