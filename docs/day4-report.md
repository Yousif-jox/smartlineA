# Day 4 — Daily Report

## 1) What did I complete?

- **System architecture (Task 46):** hand-drawn + digitized diagram — 5 clients behind an HA load balancer, 2..n API instances, 2..n WebSocket gateways, PostgreSQL/Redis/MQ, acknowledged SPOFs (PostgreSQL mitigated by standby; Redis explicitly transport-only).
- **Layering (Task 47):** routes → services → repositories → DB; services own transactions; tenant middleware binds once; audit via triggers + correlation IDs.
- **Cache & queues (Tasks 48–49):** 3 cached endpoints with tenant-prefixed keys and write-through invalidation (wallet never cached); 3 async ops with at-least-once + idempotent consumers (effectively-once), message contract for Trip Cancelled, outbox pattern against event loss.
- **API design (Tasks 50–54):** `/api/v1` path versioning, resource map with nesting only where hierarchical, OpenAPI 3.0.3 spec for trips (cursor pagination, 409 with current/attempted states), JWT + rotating refresh, RBAC matrix (5×10), error envelope + Redis-shared rate limits.
- **IDOR fix (Task 53 — the flagship):** systemic — one tenant middleware + repository-level `company_id` binding everywhere + 404 semantics; the call-center exception is a narrow, audited role override in the same middleware.
- **Realtime (Task 55):** all gateways subscribe to the shared channel; eventId catch-up on reconnect; Redis-outage fallback to polling.
- **Business rules & challenge (Tasks 56–60 + challenge):** filter whitelist mapped to indexes, assignment check order (cheap→expensive) with primary-vs-defense distinction, wallet idempotency contract, API-flow diagram (hand-drawn + digitized), architecture sign-off with 4 documented open risks, and the 10,000-driver location-ingestion design (Redis stream + batch workers).

## 2) What did I fail to complete?

- Nothing content-wise. The handwritten photos for Tasks 46 and 59 were drafted as references and the digitized versions are in the repo; the final photographed sheets and the Day 4 push (`feature/day-4-architecture-api`) were still pending at report time.

## 3) What problems did I face?

- **Realtime reachability problem** (the design question itself): a client is connected to gateway A but the request landed on instance B — solved by all-gateways-subscribe + eventId catch-up, so no sticky sessions are required.
- **OpenAPI validity:** the trips spec was verified programmatically (valid 3.0.3, paths/schemas/security all parse) before being accepted as the Day 5 contract.
- **Filter combos without a supporting index** (Task 56): decided to accept them with bounds (LIMIT + tenant + no seq-scan at 20M) rather than reject — documented the trade-off instead of pretending they don't exist.

## 4) What decisions did I make?

- URL-path versioning over headers (explicit, cache-friendly, mobile-friendly).
- No company in trip/complaint paths — tenant always from the token (kills the IDOR class at the route-design level).
- Tenant-prefixed cache keys mirroring the DB tenant column.
- 404 (not 403) for cross-tenant — no existence oracle (NFR-009).
- Rate limiting fails open during Redis outage (availability over abuse control) — documented risk.
- Assignment checks ordered cheap→expensive; API = primary UX layer, DB constraints = the guarantee.
- Location ingestion: 202 + stream + batch workers; history out of scope, current-location cached.

## 5) What assumptions did I make?

- All A1–A9 carry forward. RBAC matrix assumes defaults for complaint categories/priorities until C1–C4 are answered (flagged).
- Realtime channels are tenant-namespaced (`trip.{tenantId}.{tripId}`) — the isolation assumption behind the biggest open risk.
- Rate-limit numbers (100 req/s per user, 50 per IP) are budget-derived from NFR-001 and will be validated on Day 6.

## 6) What would I improve?

- Spec the remaining endpoints (attendance, complaints, wallets) in OpenAPI before Day 5 instead of "same pattern applies" — reduces interpretation risk for the implementer.
- Render and eyeball every diagram at creation time (the architecture and API-flow diagrams were rendered at the end of the day).
- Write the handwritten sheets earlier — they were content-ready all day but photographed last.

## 7) What did I learn?

- **Systemic beats per-endpoint:** the IDOR fix has no per-route code at all — one middleware + repository binding removes an entire vulnerability class; per-endpoint fixes are how leaks survive.
- **Realtime across instances is an architecture decision, not a library feature:** the channel subscription topology (all gateways subscribe) is what makes delivery instance-agnostic — WebSocket libraries alone don't solve it.
- **Designing the failure branch first** (gateway death, Redis outage, worker crash, reconnect) makes the happy path almost trivial to specify — most of Task 55's value is in the `alt` blocks.
- **Documenting risks is part of the deliverable:** the 4 open risks in the sign-off are assets in the interview, not admissions.
