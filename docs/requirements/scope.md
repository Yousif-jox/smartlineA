# Scope Boundary — Smart Line

**Task:** Day 1 — Task 08 (Requirements Engineering)
**Purpose:** Draw a clear in-scope / out-of-scope line for this assessment's system, with a justification for every exclusion. Out-of-scope items are acknowledged as future work — not ignored.

---

## In Scope (delivered this week)

| # | Item | Justification |
|---|------|---------------|
| S1 | Core transportation operations: companies, branches, employees, captains, vehicles, routes, trips, assignment, attendance | The heart of Smart Line's business; every other feature depends on it. |
| S2 | Trip lifecycle management with legal state transitions (Scheduled → Assigned → Started → In Progress → Completed/Cancelled/Failed) | Dispatch incidents were caused by an unclear state model — precision here is load-bearing. |
| S3 | Wallet with exactly-once, idempotent transactions (charge on trip completion, non-negative balance) | Financial correctness is non-negotiable; duplicate charges are a critical failure class. |
| S4 | Complaint lifecycle with call-center workflow (submit, assign, escalate, resolve) | A stated requirement of the business domain (Task 01 entities). |
| S5 | Real-time trip status to dashboards across multiple API instances (WebSocket + pub/sub) | Core to the manager dashboard experience (Morning Brief, Day 4). |
| S6 | Multi-tenant isolation and role-based access control (tenant-scoped data, IDOR prevention) | A single cross-tenant leak is a critical incident; security is a first-class scope item. |
| S7 | Notifications on trip events (async queue, idempotent delivery) | Employees must be informed of cancellations/changes without blocking API responses. |

## Out of Scope (explicitly excluded — future work)

| # | Item | Justification for exclusion |
|---|------|----------------------------|
| O1 | Route optimization AI (auto-suggesting optimal routes) | Nice-to-have raised during requirements phase; requires ML/combinatorial investment not needed for v1. Routes are manager-defined. |
| O2 | Driver payroll / captain payments | A separate finance domain (salaries, shifts, taxes) unrelated to trip execution; would double the financial surface. |
| O3 | Full vehicle maintenance management module (service history, parts, scheduling) | Heavy asset-management domain. **However**, a minimal "vehicle status: available/unavailable" flag stays in scope (see Edge Case below) because assigning a broken vehicle breaks data integrity. |
| O4 | Employee HR management (hiring, contracts, leave, payroll) | Smart Line transports employees; it does not employ them. Only transportation-relevant attributes are modeled. |
| O5 | GPS location history storage and replay analytics | The system stores *current* location for live dashboards; long-term trajectory analytics is a separate analytics product (noted for Day 4's ingestion design). |
| O6 | Company billing/invoicing (PDF invoices, financial statements) | Wallet transactions are in scope; generating formal billing documents for companies is a future finance feature. |

## Edge Case — the borderline feature

**Vehicle maintenance status:** At first glance "maintenance" belongs out of scope (O3), but a vehicle under maintenance must **not** be assignable to trips — otherwise capacity checks validate against a broken vehicle and trip execution fails mid-route. Resolution: the **minimal vehicle availability flag** (`available`/`unavailable`) is in scope as a data-integrity measure (feeds Task 9's capacity validation), while the full maintenance module stays out of scope.

## Acceptance Summary

Seven in-scope items and six explicitly out-of-scope items, each with a stated justification; exclusions acknowledged as future work; the borderline maintenance case resolved as a minimal in-scope integrity field. Defensible under questioning in the end-of-day interview.
