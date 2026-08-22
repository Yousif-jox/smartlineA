# Practical Challenge — 10,000 Concurrent Driver Location Updates

**Day 4 practical challenge**
**Load:** 10,000 captains sending GPS every 5–10 s → **1,000–2,000 writes/s peak** (NFR-006). The PostgreSQL primary must not drown, and unrelated API latency must not degrade (NFR-001).

---

## The design

```
Captain App -> POST /api/v1/locations  (batched: 5-20 points per request)
            -> API instance (any of 2..n)
            -> validate + normalize (tenant = captain's company)
            -> PUSH to Redis Stream "location.ingest"   (fast, no DB touch)
            -> respond 202 Accepted

Ingestion workers (horizontal pool):
            -> XREADGROUP batch from the stream (e.g., 500 msgs/batch)
            -> batch INSERT into current_location (100-500 rows/statement)
            -> update Redis current-location cache (per captain, TTL 15 s)

Read path (live dashboards, Task 48-style):
            -> GET /captains/{id}/location  -> Redis cache (O(1), fresh)
            -> cache miss -> DB row (fallback)

History: NOT stored here (out of scope O5) — only the current location +
a rolling 7-day window in a separate partitioned table for replay/debug.
```

## Why this survives the load

| Risk | Mitigation |
|---|---|
| 2,000 single-row INSERTs/s on the primary | **batch INSERT** via stream workers (100–500 rows per statement) → ~4–20 statements/s, trivial for PostgreSQL |
| API latency (NFR-001) | the API only validates + pushes to Redis — **zero DB writes on the request path**; response is 202 in ~ms |
| Reconnect burst (10,000 captains × ~25 buffered points = 250k messages) | the stream absorbs it; workers drain at their own rate; per-captain rate limit raised for the captain role (Task 54) |
| Reads overwhelming the DB | current-location reads served from Redis (fresh TTL) — and unlike the wallet, location staleness is acceptable by design |
| Stream memory growth | workers consume with acknowledgment (XACK) + retention policy (e.g., 1M messages / 1 hour) |

## Decisions & edge cases

- **202 Accepted + async:** the captain app doesn't wait for persistence — acknowledged the moment it's queued; the worker batch makes durability near-real-time (≤ 1 s).
- **Exactly-once is NOT required** for location (idempotent by nature — the latest point wins); the stream's per-captain key keeps ordering.
- **Dead captain / deactivated account:** ingest validates captain status at the API (cheap) + the worker drops rows for soft-deleted captains (Task 41) with an alert.
- **Tenant correctness:** every ingested point carries `company_id` from the token (Task 53); the current-location cache keys are tenant-prefixed (Task 48).

## Handoff

Day 6 (Task 88) benchmarks this path and identifies the first component to fail at higher load; Day 5 implements the stream + workers (Task 72 area).
