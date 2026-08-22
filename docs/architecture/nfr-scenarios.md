# NFR Scenario Walkthroughs

**Task:** Day 2 — Task 27
**Method:** two NFRs from Task 18 walked through the Task 23 sequence diagram, step by step, including failure modes.

---

## Scenario 1 — NFR-002: trip status reaches the dashboard within 2 s (P95)

**Walkthrough of the Task 23 sequence at normal load:**

| Step | Component hop | Budget |
|------|---------------|--------|
| 1 | Mobile app → API (request handling, auth) | ≤ 100 ms |
| 2 | API → PostgreSQL (state-machine validation, FR-004) | ≤ 50 ms |
| 3 | API → Redis Pub/Sub (publish) | ≤ 50 ms |
| 4 | Pub/Sub → WebSocket Gateway (delivery) | ≤ 50 ms |
| 5 | Gateway → Dashboard client (push + ack) | ≤ 100 ms |
| **Total** | | **≤ 350 ms ≪ 2 s** |

**Why it holds at scale:** at 5,000 RPS (NFR-001) the API layer scales to 2+ instances (NFR-005); the sequence never serializes on one component — the publisher (API) and the subscriber (Gateway) are decoupled by the channel, so the hop count is constant regardless of which instance handled the request. The 2 s budget has 5.7× headroom at P95.

**Degradation mode:** if pub/sub latency rises (Redis under stress), the budget still absorbs up to ~1.6 s of added latency before violating NFR-002. Beyond that, the fallback path of NFR-008 kicks in: the dashboard polls the API and converges within the next poll interval — correctness first, freshness second.

## Scenario 2 — NFR-008: a Redis outage causes no data loss and no incorrect state

**Walkthrough of what happens when Redis goes down mid-operation:**

1. **Publish fails:** the API instance cannot publish to Pub/Sub. The trip status is already **persisted in PostgreSQL** (step 2 of the sequence) — the DB remains the source of truth; nothing is lost.
2. **Gateway behavior:** the WebSocket Gateway buffers undelivered events per client (it was already designed for disconnected clients — Task 23 alt branch). Buffering is bounded; if the buffer overflows, the gateway drops events but records the watermark.
3. **Client behavior:** dashboards fall back to polling the API (status read from PostgreSQL). Convergence latency = poll interval; NFR-002 is temporarily violated but **correctness is never** — no stale state is shown as fresh because the poll reads the DB, not a cache.
4. **Wallet integrity:** the wallet path never touches the cache (NFR-008 clause + FR-013); a Redis outage cannot produce a duplicate or lost financial transaction.
5. **Recovery:** when Redis returns, the gateway reconnects, replays buffered events since the watermark, and clients catch up on their next poll. The system heals without manual intervention.

**Explicitly excluded failure:** Redis is not the source of truth for any state — it is a transport and cache only. If it loses all data, the only cost is re-prime, never corruption.

---

## What these scenarios prove

- NFR-002 and NFR-008 are **architecturally satisfied** by the Task 23 sequence (decoupled publisher/subscriber, DB as source of truth, fallback polling).
- The two NFRs **conflict slightly** (freshness vs resilience): the resolution is "correctness always, freshness degraded gracefully" — stated trade-off, consistent with `docs/requirements/conflicts.md`.
