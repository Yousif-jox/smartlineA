# Day 5 — Implementation Summary (Task 75)

> Honest account of what was implemented, what was deferred, and why.
> Test evidence: **99/99 tests green** (45 Day-1 + 19 unit + 35 integration) against a **real PostgreSQL (Supabase)**.

## Implemented

| Task | Deliverable | Evidence |
|------|-------------|----------|
| 61 | Repo structure per Day-4 layering, useful README, `.gitignore`, `.env.example` (no secrets, no suspicious placeholders) | root files |
| 62 | Ordered, rollback-safe migrations (`npm run migrate` / `migrate:down`) — 001..005 incl. Task-35 constraints, Task-37 indexes, Day-3 EXCLUDE challenge; each with `.down.sql`; tracked in own `app_schema_migrations` table (Supabase owns `schema_migrations`) | `database/migrations/` |
| 63 | Layered skeleton (routes → services → repositories) + `GET /health` that touches the DB and degrades gracefully (503, no crash) | `src/server.js`, `src/routes/health.js`, `src/db.js` |
| 64 | JWT login/refresh/logout + RBAC middleware + bcrypt hashing + secrets from env + 3-role test coverage | `services/auth.service.js`, `middleware/auth.js`, `rbac.js`, `tests/unit/auth.test.js` (6), `tests/unit/rbac.test.js` (8) |
| 65 | Tenant-isolated CRUD (companies/branches/employees) with the Day-4 systemic IDOR fix on every endpoint — **404 not 403**, no existence oracle (NFR-009) | `middleware/tenant.js`, `services/employee.service.js`, `tests/integration/employees.test.js` (5) |
| 66 | Trip creation + status update enforcing the Task-25 state machine — 409 carrying `currentState`/`attemptedState` — plus a complete transition-matrix test suite | `state-machines/trip.js`, `services/trip.service.js`, `tests/unit/trip-state-machine.test.js` (5), `tests/integration/trips.test.js` (6) |
| 67 | `POST /trips/:id/assign` (capacity + captain overlap + state) with a **real concurrency test** proving double-booking is rejected in practice | `services/trip.service.js`, `tests/integration/assignments.test.js` (7) — the Day-5 gate test |
| 68 | Wallet transactions with `Idempotency-Key` (key reuse returns the original result; no negative balance; serial + concurrent tests) | `services/wallet.service.js`, `tests/integration/wallet.test.js` (5) |
| 69 | Attendance events (idempotent, out-of-order handled, respects Task-26 state machine, cancelled-trip rejected) | `services/attendance.service.js`, `tests/integration/attendance.test.js` (6) |
| 70 | Complaint lifecycle (submit → assign → escalate → resolve; resolved locked except Admin) | `state-machines/complaint.js`, `services/complaint.service.js`, `tests/integration/complaints.test.js` (5) |
| 71 | Unified error middleware — the Task-54 envelope verbatim, JSON logs with correlation id, no secrets / no stack traces in responses | `middleware/error.js`, `middleware/log.js`, `utils/http.js` |
| 72 | Redis-shared rate limiting (per-user + per-IP, 429 with `Retry-After`), with a graceful in-memory fallback when Redis is absent | `middleware/rate-limit.js` |
| 73 | Refactor round: extracted real duplications into shared, tested utilities with **no behavior change** (tests green before and after) | `utils/http.js`, `docs/refactoring-notes.md` |
| 74 | Git-hygiene guidance delivered: conventional commits only, local rebase, no force-push on shared branches; 2+ pushes during the day on `feature/day-5-implementation` (user performs the push) | action plan checklist |
| — | Practical challenge: full-lifecycle integration test against the real DB — create → assign to capacity → over-assign rejected → legal states to Completed → attendance with a duplicate event → wallet debited exactly once | `tests/integration/trip-lifecycle.test.js` |

## Deferred — and why (honestly)

1. **Live Redis rate limiting test.** The middleware is written against Redis with a shared counter and falls back to in-memory when `REDIS_URL` is absent; the fallback path is what the suite exercises. No Redis instance was available in this environment, so the shared-across-instances behavior is verified by design review, not by a live two-instance run. **Day-6 priority**: provision Redis and run the 429/Retry-After + cross-instance counter tests.
2. **Rate-limit numbers** (100 req/s per user, 50 per IP) are budget-derived from NFR-001 and were flagged on Day 4 as to-be-validated. They are config values, not hard-coded assumptions.
3. **OpenAPI specs for wallet / attendance / complaint endpoints** follow the documented "same pattern" of the trips spec (`docs/api/openapi-trips.yaml` is the contract reference). Full specs for the three new resources are a Day-6 candidate.
4. **WebSocket gateway implementation** (designed on Day 4) is not in the Day-5 task list; Day 5 scope is the core backend APIs. Realtime code lands when the task list requires it, on top of the already-signed-off channel topology.
5. **`.env` with real credentials** is intentionally not committed; the user fills it locally (`.env.example` documents exactly which variables).
6. **Rotating-refresh revocation sweep** (cleanup of expired refresh tokens) is a background job not required by any Day-5 task; the rotation itself (issue/verify/rotate/logout-revoke) is implemented and tested.

## Known trade-offs (documented, not hidden)

- `BIGINT` ids are parsed to JS `Number` (`src/db.js`) — safe while ids stay below 2^53; documented in code.
- Concurrency loser may observe `TRIP_ILLEGAL_STATE` or `TRIP_CONCURRENT_UPDATE` depending on timing — both are correct rejections; the test asserts exactly-one-wins, not the loser's code.
- Rate limiting fails open during a Redis outage (availability over abuse control) — documented risk from Day 4, with an alert and a per-instance fallback.
