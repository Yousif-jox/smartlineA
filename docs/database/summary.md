# Day 3 — Database Summary & Handoff

**Task:** Day 3 — Task 45
**Purpose:** a single document Day 4 can start from without re-reading everything.

---

## What was built (19 tables)

| Group | Tables |
|---|---|
| Core tenant chain | company, branch, employee, pickup_location, employee_pickup (junction), captain, vehicle, route, route_stop |
| Execution chain | trip, trip_employee (junction), attendance, attendance_event |
| Financial chain | wallet, wallet_transaction |
| Support chain | complaint, account, notification, audit_log |

Migration 001 = DDL with CHECKs (trip 7 states / attendance 5 states / balance ≥ 0 / capacity ≥ 0), explicit ON DELETE, UNIQUE idempotency keys and event_id dedup. Migration 002 = 10 indexes, each mapped to a query.

## The two concurrency safety patterns (interview core)

1. **Trip assignment (Task 38):** `SELECT ... FOR UPDATE` on the guardian row serializes concurrent assignments → no double-booked captain, no capacity overflow. Defense in depth: app check (Day 5) → transaction lock (Day 3) → exclusion constraint (Day 3 challenge).
2. **Wallet exactly-once (Task 39):** `UNIQUE (wallet_id, idempotency_key)` + balance updated in the same transaction + `CHECK (balance >= 0)`. Retried/concurrent duplicates can never double-charge.

## Key design decisions carried forward

| Decision | Where | Why it matters on Day 4 |
|---|---|---|
| `trip.company_id` direct (not via joins) | multi-tenancy.md | API tenant middleware (Task 53) filters by this column — one gate |
| Vehicles are company-scoped (A9) | entities.md / 001 | no branch_id on vehicle; pool queries are company-wide |
| Cursor pagination for all lists | pagination-strategy.md | becomes the API contract (Task 51) — `?cursor=` |
| Soft deletes via views + triggers | soft-deletes-audit.md | API must read through active views; audit is automatic |
| Partitioning: month range; wallet FK dropped | scaling/partitioning.md | wallet API never joins trip for referential integrity |
| Idempotent seeds, all states covered | 001_sample_data.sql | Day 4/5 tests can use seeded data immediately |

## Numbers to quote

- **19 tables**, **10 indexes**, **2 concurrency patterns**, **2 denormalizations** (snapshot + balance), **1 partition key** (monthly), **1 partial index** (default pickup).
- Seed coverage: 3 companies, 5 branches, 50 employees, 5 captains, 5 vehicles, 3 routes, 10 trips covering **all 7 states**, attendance in all 5 states, 3 wallet charges with idempotency keys.

## Open items for Day 4

- RBAC matrix and tenant middleware build on `account.role` + `company_id` (Task 52/53).
- The exclusion constraint (challenge) ships as migration 003.
- Seeds must be verified idempotent on a real PostgreSQL (run twice, compare).
