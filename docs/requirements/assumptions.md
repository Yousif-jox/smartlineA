# Stated Assumptions — Smart Line

**Task:** Day 1 — Task 03 (Requirements Engineering)
**Method:** 8 assumptions selected from the Task 02 clarification questions, each paired with the risk if the assumption turns out wrong. Every assumption is traceable to a design decision that will be validated on Day 3 (ERD) and Day 4 (multi-tenancy / RBAC).

---

| # | Assumption (proceeding as if…) | Source | Risk if the assumption is wrong | Traced to |
|---|--------------------------------|--------|--------------------------------|-----------|
| A1 | An employee belongs to exactly one branch (1:N, single `branch_id`); branch assignment is optional for new employees. | E1 | If multi-branch membership is required, Employee↔Branch becomes an N:M junction table; tenant-scoped queries and RBAC scope logic must be reworked. | ERD cardinality (Task 32), multi-tenancy (Task 36), RBAC (Task 52) |
| A2 | PickupLocation is a separate entity; an employee may have several, with exactly one default; per-trip override is not supported in v1. | E2 | If pickup location is 1:1, the entity is over-engineered; if per-trip override is needed, the TripEmployee assignment schema changes. | Entity extraction (Task 31), clustering (Task 11) |
| A3 | Pickup locations are company-scoped — never shared across companies. | E5 | If cross-company sharing is real (shared industrial gates), multi-tenant isolation and cross-tenant lookups must be redesigned. | Multi-tenancy (Task 36), IDOR fix (Task 53) |
| A4 | A trip serves employees of one branch only. | T1 | If multi-branch trips are common, Trip needs branch aggregation and Route↔Trip cardinality changes. | ERD (Task 32), assignment validation (Task 57) |
| A5 | A trip has exactly one vehicle for its full duration in v1 — no mid-trip vehicle change. | T2 | **Highest-risk assumption.** Operational reality (breakdowns) may force mid-trip reassignment, requiring a vehicle-history table and a state-machine change. Mitigation: vehicle identity is isolated inside the assignment layer so the change stays contained. | Trip state machine (Task 25), ERD (Task 32), capacity logic (Task 09) |
| A6 | Attendance is recorded only by the captain via the mobile app (single trusted writer). | T3 | If employees self-report too, anti-abuse rules and dual-writer conflict resolution are required. | Attendance state machine (Task 26), idempotent event handling (Task 13 / 69) |
| A7 | Charging model: flat per-trip fare, charged automatically on trip completion; the company pays. | W1 | If pricing is distance-based or subscription-based, or employees pay, the WalletTransaction schema and calculation service need rework. | Wallet idempotency (Task 39), wallet API (Task 58 / 68) |
| A8 | Wallet balance never goes negative; insufficient balance rejects the transaction. | W2 | If credit is a business requirement, the transactional guard changes and a credit-approval flow is needed. | Wallet constraint (Task 68), idempotency (Task 39) |

---

## Reconciliation of conflicting assumptions

- **A1 + A4 are mutually consistent:** one employee → one branch; one trip → one branch, so an employee can only be assigned to trips of their own branch. Cross-branch riding is treated as the documented "walk-on" edge case (Task 05) — a validation exception, not a schema feature.
- **A7 + A8 are treated together:** automatic charging at completion is only safe if combined with a non-negative balance guard and client-supplied idempotency keys.
- **A5 is deliberately the weakest assumption:** it is expected to be challenged by operations (breakdowns). All vehicle-related logic is kept behind the assignment layer so that if mid-trip reassignment is introduced later, the blast radius is limited to the Trip/Vehicle tables and the state machine. This is the assumption I am least confident about, and the first one I would revisit.

---

**Note for review:** these assumptions are intentionally visible to the reviewer rather than hidden; Day 3–4 tasks will confirm or correct each one (entity/ERD work on Day 3, multi-tenancy and RBAC on Day 4).
