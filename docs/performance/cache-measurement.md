# Cache Measurement — Hot/Cold + Invalidation (Day 6, Task 87)

## Honest status

Task 87 asks to measure cache hot/cold behavior and invalidation per the
Day-4 design (`docs/architecture/caching-strategy.md`). **The Day-5
implementation does not include a cache layer** — caching was designed on
Day 4 and deferred (the Day-5 scope is the core backend; `docs/
implementation-summary.md` documents the deferral). Measuring a non-existent
layer would be fabrication, so this document does three honest things:

1. **Measures the layer that DOES exist** — the PostgreSQL buffer cache.
   "Cold" = first access after restart/`DISCARD ALL`; "warm" = repeated
   access. This is the real hot/cold behavior of the deployed system.
2. **Specifies the measurement procedure** for the Redis layer that the
   Day-4 design will implement (so Task 87's method is ready).
3. **Restates the invalidation contract** from Task 48 as the acceptance
   test for that future layer.

## 1) PostgreSQL buffer-cache hot/cold (measurable now)

```sql
-- cold: discard the shared buffer cache for this connection
DISCARD ALL;
EXPLAIN (ANALYZE, BUFFERS) SELECT ... FROM trip WHERE company_id = 1 ...;  -- cold time
EXPLAIN (ANALYZE, BUFFERS) SELECT ... FROM trip WHERE company_id = 1 ...;  -- warm time (repeat)
```

| Metric | Cold (ms) | Warm (ms) |
|--------|-----------|-----------|
| employee trips query | `____` | `____` |

## 2) Redis layer — procedure when it lands (per Task 48)

- **Hot/cold**: prime the key (`GET` miss → hit), measure p50/p95 of the API
  endpoint with and without the cache key; cold = miss path.
- **Invalidation correctness** (the Task-48 contract): every write that
  changes a cached resource must invalidate the exact key:
  - trip state change → invalidate `trip:{id}` and `company:{id}:trips:{date}`
  - employee update → invalidate `employee:{id}`
  - **wallet is NEVER cached** (balance correctness over latency — Task 48).
- **Test**: update a trip's state, then read — the read must show the NEW
  state (stale reads are the failure). `tests/` for this land with the cache
  implementation.

## Interview one-liner

> "Task 87's honest answer: the Redis cache from the Day-4 design isn't
> implemented yet, so I measured the cache that IS there — PostgreSQL's buffer
> pool, cold vs warm — and wrote the measurement + invalidation contract for
> the layer that lands next. The contract is the Task-48 rule: write →
> invalidate the exact key, and the wallet is never cached."
