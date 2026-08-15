# Smart Line — Requirements Baseline

**Version:** 1.0 — **Day 1, Task 14**
**Status:** Single source of truth for Day 2 (SRS & UML). All Day 2 tasks can be performed using this document alone.
**Source files:** `glossary.md`, `clarification-questions.md`, `assumptions.md`, `actors.md`, `functional.md`, `non-functional.md`, `conflicts.md`, `scope.md` (same folder) — this baseline consolidates them without contradiction.

---

## Table of Contents

1. Introduction & Purpose
2. Domain Overview
3. Business Rules (non-negotiable)
4. Glossary (14 entities)
5. Actors (5)
6. Functional Requirements (FR-01 – FR-12)
7. Non-Functional Requirements (NFR-01 – NFR-12)
8. Scope (in / out)
9. Assumptions (A1 – A8)
10. Open Questions (15)
11. Requirement Conflicts & Resolutions
12. Key Edge Cases
13. Handoff Notes for Day 2

---

## 1. Introduction & Purpose

Smart Line is an employee-transportation management platform: companies contract Smart Line to move their employees between pickup locations and workplaces. This baseline defines what the system must do (functional), how well it must do it (non-functional), what it will not do (scope), what we are assuming when the Product Owner has not answered (assumptions), and what remains unanswered (open questions). Everything here feeds the Day 2 SRS.

## 2. Domain Overview

The domain has 5 actor groups (Company Manager, Employee, Captain, Call Center Agent, Admin) operating on 14 entities: Company, Branch, Employee, Pickup Location, Captain, Vehicle, Route, Trip, Attendance, Wallet, Complaint, Call Center, Notification, Admin. The central flow: a Company owns Branches → each Branch owns Routes → a Route is executed as a Trip on a given day with one Vehicle and one Captain → Employees assigned to the Trip are recorded in Attendance → Trip completion triggers a Wallet charge → incidents become Complaints handled by the Call Center and escalated to Admin → relevant events produce Notifications.

## 3. Business Rules (non-negotiable)

- **BR-1** — A company can have multiple branches; an employee belongs to a company and usually one branch; a route is tied to a branch.
- **BR-2** — An employee can only be marked as boarded on a trip they were assigned to; walk-on boarding is rejected.
- **BR-3** — Vehicle seating capacity must never be exceeded by assignments.
- **BR-4** — A captain must never be assigned to two trips whose times overlap; an employee must never be assigned to two overlapping trips (non-overlapping same-day trips, e.g., a return leg, are allowed).
- **BR-5** — Wallet balance never goes negative; transactions are exactly-once (retried requests never duplicate).
- **BR-6** — Cross-tenant access is structurally impossible: a request for another company's resource returns 404 without confirming existence.
- **BR-7** — Trip status follows the defined lifecycle: Scheduled → Assigned → Started → In Progress → Completed / Cancelled / Failed; illegal transitions are rejected.
- **BR-8** — Attendance state is decoupled from Trip state (a cancelled trip does not silently rewrite attendance).

## 4. Glossary (14 entities)

| Entity | Definition (purpose + key relationships) |
|--------|-------------------------------------------|
| **Company** | Legal organization contracting Smart Line. Top-level tenant boundary; owns Branches (1:N), employs Employees, holds a Wallet. |
| **Branch** | Operational unit of a Company (e.g., factory site). Houses Employees, owns Routes, may operate Vehicles. |
| **Employee** | Person transported. Belongs to a Company and usually one Branch (optional — see Edge Cases), has 1+ Pickup Locations (one default), recorded in Attendance per trip, may file a Complaint. |
| **Pickup Location** | Geographic boarding point. Company-scoped; Employee 1:N with one default; referenced as Route stops. Modeled as its own entity (feeds Task 11 clustering). |
| **Captain** | Driver operating a Vehicle on a Trip; trusted recorder of Attendance; reports breakdowns; never double-booked (BR-4). |
| **Vehicle** | Physical vehicle with fixed seating capacity; assigned to Trips; capacity is the over-booking guard input. |
| **Route** | Fixed ordered path (Pickup Location stops) tied to a Branch; executed as Trips; stop order affects duration. |
| **Trip** | Single execution of a Route on a day with one Vehicle and one Captain, carrying assigned Employees; has a lifecycle state (BR-7); generates Attendance and triggers Wallet charges. |
| **Attendance** | Per-Employee-per-Trip boarding state (Boarded / Not Boarded / Absent / Cancelled / Unknown); recorded by Captain; decoupled from Trip state (BR-8); event stream idempotent. |
| **Wallet** | Financial account (per Company) charged for trips; never negative (BR-5); transactions exactly-once. |
| **Complaint** | Employee report with category + priority; handled by Call Center; escalate-able to Admin; may reference a Trip/Vehicle. |
| **Call Center** | Support function whose Agents resolve Complaints across all companies (audited cross-tenant read — see §11). |
| **Notification** | Event-driven message to Employees/Captains/Managers (trip cancelled, status changed…); delivered asynchronously via queue, idempotently. |
| **Admin** | Platform administrator: manages Companies, users, roles, reference data; final Complaint escalation target; platform-wide visibility. |

*Full detail (paragraph form) in `glossary.md`. Relationships here are the seed for the Day 3 ERD.*

## 5. Actors (5)

| Actor | Key capabilities (user goals) |
|-------|-------------------------------|
| **Company Manager** | View my company's employees & attendance; manage branches/routes/vehicles; schedule trips & assign employees; view live trip status & wallet; handle escalated complaints. |
| **Employee** | View my trips & pickup locations; view my attendance history; submit a complaint; receive trip notifications; view my wallet charges. |
| **Captain** | View my trips/routes today; change trip status; record attendance; report breakdowns/incidents; view my schedule (no overlaps). |
| **Call Center Agent** | View & take ownership of complaints across all companies; update status & notes; escalate to Admin; look up employees/companies; close the loop with complainants. |
| **Admin** | Onboard/deactivate companies; manage users/roles/permissions; resolve escalated complaints; review audit logs & platform data; configure reference data. |

*Roles are not exclusive: a user can be both Employee and Company Manager; capabilities are scoped per role. Full detail in `actors.md`.*

## 6. Functional Requirements (FR-01 – FR-12)

**Trip creation**
- **FR-01** — The system shall allow an authorized user to create a trip for a route on a specific date, with a designated vehicle and captain.
- **FR-02** — The system shall reject trip creation if the designated captain already has an overlapping trip.
- **FR-03** — The system shall reject trip creation if the designated vehicle is unavailable at the proposed time.
- **FR-04** — The system shall allow a trip to exist only in a legal lifecycle state and reject illegal transitions (e.g., Completed → Started).

**Employee assignment**
- **FR-05** — The system shall allow assigning an employee only to a trip of the same company.
- **FR-06** — The system shall reject an assignment that would exceed vehicle capacity.
- **FR-07** — The system shall reject assigning an employee to a second overlapping trip on the same day (non-overlapping allowed).
- **FR-08** — The system shall allow removing an employee from a trip until it is Completed.
- **FR-09** — The system shall maintain an assignment record per employee per trip (single source of truth for attendance).

**Attendance tracking**
- **FR-10** — The system shall allow a captain to mark an employee as boarded only if assigned to the trip; walk-on is rejected (BR-2).
- **FR-11** — The system shall record attendance idempotently (duplicates and out-of-order events do not corrupt final state).
- **FR-12** — The system shall support Boarded / Not Boarded / Absent and derive the final state from the latest valid event.

*Full detail with verification lines in `functional.md`.*

## 7. Non-Functional Requirements (NFR-01 – NFR-12)

**Performance:** NFR-01 read APIs ≤ 300 ms p95 @ 5,000 RPS · NFR-02 trip-status → dashboard ≤ 2 s p95 · NFR-03 large list queries ≤ 500 ms p95 @ 20M+ rows.
**Scalability:** NFR-04 support 1,000+ companies / 10M employees · NFR-05 API horizontally scalable to 2+ instances, no instance-local state · NFR-06 ingest 1,000–2,000 location updates/s peak without degrading other APIs.
**Availability:** NFR-07 99.9%/month · NFR-08 Redis outage → no data loss/incorrect state (realtime falls back to polling; wallet never served from stale cache).
**Security:** NFR-09 cross-tenant access structurally impossible (404, no existence confirmation) · NFR-10 strong password hashing; no secrets in code/logs/Git; TLS everywhere.
**Reliability:** NFR-11 wallet exactly-once · NFR-12 overbooking impossible under concurrency.

*Conflicts reconciled in §11. Full detail in `non-functional.md`.*

## 8. Scope

**In scope:** (S1) core operations (companies→branches→employees→captains→vehicles→routes→trips→assignment→attendance); (S2) trip lifecycle with legal transitions; (S3) idempotent wallet, non-negative balance; (S4) complaint lifecycle + call-center workflow; (S5) real-time trip status across instances; (S6) multi-tenant isolation + RBAC; (S7) async notifications.

**Out of scope (future work):** (O1) route-optimization AI; (O2) driver payroll/captain payments; (O3) full vehicle-maintenance module — *but* a minimal vehicle availability flag stays in scope for data integrity (a broken vehicle must not be assignable); (O4) employee HR management; (O5) GPS location history & replay analytics (current location only); (O6) company billing/invoicing documents.

## 9. Assumptions (A1 – A8)

| # | Assumption | Risk if wrong | Traced to |
|---|-----------|---------------|-----------|
| A1 | Employee belongs to exactly one branch (branch optional) | N:M junction + RBAC rework | ERD, multi-tenancy, RBAC |
| A2 | PickupLocation is a separate entity; several per employee, one default | Over- or under-modeling | ERD, Task 11 |
| A3 | Pickup locations are company-scoped | Multi-tenant redesign | Task 36 / 53 |
| A4 | A trip serves one branch only | ERD cardinality changes | Task 32 / 57 |
| A5 | One vehicle per trip for its full duration (no mid-trip change) — **least confident** | State machine + history table rework | Task 25 / ERD / Task 9 |
| A6 | Attendance recorded only by the captain | Anti-abuse + dual-writer logic | Task 26 / 13 |
| A7 | Flat per-trip fare, charged automatically on completion; company pays | Schema + service rework | Task 39 / 58 / 68 |
| A8 | Wallet balance never negative | Credit flow + constraint change | Task 68 / 39 |

## 10. Open Questions (15 — to be answered by Product Owner)

**Employees:** E3 — can an employee ride a trip outside their branch's route? · E4 — what happens to future trips when an employee is deactivated?
**Trips:** T4 — can one route run as parallel trips (two vehicles, same day)? · T5 — cancellation & refund policy? · T6 — on-demand or fixed schedule?
**Vehicles:** V1 — vehicle fixed to route or per trip? · V2 — which vehicle attributes affect assignment (maintenance, license)? · V3 — vehicle shared across branches? · V4 — what happens on a breakdown mid-route?
**Wallet:** W3 — who triggers charges (auto vs manual)? · W4 — refund flow after a charged trip is cancelled?
**Complaints:** C1 — categories/priorities and who maintains them? · C2 — anonymous or linked to the employee account? · C3 — escalation path & SLA per priority? · C4 — can a resolved complaint be reopened?

*Questions answered by assumptions: E1→A1, E2→A2, E5→A3, T1→A4, T2→A5, T3→A6, W1→A7, W2→A8. Full list with rationales in `clarification-questions.md`.*

## 11. Requirement Conflicts & Resolutions

| Conflict | Resolution | Trade-off |
|----------|-----------|-----------|
| Real-time attendance vs offline industrial zones | Offline-first capture with client event IDs + server dedup (Task 13 logic); dashboard shows "pending sync" | Attendance freshness can lag; idempotent ingestion complexity |
| Wallet strong consistency vs low latency | Transactional constraint-based wallet path (unique idempotency key + balance check); non-financial reads may cache | Higher wallet latency/locking; financial correctness guaranteed at DB layer |
| Tenant isolation vs call-center cross-company lookup | Audited, read-only role exception via shared authorization middleware (same tenant mechanism, documented role override); every cross-tenant read logged | Narrow monitored exception surface; single support team without shared privileged accounts |

## 12. Key Edge Cases

- Employee with no branch assigned → valid, treated as "unassigned" in branch-scoped queries (A1).
- Branch with no active routes → valid; routes created later without schema change.
- Walk-on boarding (unassigned employee boards) → rejected (FR-10 / BR-2).
- Employee assigned to two same-day trips → allowed only if non-overlapping (FR-07).
- Offline attendance synced later → no duplicates via event-ID dedup (FR-11, Conflict 1).
- Vehicle under maintenance → unavailable for assignment (Scope O3 edge case).
- Illegal trip-state transition (e.g., Completed → Started) → rejected (BR-7, FR-04).

## 13. Handoff Notes for Day 2

- Day 2 builds the SRS from §6–§7 (formalized as FR-001…/NFR-001… with priorities) and the Use Case Diagram from §5 (actors) — 100% traceability required.
- §4 (glossary) and §9 (assumptions) drive entity extraction on Day 3; BR-7/BR-8 drive the Trip and Attendance state machines (Task 25/26).
- §10 (open questions) must be flagged explicitly in the SRS rather than silently resolved.
- Any scope revision on Day 2 must reference §8 and justify the change.
