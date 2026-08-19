# Day 4 — Architecture & API Summary (sign-off)

**Task:** Day 4 — Task 60
**Status:** signed off for Day 5 implementation, with 2+ open risks documented (not hidden).

---

## What was designed

| Area | Decisions (files) |
|---|---|
| System architecture | 2..n API instances + 2..n WebSocket gateways behind an HA LB; PostgreSQL source of truth; Redis cache+Pub/Sub; MQ + workers (`system-architecture.puml`) |
| Layering | routes → services → repositories → DB; services own transactions (`backend-layering.md`) |
| Cache | 3 endpoints, tenant-prefixed keys, write-through invalidation, wallet never cached (`caching-strategy.md`) |
| Queue | 3 async ops, at-least-once + idempotent consumers, outbox for reliability (`queueing-strategy.md`) |
| API contract | `/api/v1` path versioning; resource map; OpenAPI 3.0.3 for trips (`resources.md`, `openapi-trips.yaml`) |
| Security | JWT + rotating refresh; RBAC 5×10; **systemic IDOR fix** (one middleware + repository-level tenant binding + 404); error envelope; Redis-shared rate limits (`authn-authz.md`, `security/idor-fix.md`, `error-and-rate-limit-contract.md`) |
| Realtime | all gateways subscribe; eventId catch-up; Redis-outage fallback (`realtime-multi-instance.md`) |
| Business rules | assignment check order + primary-vs-defense distinction; wallet idempotency contract (`business-rules/*.md`) |

## Open risks (deliberately documented)

1. **Realtime channel isolation:** gateways subscribe to all trip channels; a mis-scoped subscription could cross tenants. Mitigation: WS upgrade authenticates and binds a tenant; channel names are tenant-namespaced (`trip.{tenantId}.{tripId}`); Day 6 tests a malicious cross-tenant subscription (Task 79/96 hooks).
2. **Rate limiting fails open during Redis outage** (Task 54): availability wins over abuse control. Mitigation: alerts + a per-instance fallback counter that caps at a conservative floor; documented trade-off.
3. **RBAC matrix depends on open questions C1–C4** (complaint categories/priority/reopen): the matrix assumes defaults; flagged for PO answers.
4. **OpenAPI coverage:** only trips are specced today (Task 51); attendance/complaints/wallet specs follow the same patterns during Day 5.

## Handoff for Day 5 (read these first)

1. `docs/api/resources.md` + `openapi-trips.yaml` — the contract to implement
2. `docs/api/authn-authz.md` + `security/idor-fix.md` — auth + tenant middleware skeleton
3. `docs/api/business-rules/*.md` — exact service logic
4. `docs/architecture/realtime-multi-instance.md` — the WebSocket gateway
5. `docs/database/summary.md` — the schema everything binds to
