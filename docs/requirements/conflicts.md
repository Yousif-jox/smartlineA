# Requirement Conflict Analysis — Smart Line

**Task:** Day 1 — Task 07 (Requirements Engineering)
**Method:** Three real conflicts between requirements written so far; each with a chosen resolution and its explicit trade-off. Resolutions are technically feasible, not wishful.

---

## Conflict 1 — Real-time attendance updates vs reliable operation in low-connectivity zones

**The conflict:** The Product Owner wants real-time attendance visibility on manager dashboards (NFR-02), but the captain's mobile app must work reliably in industrial zones with weak or intermittent connectivity.

**Resolution — offline-first with idempotent sync:**
The captain's app records attendance events locally with client-generated event IDs while offline, and syncs them to the server when connectivity returns. The server deduplicates by event ID (the same logic as Task 13), so re-syncs and duplicates are harmless. The dashboard shows a "pending sync" state for events not yet confirmed.

**Trade-off:** Attendance freshness can lag behind network recovery (no strict real-time guarantee in low-connectivity zones), and the ingestion path must implement idempotent event handling — added complexity accepted in exchange for reliability.

## Conflict 2 — Strong wallet consistency vs low latency

**The conflict:** Wallet operations demand exactly-once semantics and no negative balance (NFR-11), which implies transactional writes with uniqueness constraints and locking; but the API also targets low p95 latency (NFR-01), and retried requests must not create duplicates.

**Resolution — constraint-based financial path, cached reads elsewhere:**
Wallet writes are served transactionally with a database-level unique constraint on the client-supplied idempotency key (+ wallet) and a balance CHECK — the latency cost is accepted on the wallet path only. All non-financial reads may use caching; wallet balance is never served from stale cache.

**Trade-off:** Higher latency and more lock contention on the wallet endpoint under concurrency; in exchange, financial correctness is guaranteed at the database layer and does not depend on application discipline alone.

## Conflict 3 — Strict multi-tenant isolation vs call center's cross-company lookup

**The conflict:** Tenant isolation demands that no query ever return another company's data (NFR-09), but a Call Center Agent must legitimately look up employees/companies of *any* company (a caller's company is not always known in advance).

**Resolution — audited role-based exception:**
Cross-tenant read access exists as an explicit, read-only, audited capability of the Call Center Agent role, enforced by the shared authorization middleware (the same tenant-scoping mechanism from the IDOR fix, with a documented role override) — never by ad-hoc per-endpoint checks. Every cross-tenant read is logged.

**Trade-off:** A narrow, monitored exception surface exists inside the isolation model (requires audit and monitoring); in exchange, a single support team can serve any company without shared privileged accounts, and the isolation mechanism stays systemic rather than exception-riddled.

---

## Edge Cases Addressed

- **Offline attendance captured later must sync without duplicates:** solved in Conflict 1 by client-generated event IDs + server-side deduplication (Task 13 semantics).
- **"Pending sync" UI state** avoids reporting stale attendance as confirmed.

## Acceptance Summary

Three genuine, domain-specific conflicts, each with a technically feasible resolution and an explicitly stated trade-off — ready to be defended in the end-of-day interview and reused in Day 2's SRS (NFR reconciliation).
