# Real-Time Across Instances — WebSocket + Redis Pub/Sub

**Task:** Day 4 — Task 55 (Expert)
**The problem:** a client is connected to Gateway A, but the API instance that processed the status update is instance B. How does the event reach the client?

**The answer:** the client's connection lives on **one** gateway, so the event must reach *that* gateway — the clean solution is that **all gateways subscribe to a shared channel** (Redis Pub/Sub), and the gateway holding the connection pushes.

---

## The flow

```
Captain App -> API instance B: PATCH /trips/5/status {Started}
API B validates (DB) -> 200
API B publishes to Redis channel  "trip.5.status"   {tripId, state, ts, eventId}
ALL gateways (A, B, ...) are subscribed
Gateway A (which holds the manager's socket) receives -> pushes to the client
```

- **No instance-local state is required for correctness** (NFR-005): publishing and subscribing are decoupled by the channel; any instance can publish, any gateway can deliver.
- **No sticky sessions needed** — the WS upgrade goes through the load balancer to any gateway; delivery works because all gateways see the channel.

## Reconnect & catch-up (the failure branch from Task 23)

1. Each event carries a monotonic `eventId` (per trip).
2. The client tracks the last `eventId` it acknowledged.
3. On reconnect (to **any** gateway — even a different one): the client sends `{tripId, lastEventId}`; the gateway replays missed events from a short-lived per-trip buffer, then falls back to a DB read for older events.
4. The dashboard converges to the true state within one poll/read — no missed updates (NFR-002).

## Redis outage (NFR-008 — no data loss, no stale state)

- Gateway buffers undelivered events per client (bounded, with a watermark); if the buffer overflows, the watermark advances and the client catches up on reconnect.
- Dashboards fall back to **polling the API** (DB-backed, never cache) — correctness first, freshness second.
- On Redis recovery: gateways resubscribe, replay buffered events, clients catch up on next poll. **Redis is transport only — losing all of it costs re-prime, never corruption.**

## Horizontal scale (the gate question)

| Concern | Mechanism |
|---|---|
| 2..n gateways | all subscribe to the same channels — delivery is instance-agnostic |
| Gateway dies mid-session | client reconnect (LB routes to another gateway) + catch-up replay |
| Fan-out storms | channel per trip (`trip.{id}.status`) + `eventId` dedup on the client |
| Rate limiting | shared Redis counters (Task 54) — same Redis instance, multi-instance counters |

## Consistency

- Reuses the Task 23 sequence design and the NFR-008 scenario walkthrough (Task 27).
- Publishes the same domain events queued for notifications (Task 49) — one event source, two consumers (realtime + async).
- Day 5 implements it as the WebSocket gateway + subscriber; Day 6 tests the multi-instance behavior (Task 90/96 hooks).
