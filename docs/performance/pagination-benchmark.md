# Pagination Benchmark (Day 6, Task 86)

## What is measured

`GET /api/v1/employees/:id/trips` uses **keyset (cursor) pagination**
(Task 42): the cursor is the last trip's id and the query continues from the
keyset tuple `(trip_date, start_time, id)`. The benchmark measures deep pages
on real data — the exact scenario where `OFFSET` collapses.

## Why keyset, not OFFSET

`OFFSET 100000` makes the database **scan and discard 100,000 rows before
returning 20** — linear in the page number. Keyset walks the index: each page
cost is O(log n) + page size, independent of how deep you are.

## How to run

```bash
psql "$DATABASE_URL" -v n=1000000 -f scripts/benchmark/generate-trips.sql
psql "$DATABASE_URL" -f scripts/benchmark/employee-trips-explain.sql   # includes the deep-page query
```

The script's third EXPLAIN block is the deep page (~500,000). Fill in results:

| Page | Query shape | Expected plan | Before (ms) | After (ms) |
|------|-------------|---------------|-------------|------------|
| 1 | `... LIMIT 21` | Index Scan + no Sort | `____` | `____` |
| ~100,000 | keyset `(date,time,id) > (...)` | Index Scan, walks index | `____` | `____` |
| ~500,000 | same | still Index Scan (no scan-to-skip) | `____` | `____` |

**Fail condition:** the deep-page plan shows a `Seq Scan` or a `Sort` — that
means the index (migration 007) is not being used (usually stale stats →
`ANALYZE trip;`).

## Edge-case tests already in the suite

`tests/integration/employee-trips.test.js` asserts: page 1 + cursor walks
forward **without overlap**, date-range filtering, cross-tenant employee →
404, missing employee → 404.

## Interview one-liner

> "Cursor pagination makes deep pages cheap by construction — the database
> walks the index from the last keyset, it never scans rows it will discard.
> The benchmark script measures page 1 vs page ~500,000 with EXPLAIN ANALYZE;
> the fail condition is a Seq Scan appearing on the deep page."
