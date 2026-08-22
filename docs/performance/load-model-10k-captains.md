# Load Model — 10,000 Captains (Day 6, Task 88)

## The scenario

10,000 captains each with a phone app that pings the API. Estimate the load,
find the **first component to fail**, and design against the failure — with
numbers, not adjectives.

## 1) The numbers

Assume a captain app: 1 status/attendance event per minute while active,
plus 1 location ping per 10s while on duty. Worst case (all on duty):

- **Location pings:** 10,000 × 6/min = **60,000 req/min = 1,000 req/s**
- **Events (status/attendance):** 10,000 × 1/min ≈ **167 req/s**
- **Total ≈ 1,167 req/s** sustained, bursty (shift start/end peaks ×3–5)

The Day-5 rate limiter is 100 req/s per user / 50 per IP — a captain app
pings 6/min per endpoint, so per-user limits are not the bottleneck. The
**aggregate** is.

## 2) Where each component breaks (in order)

| # | Component | Capacity at 1,200 req/s | First failure |
|---|-----------|------------------------|---------------|
| 1 | **Node API (single instance)** | ~1–3k req/s simple JSON; ~300–600 req/s with DB round-trips | **FIRST to fail** — event loop saturation, connection pool exhaustion |
| 2 | **PostgreSQL connection pool (max 20)** | 20 concurrent queries × ~5–10 ms each ≈ 2,000–4,000 q/s *if* queries are indexed and short | second — pool wait time grows after API saturates |
| 3 | **Redis rate-limiter** | single-threaded, ~100k ops/s | not the bottleneck at this scale |
| 4 | **PostgreSQL CPU/IO** | 1,167 req/s × 2–3 queries each ≈ 3k q/s — fine if indexed; the 4-second query class would kill it | only if queries regress |

**First component to fail = the single API instance.** The fix is
horizontal: the Day-4 architecture mandates ≥2 instances behind a load
balancer. 2 instances × 600 req/s covers the sustained rate with headroom.

## 3) The second-order failure: reconnection storm

When the API instance dies (or the DB pool drains), every captain app holds
a dead socket. On recovery they **all retry at once** → the reconnect burst
can exceed the DB's max_connections (Supabase pooler: ~60–200).

Defenses (Day-4 design, `docs/architecture/queueing-strategy.md` +
`realtime-multi-instance.md`):
- **exponential backoff + jitter** on the client (0.5s × 2^n + rand) — the
  single most important fix,
- **connection limits + queueing** at the pooler (never unbounded),
- rate limiter fails **open** on Redis outage (availability first, Task 54) —
  documented trade-off, not an accident.

## 4) Which metric to watch

1. **API p99 latency** (alert > 500ms) — the canary; everything else follows.
2. **DB pool wait time** (alert > 50ms avg) — the second domino.
3. **Failed/reconnecting sockets** on the gateway — the storm warning.

## Interview one-liner

> "10,000 captains at 1 ping/10s ≈ 1,200 req/s sustained. The first component
> to fail is the single API instance — the fix is horizontal scaling, which
> the architecture already mandates. The nastier failure is the reconnect
> storm when that instance dies: the client must back off exponentially with
> jitter, and the pooler must queue, not explode."
