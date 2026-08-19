# Caching Strategy — Smart Line

**Task:** Day 4 — Task 48
**Rule:** every cache entry has an explicit invalidation path — TTL is a backstop, never the mechanism. **The wallet is never served from cache** (NFR-008 clause + FR-013).

---

## The three cached endpoints

| Endpoint | Key structure | TTL | Invalidation |
|---|---|---|---|
| `GET /companies/:id/branches` | `{companyId}:branches:v1` | 5 min | DELETE key on branch create/update/soft-delete (Task 41) |
| `GET /trips?date=...` (manager dashboard list) | `{companyId}:trips:{date}:v1` | 30 s | DELETE on trip create/status-change for that date |
| `GET /employees/:id` (profile) | `{companyId}:employees:{id}:v1` | 10 min | DELETE on employee update; also on branch reassignment (A1) |

All keys are **tenant-prefixed** (companyId) — a cache key can never collide across tenants, mirroring the DB tenant boundary (Task 36).

## Invalidation policy (the part reviewers probe)

1. **Write-through invalidation:** every write path DELETEs the affected keys *inside the same request* (after DB commit). Cache and DB never drift by TTL alone.
2. **Never TTL-only:** TTLs exist for crash-safety (a missed DELETE), not correctness.
3. **Race handling:** if a DELETE races an in-flight read, the read may serve one stale value for ≤ TTL — accepted and bounded; the Day 6 test (Task 87) verifies the window.
4. **Wallet is excluded by design:** balance reads always hit PostgreSQL (denormalized `balance` column, Task 34 — O(1) anyway). Serving a stale balance is a financial correctness violation (FR-013), so caching it buys nothing and risks everything.

## Failure modes

- **Redis down (NFR-008):** cache-aside reads fall back to PostgreSQL automatically — correctness first, freshness second; no data loss (Redis is never the source of truth, Task 46 note).
- **Stampede (thundering herd):** 5,000 RPS on a cold key — mitigated by a short random jitter on TTLs and a per-key revalidate lock (single-flight) for expensive reads.

## Consistency references

- Multi-tenant keys ↔ Task 36 (tenant column), Task 53 (tenant middleware).
- Invalidation lists ↔ Day 3 write paths (branch/employee/trip mutations).
- Wallet exclusion ↔ FR-013 / NFR-008 / Task 39.
