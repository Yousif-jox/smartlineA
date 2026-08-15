# Clarification Questions — Smart Line

**Task:** Day 1 — Task 02 (Requirements Engineering)
**Audience:** Product Owner (non-technical)
**Convention:** Every question below is answerable with a single sentence by a non-technical stakeholder. Questions are deliberately domain-specific (no technology-stack questions).

---

## 1) Employees

| # | Question | Why the answer changes the design |
|---|----------|-----------------------------------|
| E1 | Can an employee belong to more than one branch at the same time? | Decides whether Employee↔Branch is a single foreign key (1:N) or a junction table (N:M), and how tenant-scoped queries and role scoping work. |
| E2 | Can an employee have more than one pickup location? | Decides whether pickup location is an embedded field on Employee or a separate entity (1:N) with a default, and whether per-trip pickup override is possible. |
| E3 | Can an employee ride a trip on a route that is not their default branch's route (temporary reassignment)? | Decides whether trip assignment is resolved through the default route or assigned directly, and whether the "walk-on" case is legal or an exception to reject. |
| E4 | When an employee is deactivated, what happens to their future scheduled trips? | Defines soft-delete semantics and whether future assignments must be auto-cancelled or left untouched. |
| E5 | Can two different companies share the same pickup point (e.g. an industrial zone gate)? | Decides whether PickupLocation is company-scoped or shared master data — a direct input to the multi-tenant isolation design. |

## 2) Trips

| # | Question | Why the answer changes the design |
|---|----------|-----------------------------------|
| T1 | Can a single trip carry employees from more than one branch? | Decides whether a Trip is bound to exactly one branch (via Route) or can span branches, changing ERD cardinality and dispatch queries. |
| T2 | Can a trip's vehicle change mid-route, or is one vehicle fixed for the whole trip? | Decides Vehicle↔Trip cardinality (1:1 vs 1:N with history) and whether the Trip state machine needs an additional state. |
| T3 | Who records attendance as "boarded" — the captain, the employee, or both? | Decides the trusted event source for the attendance state machine and the duplicate-event (idempotency) design. |
| T4 | Can one route be executed as more than one trip in parallel (two vehicles on the same day)? | Decides whether "trip" means a single vehicle-run, affecting capacity checks, the conflict detector, and the ERD. |
| T5 | What is the cancellation policy: who can cancel, until when, and what happens to already-recorded attendance and wallet charges? | Defines the legal Trip state transitions and the reversal/refund logic in the wallet. |
| T6 | Are trips created on demand, or generated from a fixed daily schedule? | Decides whether the system needs schedule generation/recurrence or only ad-hoc trip creation — a major scope decision. |

## 3) Vehicles

| # | Question | Why the answer changes the design |
|---|----------|-----------------------------------|
| V1 | Is a vehicle assigned to a route permanently, or per trip? | Decides whether Vehicle↔Route is a fixed link or resolved at trip creation, and where capacity is validated. |
| V2 | Which vehicle attributes affect assignment — capacity only, or also type, maintenance status, license class? | Defines the Vehicle entity fields and the "smallest sufficient vehicle" (best-fit) selection logic. |
| V3 | Can a vehicle be shared across branches of the same company? | Decides whether Vehicle is company-scoped or branch-scoped in the multi-tenant design. |
| V4 | What should happen to a trip when the captain reports a vehicle breakdown mid-route? | Decides whether the trip becomes Failed or needs a vehicle-reassignment flow — a load-bearing state-machine question. |

## 4) Wallet

| # | Question | Why the answer changes the design |
|---|----------|-----------------------------------|
| W1 | What is the charging model — per trip, per distance, or subscription — and who pays: company, employee, or both? | Defines the WalletTransaction schema, the charge-calculation service, and the core business rules. |
| W2 | Can a wallet balance go negative? | Defines whether insufficient balance is rejected transactionally or allowed as credit — a core constraint of the wallet implementation. |
| W3 | Who triggers a charge — automatically on trip completion, or manually by an admin? | Decides whether charging is a synchronous API call or an asynchronous queued job, and where the idempotency key originates. |
| W4 | If a trip is cancelled after being charged, is there a refund flow? | Decides whether reversal transactions are needed and how they coexist with the idempotency unique constraint. |

## 5) Complaints

| # | Question | Why the answer changes the design |
|---|----------|-----------------------------------|
| C1 | What complaint categories and priorities exist, and who maintains them? | Defines the Complaint schema and validation rules, and whether categories are static enums or configurable data. |
| C2 | Are complaints submitted anonymously or linked to the employee account? | Decides whether complaints require authentication and how they relate to Employee — affects actors and use cases. |
| C3 | What is the escalation path: who can escalate, to whom, and is there an SLA per priority? | Defines the complaint state machine and the call-center workflow. |
| C4 | Can a resolved complaint be reopened, and by whom? | Decides whether "resolved" is terminal in the state machine and the editing permissions (RBAC) for complaints. |

---

**Summary:** 23 questions — 5 Employees, 6 Trips, 4 Vehicles, 4 Wallet, 4 Complaints.
