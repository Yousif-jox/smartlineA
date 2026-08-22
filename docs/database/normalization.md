# Normalization & Deliberate Denormalization — Smart Line

**Task:** Day 3 — Task 34
**Rule:** 3NF as the baseline; **two deliberate denormalizations**, each justified by a query pattern and each with an explicit update strategy (no silent staleness).

---

## 3NF baseline

- All entities from `entities.md` are in 3NF: no partial dependencies (all PKs are single-column ids), no transitive dependencies (e.g., Employee has branch_id, not company_name; Trip has route_id, not the branch's name).
- All repeated data lives in junction tables (EmployeePickup, TripEmployee) or child tables (RouteStop, AttendanceEvent).

## Deliberate denormalization #1 — Trip.stops_snapshot (JSON)

**What:** the executed stop list is copied onto the Trip at creation time.

**Why (query pattern):** history immutability (Day 2 consistency finding 2): a route edit on Tuesday must never rewrite Monday's completed trips. Complaint/audit lookups read the snapshot, not the live Route.

**Update strategy:** written **once at trip creation** from the Route's stops; **never updated** (immutable). Guaranteed by: the application only populates it at insert, and there is no UPDATE path in the API for it. This is a denormalization that intentionally never refreshes — by design, not by accident.

## Deliberate denormalization #2 — Wallet.balance (cached aggregate)

**What:** the balance column is a running sum kept alongside the transactions ledger.

**Why (query pattern):** NFR-003 (reads ≤ 500 ms at scale) — every wallet read (manager dashboard, charge check) would otherwise SUM the whole ledger. The balance column makes reads O(1).

**Update strategy:** the balance is updated **in the same transaction** as the transaction insert, under a row lock (`SELECT ... FOR UPDATE` on the wallet row), with `CHECK (balance >= 0)` as the final guard (A8). Concurrency is safe: two parallel inserts serialize on the wallet row lock; a duplicate insert is blocked by the unique idempotency constraint (Task 39). No background job touches the balance — staleness is impossible by construction.

## Denormalizations considered and rejected

| Candidate | Rejected because |
|---|---|
| Captain name on Trip | a corrected captain name would diverge; join cost is small (NFR-003 has headroom) |
| Employee count on Trip | derivable from TripEmployee; maintaining it adds write complexity for little read gain |
| Company name on Branch | transitive dependency with zero query benefit |

## Acceptance summary

3NF baseline + 2 justified denormalizations, each with a concrete update strategy (immutable-once / transactional-with-lock) — the two accepted ones are exactly the two that Day 2's design decisions forced (snapshot history, O(1) wallet reads).
