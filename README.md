# Smart Line Assessment — Days 1–5

Smart Line is an employee-transportation management platform for companies.
This repository contains the 7-day engineering assessment work, built as **one
evolving system** — every day builds on the previous day's artifacts.

## Day 5 — Implementation (current)

The backend designed on Days 3–4 is implemented as production code with a
**99/99 green test suite** (45 Day-1 + 19 unit + 35 integration) running
against a real PostgreSQL (Supabase).

```bash
# 1) install
npm install

# 2) configure — copy .env.example to .env and fill in real values
#    (DATABASE_URL = your Supabase connection string, JWT_SECRET = any long random string)
cp .env.example .env

# 3) apply migrations (rollback-safe: npm run migrate:down)
npm run migrate

# 4) run the full test suite
npm test

# 5) start the API
npm start        # GET /health → { status: "ok", db: "up" }
```

Key areas:

- `src/` — layered backend: routes → services → repositories; JWT auth +
  RBAC; systemic tenant isolation (404 for cross-tenant, no existence leak);
  trip state machine (409 with current/attempted states); idempotent wallet
  transactions; attendance events; complaint lifecycle; unified error
  envelope; JSON logs with correlation id; Redis-shared rate limiting with
  in-memory fallback.
- `database/migrations/` — 5 migrations with matching `.down.sql`
  (constraints, indexes, captain/vehicle EXCLUDE constraint, refresh tokens,
  soft deletes).
- `tests/` — `day1/` (45), `unit/` (19), `integration/` (35) — the
  integration suites run against your real DATABASE_URL and clean up after
  themselves.
- `docs/` — `implementation-summary.md`, `day5-report.md`, `refactoring-notes.md`.

## Days 1–4 (foundation)

- **Day 1 — Requirements & Problem Solving:** `docs/requirements/` (glossary,
  actors, 23 clarification questions, A1–A9 assumptions, FR-01–FR-12,
  NFR-01–NFR-12, conflicts, scope, baseline); `src/algorithms/day1/`
  (capacity, overlap, clustering, route ordering, attendance) + the
  trip-conflict-detector challenge; 45 unit tests.
- **Day 2 — SRS & UML:** `docs/srs/srs.md` (signed v1.0) +
  `traceability-matrix.md`; state machines for trips (7 states, 9 legal
  transitions) and attendance (5 states).
- **Day 3 — Database:** `docs/database/` — Chen-notation ERD, normalization,
  indexing strategy, multi-tenancy, capacity allocation, the
  double-booked-captain challenge (EXCLUDE constraint); verified migrations.
- **Day 4 — Architecture & API:** `docs/architecture/` — HA architecture,
  caching, queues + outbox, multi-instance realtime; `docs/api/` — OpenAPI
  spec, authn/authz, error contract, the systemic IDOR fix.

## Daily reports & interview prep

- `docs/dayN-report.md` — the 7-question daily report.
- `dayN-interview-prep.md` — ready interview answers (Arabic).

## Docs

- Handwritten planning sheets & photos: `docs/handwritten/`.
- Assessment walkthrough & action plan: `smart-line-7day-assessment-explained.md`,
  `smart-line-7day-action-plan.md`.
