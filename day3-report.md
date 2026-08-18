# Day 3 — Daily Report

## 1) What did I complete?

- **Entities & relationships (Tasks 31–32):** 19 entities, each justified by an FR/NFR; full cardinality map with the hardest relationship resolved (Employee ↔ Trip = N:M via TripEmployee — the assignment record is the single source of truth for attendance).
- **ERD (Task 33):** hand-drawn original, then the digitized version (19 entities, PK/FK, cardinalities).
- **Normalization (Task 34):** 3NF baseline + two deliberate denormalizations with explicit update strategies (Trip.stops_snapshot — immutable once; Wallet.balance — transactional with FOR UPDATE + CHECK ≥ 0).
- **DDL, tenancy, indexes (Tasks 35–37):** migration 001 (19 tables, CHECKs for both state machines, balance ≥ 0, explicit ON DELETE, UNIQUE idempotency keys), migration 002 (10 indexes each mapped to a query), multi-tenancy enforced by schema (company_id NOT NULL everywhere, direct column on trip).
- **Concurrency & wallet (Tasks 38–39):** trip-assignment transaction with `SELECT ... FOR UPDATE` serialization; wallet exactly-once via `UNIQUE (wallet_id, idempotency_key)` with a proof-by-example table.
- **Scale & ops (Tasks 40–43):** monthly range partitioning with FK implications, soft deletes via views + audit triggers, cursor pagination (vs OFFSET at page 100,000), best-fit vehicle allocation O(log n).
- **Seeds & summary (Tasks 44–45):** idempotent seed covering all 7 trip states and all 5 attendance states; database summary for Day 4.
- **Practical challenge:** EXCLUDE USING gist constraints (captain + vehicle) — verified on a real PostgreSQL (Supabase): the double-booking insert is rejected at the DB layer even when the application is bypassed.

## 2) What did I fail to complete?

- Nothing content-wise. Delivery items pending on my side: the final Git push for Day 3 (`feature/day-3-database`) and the handwritten planning sheet photo (the ERD photo is done; the planning sheet photo still needs to be committed).

## 3) What problems did I face?

- **`42P17` on migration 003:** `tstzrange(trip_date + start_time, ...)` was rejected — functions in index expressions must be IMMUTABLE, and timestamp→timestamptz conversion depends on the session timezone (STABLE). Fixed by switching to `tsrange` — semantically correct because all times are company-local by documented assumption, and immutable by construction.
- **Kroki ER rendering:** the diagram renderer rejected `boolean` and `UK` keywords in the ER syntax — worked around with equivalent types; verified the final PNG renders.
- **Supabase RLS prompt:** the SQL editor warned about tables without RLS — chose to enable RLS (aligned with the multi-tenancy design, owner role still bypasses it so seeds/tests ran normally).
- **Destructive-operation warning** on the test file (contains DELETE of a test row) — provided a fully non-destructive BEGIN/ROLLBACK version; the test ran clean.

## 4) What decisions did I make?

- **Employee ↔ Trip = direct N:M junction** (not route-derived): attendance validation (FR-010) binds to the assignment record; open question E3 stays answerable without schema change.
- **Vehicles are company-scoped** (A9): no branch_id on vehicle; pool queries are company-wide; V3 effectively answered "yes".
- **trip.company_id direct column**: one gate for tenant filtering and future RLS, instead of a 3-hop join.
- **wallet_transaction → trip FK dropped** (partitioning impact): financial records don't block trip archival; integrity enforced in the application.
- **Partial indexes**: default pickup (one per employee) and phone-uniqueness-when-active — smaller, faster, same semantics.
- **Cursor pagination for all lists; OFFSET only for exports** — the API contract for Day 4.
- **RLS enabled now** (Supabase) rather than deferred — defense in depth from day one.

## 5) What assumptions did I make?

- A1–A9 carry forward (A9 added this cycle: vehicles = company fleet). A5 (one vehicle per trip) remains the least-confident assumption.
- All times are company-local timezone (basis for the tsrange choice).
- V2 resolved to the minimum attribute set (id, capacity, company_id, status, plate, type).
- Employee-level overlap guard deliberately NOT added today — it is the Day 7 incident by design.

## 6) What would I improve?

- Test the exclusion-constraint SQL on a real database **before** finalizing the migration file — the tstzrange issue would have been caught in minutes instead of during the verification run.
- Render the ERD incrementally (small test first) instead of debugging the full diagram at once.
- Write the handwritten planning sheet photo earlier in the day (rule 3).

## 7) What did I learn?

- **IMMUTABLE matters**: any function in an index expression must be provably session-independent — `tsrange` over `date + time` is the right tool when the domain stores local time.
- **Defense in depth is provable**: the challenge test bypasses the application entirely and the DB still rejects — that is the difference between "the app checks" and "the schema guarantees".
- **Idempotent seeds are a contract**: running the same file twice returning 0 new rows is the cheapest correctness proof in the whole schema.
- **RLS early beats RLS late**: enabling it during migration costs nothing (owner bypasses) and removes an entire class of misconfiguration later.
