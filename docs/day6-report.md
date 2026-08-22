# Day 6 — Daily Report (المهام 76–90)

## 1) What did I complete?

- **Planning (rule 1):** handwritten planning sheet drafted
  (`day6-planning-sheet-template.md` — attacker-perspective flow + test
  strategy per layer) + `docs/handwritten/day6-index.md`; photo pending.
- **Security fixes (Task 79/81/90):**
  - *Cross-tenant reference injection* — `trip.create` now verifies
    route/vehicle/captain belong to the tenant (404, one query) before any
    conflict check; `complaint.create` verifies the employee belongs to the
    tenant (404). Both indistinguishable from "not found" (NFR-009).
  - *Call-center dead end* — complaint repo tenant filter is now conditional:
    tenant-scoped actors always filtered (404 on cross-tenant); tenant-less
    actors (call center/admin, the documented exception) look up by id.
  - *Intermittent auth failure (Task 90)* — root cause: `UNION` without
    `ORDER BY` + `rows[0]` → nondeterministic account selection. Fix: `ORDER
    BY id` + pure `selectAccount()` (lowest id wins) + unit tests.
  - *Error envelope (NFR-010)* — `23503/23505/23514/23P01/22P02` mapped to
    clean envelopes; raw PostgreSQL messages (table/constraint names) never
    reach the client.
- **RLS (Task 79 flagship):** migration `006_rls.sql` — `app_company_id()`
  context helper, `ENABLE ROW LEVEL SECURITY` on all 20 tenant-scoped tables,
  one policy per table (junction tables resolve through the parent),
  `SECURITY INVOKER` on the read-boundary views, `smartline_rls_test` role;
  `006.down.sql`; proof script `tests/database/rls_policy_test.sql` +
  `tests/integration/rls.test.js` (fail-closed without config; company-1 only
  with config; cross-tenant 0; view guarded).
- **The 4-second query (Task 85/86):** added `GET /employees/:id/trips`
  (keyset pagination + date range), migration `007_employee_trips_index.sql`
  (`(company_id, trip_date, start_time)` — filter + ORDER BY satisfied),
  benchmark scripts (`generate-trips.sql`, `employee-trips-explain.sql`),
  `docs/performance/slow-query-employee-trips.md` with before/after tables
  for the user's real run.
- **Tests (76/77/78/80/83/84/81/89):** 65 new unit tests (capacity edges,
  full state-machine matrices, attendance order-independence, 12 auth
  negatives, 17 RBAC escalation denials, parseId boundaries + BIGINT
  precision guard, 9 file-upload guard cases, login determinism, DB-error
  envelope); integration suites for tenant isolation (4 resources, 2
  companies, call-center positive), a dedicated Day-6 assignment suite
  (cancelled-trip rejection, re-assign after removal, concurrent different
  employees, removal while Started — Task 77), SQLi regression, wallet TOCTOU
  stress, employee-trips pagination, RLS.
- **Upload guard (Task 84):** `src/utils/upload.js` — magic-byte sniffing,
  extension whitelist, size cap, safe filenames — reusable + unit-tested.
- **Docs:** `docs/security/*` (4), `docs/debugging/*` (2), `docs/performance/*`
  (4), plus this report and `day6-signoff.md`.

**Local evidence: 129/129 green** (45 Day-1 + 84 unit) — no DB required.
Integration suites (tenant isolation, SQLi, wallet stress, RLS, employee
trips) run against the real Supabase (`npm test`).

## 2) What did I fail to complete?

- **Live runs against the real database** — no `DATABASE_URL` in this
  environment. All integration suites are written and ready; the user runs
  them (and the EXPLAIN ANALYZE benchmark) on Supabase and records numbers in
  the docs (tables are prepared).
- **Handwritten sheet photo + git pushes** — the sheet is drafted; the photo
  and the `feature/day-6-testing-security-performance` push are the user's
  workflow steps (as on Day 5).
- **Redis live test** — deferred from Day 5; still no Redis instance here.
  Documented in the signoff as a known gap (fallback path tested).

## 3) What problems did I face?

- **Test expectations vs. algorithm semantics** (my own bug, caught by the
  suite): (a) Map preserves insertion order → the order-independence test
  compared ordered structures; fixed to compare sorted pairs. (b) String
  comparison `'new' > 'old'` is FALSE (`'n' < 'o'`) — my tie-break fixture
  expected the wrong winner; the code was right, I renamed the fixture ids.
  (c) `parseId('1e3')` is the exact integer 1000 — accepted by design;
  documented instead of asserted wrong.
- **`SET ROLE` / RLS nuance:** `postgres` (BYPASSRLS) is not constrained by
  RLS even with FORCE — the RLS proof therefore runs as a dedicated NOLOGIN
  role, and the operational model is documented honestly (RLS guards
  non-bypass paths, not the app's own superuser connection).
- **No upload endpoint exists** — Task 84 delivered as a reusable guard with
  unit tests instead of pretending an endpoint was measured.
- **Found: `migrate:down` silently skipped every rollback.** The runner
  derived `001_initial_schema.down.sql` from the up file, but the repo
  convention is `001.down.sql` — `existsSync` never matched, so rollback
  warned-and-skipped. Fixed the runner to derive the down name from the
  leading number (`scripts/migrate.js`). This is exactly the kind of silent
  operational bug a security/ops day is for.

## 4) What decisions did I make?

- **RLS without FORCE** — the app's superuser connection bypasses RLS anyway;
  FORCE adds risk for self-hosted setups without adding protection here. RLS
  is documented as the guard for every non-bypass access path, proven via the
  test role.
- **404 for cross-tenant references on CREATE** — same no-oracle semantics as
  reads: "not yours" and "doesn't exist" return the same response.
- **Deterministic login by lowest id** — simple, pure, unit-testable; unique
  names remain a data-quality recommendation, not a code dependency.
- **Benchmark numbers left honest** — before/after tables are filled by the
  user's real run; no fabricated timings in the docs.

## 5) What assumptions did I make?

- The 20M-row scenario models the manager dashboard + employee-trips query;
  the exact slow plan may differ on the user's data — the EXPLAIN script
  detects Seq Scan/Sort, the two real root causes.
- RLS policy semantics: junction tables resolve through parent `company_id`;
  `notification` resolves through the recipient account.
- RLS assertions are **data-relative** (RLS view == explicit company filter,
  never an absolute count) — the first version hardcoded seed counts
  (25/15/55) and broke on a shared Supabase DB with leftover test data; the
  invariant that matters is equality, so the tests were rewritten (this is
  also the honest fix when a stale employee existed in the database).

## 6) What would I improve?

- Provision a local PostgreSQL (container) so integration suites run without
  Supabase — the single biggest time saver for a security day.
- Provision Redis and add the cross-instance rate-limit test (Day-5 debt).
- Make `parseId` reject exponent forms for strictness (documented as
  harmless today).
- Add OpenAPI snippets for the new endpoint + RLS setup to the API docs.

## 7) What did I learn?

- **Write-path isolation is a separate bug class from read-path isolation** —
  reads were systemically fixed on Day 5, but creates accepted cross-tenant
  references. An isolation review must walk every INSERT/UPDATE with the same
  discipline as every SELECT.
- **"Intermittent" is a clue, not a shrug** — nondeterministic SQL ordering
  (`UNION` without `ORDER BY`) is a textbook intermittent-bug generator; the
  fix is to make the decision pure and testable.
- **RLS proof needs a non-bypass role** — testing RLS as the superuser proves
  nothing; `SET ROLE` to a limited role is the only honest proof.
- **The state machine is the tests' boss** — again: when my new tests
  disagreed with the machine, the machine was right (tie-break fixture).
- **Honest deferral beats fabricated evidence** — cache/Redis/benchmark
  numbers that don't exist are documented as such, with procedures to fill
  them, instead of invented timings.
