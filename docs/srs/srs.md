# Software Requirements Specification — Smart Line

**Version:** 1.0 (signed off — Day 2, Task 29)
**Date:** Day 2
**Source of truth:** `docs/requirements/baseline.md` (Day 1, v1.0)
**Traceability:** `docs/srs/traceability-matrix.md`

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of the Smart Line employee-transportation management platform. It is the contract between engineering and business for the remainder of the assessment: the database design (Day 3), architecture and API (Day 4), and implementation (Day 5) are built from it.

### 1.2 Scope
Smart Line manages transportation for companies, not individual riders. In scope (from Day 1, Task 08): core operations (companies, branches, employees, captains, vehicles, routes, trips, assignment, attendance), the trip lifecycle with legal transitions, an idempotent wallet, the complaint lifecycle with call-center workflow, real-time trip status to dashboards, multi-tenant isolation with RBAC, and event-driven notifications. Out of scope (acknowledged as future work): route-optimization AI, driver payroll, full vehicle-maintenance module, employee HR management, GPS history analytics, company billing documents.

### 1.3 Definitions and Abbreviations
- **Trip:** a single execution of a Route on a specific day with one Vehicle and one Captain, carrying assigned Employees.
- **Attendance:** per-employee-per-trip boarding record (Boarded / Not Boarded / Absent / Cancelled / Unknown).
- **Walk-on:** an employee boarding a trip they were not assigned to — rejected (BR-2).
- **Idempotency:** a retried operation produces the same result as the first attempt.
- **Tenant:** a company; all tenant-scoped data carries the company boundary.

### 1.4 References
- `docs/requirements/baseline.md` (Day 1 requirements baseline)
- `docs/requirements/glossary.md`, `actors.md`, `assumptions.md`, `clarification-questions.md`
- `src/algorithms/day1/README.md` (boundary decisions reused by FR-007/FR-010/FR-011)

---

## 2. Overall Description

### 2.1 Product Perspective
One evolving system built over 7 days. Day 1 defined the business baseline; this SRS formalizes it; Day 3 derives the ERD from the entities and state machines referenced here; Day 4 derives the API from FR-001…FR-019 and NFR-001…NFR-014.

### 2.2 User Classes (Actors)
Company Manager, Employee, Captain, Call Center Agent, Admin (5 actors, per Task 04). Roles are not exclusive; every capability is scoped per role.

### 2.3 Operating Environment
Mobile apps (Employee, Captain), web dashboard (Company Manager), call-center tool (Agent), admin console. Backend: horizontally scalable API layer (2+ instances), PostgreSQL, Redis, message queue, WebSocket gateway (Day 4 design).

### 2.4 Design Constraints
- **BR-1..BR-8** from the baseline are non-negotiable business rules.
- Assumptions **A1–A8** hold unless explicitly revised here (flagged in §4).
- No new scope introduced without justification; Day 1 scope is authoritative (Task 08).

---

## 3. Specific Requirements

### 3.1 Functional Requirements

**Trip creation**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-001 | The system shall allow an authorized user to create a trip for a route on a specific date, with a designated vehicle and captain. | Must | Trip persists in the initial legal state; response returns the trip |
| FR-002 | The system shall reject trip creation if the designated captain already has an overlapping trip. | Must | Overlapping creation returns a conflict; no trip is created |
| FR-003 | The system shall reject trip creation if the designated vehicle is unavailable at the proposed time. | Must | Busy or unavailable vehicle rejected; no trip is created |
| FR-004 | The system shall allow a trip only in a legal lifecycle state and reject illegal transitions (e.g., Completed → Started). | Must | Illegal transition returns a conflict with current/attempted state; legal transitions succeed |

**Employee assignment**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-005 | The system shall allow assigning an employee only to a trip of the same company. | Must | Cross-company assignment rejected without confirming existence |
| FR-006 | The system shall reject an assignment that would exceed vehicle capacity. | Must | Assignment beyond capacity rejected; up-to-capacity succeeds |
| FR-007 | The system shall reject assigning an employee to a second overlapping trip on the same day; non-overlapping same-day trips are allowed. | Must | Overlap rejected; return-leg style non-overlap allowed |
| FR-008 | The system shall allow removing an employee from a trip until the trip is Completed. | Should | Removal succeeds pre-completion; rejected after |
| FR-009 | The system shall maintain an assignment record per employee per trip (single source of truth for attendance). | Must | Records queryable per trip and per employee |

**Attendance**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-010 | The system shall allow a captain to mark an employee as boarded only if that employee is assigned to the trip; walk-on is rejected. | Must | Unassigned boarding rejected; assigned boarding succeeds |
| FR-011 | The system shall record attendance idempotently: duplicates and out-of-order events do not corrupt the final state. | Must | Same event replayed twice → same final state |
| FR-012 | The system shall support Boarded / Not Boarded / Absent per employee per trip and derive the final state from the latest valid event. | Must | Final state matches the latest valid event (Task 13 semantics) |

**Wallet**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-013 | The system shall charge the wallet exactly once when a trip is Completed, using an idempotent transaction. | Must | One charge per completed trip; retried requests do not double-charge |

**Complaints**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-014 | The system shall allow an employee to submit a complaint with a category and priority. | Must | Complaint created and visible to the call center |
| FR-015 | The system shall support the complaint workflow: submit → assign to agent → escalate → resolve, with validated transitions. | Should | Each transition validated; escalation path works end to end |

**Real-time & notifications**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-016 | The system shall push trip status changes to connected dashboards in near real time. | Must | Status change reaches connected clients (NFR-002). *Upgraded from Should by consistency review (Task 28) — real-time status is in-scope S5.* |
| FR-017 | The system shall send notifications on trip cancellation to the affected employees, exactly once. | Should | Employees notified; retried jobs do not double-notify |
| FR-018 | The system shall support trip cancellation with defined effects on attendance and wallet. | Should | Cancellation transition legal; attendance/wallet behavior matches the state machine |

**Reporting**

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-019 | The system shall allow a company manager to export weekly attendance per employee. | Could | Export contains one row per employee per trip |

#### FR dependencies (explicit cross-references)

- FR-002, FR-003, FR-004 depend on FR-001 (they validate the same trip-creation inputs).
- FR-013 depends on FR-001/FR-018 (the wallet charge fires on trip completion).
- FR-016 depends on FR-004 (status changes are the events pushed to dashboards).
- FR-017 depends on FR-018 (notifications are triggered by the cancellation transition).
- FR-018 depends on FR-004 (cancellation must be a legal transition) and FR-011/FR-012 (defined attendance effects).
- FR-015 depends on FR-014 (a complaint must exist before it can be assigned/escalated/resolved).

### 3.2 Non-Functional Requirements

| ID | Category | Requirement (measurable target) | Day 6 verification |
|----|----------|--------------------------------|--------------------|
| NFR-001 | Performance | Read API endpoints ≤ 300 ms p95 at 5,000 RPS | Load test |
| NFR-002 | Performance | Trip status → dashboard ≤ 2 s p95 from captain submission | Realtime load test |
| NFR-003 | Performance | List queries on 20M+ rows ≤ 500 ms p95 (paginated) | Benchmark with seeded data |
| NFR-004 | Scalability | Support 1,000+ companies and 10M employees without degradation | Capacity test |
| NFR-005 | Scalability | API horizontally scalable to 2+ instances; no instance-local state | Multi-instance test |
| NFR-006 | Scalability | Ingest 1,000–2,000 driver location updates/s peak without degrading other APIs | Ingestion load test |
| NFR-007 | Availability | 99.9% per month (≈43 min downtime budget) | Monitoring review |
| NFR-008 | Availability | Redis outage causes no data loss or incorrect state (realtime falls back to polling; wallet never from stale cache) | Outage drill |
| NFR-009 | Security | Cross-tenant access structurally impossible; other-company resource returns 404 without existence confirmation | Security suite (Task 79) |
| NFR-010 | Security | Strong password hashing; no secrets in code, logs, or Git history; TLS everywhere | Secrets + config audit (Task 82) |
| NFR-011 | Reliability | Wallet transactions exactly-once under retry and concurrency | Concurrency test (Task 89) |
| NFR-012 | Reliability | Overbooking impossible: concurrent requests never double-book a captain or exceed capacity | Concurrency test (Task 67) |
| NFR-013 | Maintainability | ≥ 70% line coverage on business-logic modules; structured JSON logs with correlation IDs | Coverage report + log review |
| NFR-014 | Maintainability | Database migrations runnable with a single command, up and down, without errors | Fresh-DB migration run |

#### NFR conflict reconciliation (stated trade-offs)

| Conflict | Resolution | Trade-off accepted |
|----------|-----------|--------------------|
| NFR-011 (wallet exactly-once) vs NFR-001 (low latency) | Wallet writes use transactional, constraint-based guarantees (unique idempotency key + balance check); the latency cost is accepted only on the wallet path; non-financial reads may be cached | Higher wallet latency/locking; guaranteed financial correctness at the DB layer |
| NFR-002 (real-time dashboard) vs offline industrial zones | Attendance/status events captured offline with client event IDs and synced later; server dedupes by event ID; dashboard shows "pending sync" | Freshness can lag behind network recovery; idempotent ingestion complexity (full analysis in `docs/requirements/conflicts.md`) |

### 3.3 Open Questions Flagged (from Day 1, §10)
The following are explicitly flagged, not silently resolved: E3, E4 (employees), T4, T5, T6 (trips), V1–V4 (vehicles), W3, W4 (wallet), C1–C4 (complaints). Any requirement above that depends on an open question is marked in the traceability matrix as "flagged".

---

## 4. Constraints

- **Business rules BR-1…BR-8** (baseline §3) are binding.
- **Assumption A5** (one vehicle per trip) is the least-confident assumption; vehicle identity is isolated in the assignment layer so a mid-trip change stays contained. Flagged as the highest-risk constraint to revisit.
- **Scope:** no new in-scope items added in this SRS beyond Day 1 Task 08 without justification; the only additions are FR-016…FR-019, which map to already-in-scope items S5/S7 (real-time, notifications) and S4 (complaints) — no scope expansion.

## 5. Appendices

- **A — Traceability:** `docs/srs/traceability-matrix.md` (100% coverage).
- **B — Definitions:** `docs/requirements/glossary.md`.
- **C — Actors:** `docs/requirements/actors.md`.
- **D — Open questions:** `docs/requirements/clarification-questions.md`.
- **E — Algorithm boundary decisions:** `src/algorithms/day1/README.md` (reused by FR-007/FR-010/FR-011).
- **F — State machines (normative):** `docs/architecture/trip-state-machine.md` (FR-004/FR-018), `docs/architecture/attendance-state-machine.md` (FR-010–FR-012).
- **G — Consistency review:** `docs/architecture/consistency-review.md` (Task 28 — findings and resolutions applied to v1.0).

---

## 6. Sign-off (Day 2 — Task 29)

**Version:** 1.0 — **Status:** signed off, no open TODOs.

**Changelog (0.9 → 1.0):**
- FR-016 upgraded from Should to Must (consistency review Finding 1 — NFR-002 and the Task 23 real-time architecture require it).
- Added FR dependency cross-references (Task 17 constraint).
- Added inline NFR conflict reconciliation with stated trade-offs (Task 18 edge case).
- Added normative references to the Trip and Attendance state machines.
- Activity diagram annotated with state references (consistency review Finding 2); attendance freeze/ingestion layers separated (Finding 3).

**Sign-off statement:** all 19 FRs and 14 NFRs are reviewed and consistent with the baseline; traceability matrix covers 100% of Day 1 items in both directions; open questions from Day 1 (§3.3) remain explicitly flagged, not silently resolved; no scope was added beyond Day 1 Task 08; constraint A5 remains flagged as the highest-risk assumption.
