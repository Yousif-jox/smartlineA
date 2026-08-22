# Smart Line Assessment — Days 1–6

Smart Line is an employee-transportation management platform for companies.
This repository contains the 7-day engineering assessment work, built as **one
evolving system** — every day builds on the previous day's artifacts.

## Day 6 — Testing, Security & Performance (current)

The Day-5 backend is hardened and proven: **129/129 green locally**
(45 Day-1 + 84 unit) plus integration suites for tenant isolation, SQL
injection, wallet TOCTOU stress, RLS and employee-trips pagination running
against the real PostgreSQL (Supabase).

What Day 6 added:

- **Security fixes found by code review:** cross-tenant reference injection
  in trip/complaint creates (404, no existence oracle), the call-center dead
  end (conditional tenant filter), the nondeterministic login (`selectAccount`,
  deterministic lowest-id), and clean DB-error envelopes (no raw PG messages).
- **RLS (migration 006):** `ENABLE ROW LEVEL SECURITY` on all 20
  tenant-scoped tables, one policy per table, `SECURITY INVOKER` views, and a
  NOLOGIN proof role — fail-closed without the tenant context.
- **The 4-second query (migrations 007 + endpoint):** `GET /employees/:id/trips`
  with keyset pagination, fixed by the `(company_id, trip_date, start_time)`
  index; benchmark scripts + EXPLAIN ANALYZE before/after.
- **File-upload guard** (`src/utils/upload.js`): magic-byte sniffing, extension
  whitelist, size cap, safe filenames — reusable + unit-tested.
- **Docs:** `docs/security/*`, `docs/debugging/*` (the two root causes),
  `docs/performance/*`, `docs/day6-report.md`, `docs/day6-signoff.md`,
  `day6-interview-prep.md`.

```bash
# 1) install
npm install

# 2) configure — copy .env.example to .env and fill in real values
#    (DATABASE_URL = your Supabase connection string, JWT_SECRET = any long random string)
cp .env.example .env

# 3) apply migrations (rollback-safe: npm run migrate:down) — now includes 006 RLS + 007 index
npm run migrate

# 4) run the full test suite (129 unit/Day-1 + integration on your DB)
npm test

# 5) RLS proof
psql "$DATABASE_URL" -f tests/database/rls_policy_test.sql

# 6) start the API
npm start        # GET /health → { status: "ok", db: "up" }
```

## Days 1–5 (foundation)

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
- **Day 5 — Implementation:** the designed backend as production code —
  layered routes → services → repositories, JWT + RBAC, systemic tenant
  isolation (404 not 403), trip state machine (409), idempotent wallet
  transactions, attendance events, complaint lifecycle, unified error
  envelope, JSON logs, rate limiting — **99/99 green on real PostgreSQL**.

## Daily reports & interview prep

- `docs/dayN-report.md` — the 7-question daily report.
- `dayN-interview-prep.md` — ready interview answers (Arabic).

## Docs

- Handwritten planning sheets & photos: `docs/handwritten/`.
- Assessment walkthrough & action plan: `smart-line-7day-assessment-explained.md`,
  `smart-line-7day-action-plan.md`.
