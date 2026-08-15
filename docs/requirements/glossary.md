# Smart Line Domain Glossary

**Task:** Day 1 — Task 01 (Requirements Engineering)
**Purpose:** Define every entity in the Smart Line business domain with its purpose and its relationships to at least two other entities. This document is the seed for the Day 3 ERD — relationships stated here must be consistent with the later entity-relationship model.

> **Note on count:** the assessment brief lists **14 entity names** while referring to "13 entities." To be safe, this glossary covers **all 14 named entities**. The Day 3 ERD will trace back to this list.

---

## 1. Company
The legal organization that contracts Smart Line to transport its employees between pickup locations and workplaces. A Company is the top-level tenant boundary in the system: it owns **Branches** (a Company has many Branches, 1:N), employs **Employees**, and holds a **Wallet** that is charged for trips. All tenant-scoped data in the system traces back to the Company.

## 2. Branch
An operational unit of a **Company** (e.g., a factory site or office campus) where transportation is planned and delivered. A Branch houses **Employees** (each Employee usually belongs to one Branch), owns **Routes** (a Route is tied to a Branch), and may operate its own set of **Vehicles**. Branches exist so that a Company can run independent transportation operations per site.

## 3. Employee
A person transported by Smart Line. An Employee belongs to a **Company** and usually to one **Branch** (Branch assignment is optional — see edge cases), has one or more **Pickup Locations** (with one default), is recorded in **Attendance** for each trip they are assigned to, and may file a **Complaint**. Employees are the core "cargo" of the domain: every Trip, Attendance record, and Complaint ultimately exists because of them.

## 4. Pickup Location
A geographic point where **Employees** board a **Trip**. Pickup Locations are company-scoped (assumption A3), an Employee may have several with exactly one default (assumption A2), and **Routes** reference them as ordered stops. Pickup Location is modeled as its own entity (not an embedded field) so that multiple employees can share a point and so the clustering algorithm (Task 11) can group employees by proximity.

## 5. Captain
The driver who operates a **Vehicle** on a **Trip** and is the trusted recorder of **Attendance** (assumption A6). A Captain may be assigned to multiple Trips across a day but never to two overlapping ones (Task 10), and is the first line of reporting for vehicle breakdowns. Captains are a distinct actor from Employees because their system capabilities are operational, not transactional.

## 6. Vehicle
A physical vehicle with a fixed seating **capacity**, used to execute **Trips**. A Vehicle is assigned to a Trip (per-trip or per-route — open question V1), is driven by a **Captain**, and its capacity is the input to the over-booking prevention logic (Task 9). Vehicle attributes beyond capacity (type, maintenance status, license class) are an open question (V2) that will refine the entity on Day 3.

## 7. Route
A fixed, ordered path with stops (Pickup Locations) that a **Branch** operates for its **Employees**. A Route is tied to a **Branch** (business rule), is executed as **Trips** on specific days, and its stop order affects total trip duration (Task 12). Routes are the static skeleton of the domain; Trips are their dynamic executions.

## 8. Trip
A single execution of a **Route** on a specific day, with one **Vehicle** and one **Captain**, carrying a set of assigned **Employees**. A Trip has a lifecycle state (Scheduled → Assigned → Started → In Progress → Completed/Cancelled/Failed — Task 25), generates **Attendance** records for its employees, and triggers **Wallet** charges upon completion. Trips are where all other entities meet: Route (what), Vehicle and Captain (who operates), Employees (who rides), Attendance and Wallet (what happened).

## 9. Attendance
A per-**Employee**-per-**Trip** record of boarding state (Boarded, Not Boarded, Absent, Cancelled, Unknown). Attendance is recorded by the **Captain** (assumption A6), is decoupled from Trip status (Task 26 — e.g., a Cancelled Trip does not automatically rewrite Attendance), and its event stream must be idempotent against duplicates and out-of-order arrivals (Task 13). Attendance answers the business question "did this employee actually board this morning?"

## 10. Wallet
A financial account (one per **Company** in the base model) holding a balance that is charged for trips. A Wallet receives **transactions** (charging model open — W1), must never go negative (assumption A8), and every transaction must be idempotent against retried requests (Task 39). The Wallet connects the operational domain (Trips) to the financial domain (payments), so its integrity rules are the strictest in the system.

## 11. Complaint
A report submitted by an **Employee** (or on their behalf) about a transportation issue, carrying a category and priority (open question C1). Complaints are handled by the **Call Center**, can be escalated to an **Admin**, and may reference the **Trip** or **Vehicle** involved. A Complaint is the main customer-service artifact and has its own lifecycle (submit → assign → escalate → resolve; reopen is open question C4).

## 12. Call Center
The Smart Line support function whose **Agents** receive, take ownership of, and resolve **Complaints**, and handle phone inquiries from **Employees** and Company **Managers**. Call Center Agents have legitimate read access across all companies (a documented exception to tenant isolation, to be reconciled in Tasks 52–53) because a caller's company cannot always be determined in advance.

## 13. Notification
A message delivered to **Employees**, **Captains**, or Company **Managers** about relevant events (e.g., trip cancelled, route changed, complaint status updated). Notifications are sourced from **Trip** and **Complaint** events and are delivered asynchronously via a queue (Task 49), with idempotent delivery so retries do not double-notify. Notifications close the loop between system events and human action.

## 14. Admin
The Smart Line platform administrator who manages **Companies** (onboarding, deactivation), users, roles, and reference data, and is the final escalation target for **Complaints**. The Admin is the only actor with platform-wide visibility; every other actor's access is scoped by the Company tenant (Task 36/52/53).

---

## Edge Cases (from Task 01 spec)

- **Employee with no branch assigned:** allowed. Branch assignment is optional (assumption A1); the employee can still exist, be given a Pickup Location, and be assigned to trips of the company. Branch-scoped queries treat such employees as "unassigned" rather than invalid.
- **Branch with no active routes yet:** allowed. A Branch can exist with zero Routes; routes are created later. The Branch remains visible in the company structure and can later receive routes and trips without schema changes.

---

## Relationship Quick Map

| Entity | Relates to |
|--------|-----------|
| Company | Branch (1:N), Employee (1:N), Wallet (1:1) |
| Branch | Company (N:1), Employee (1:N), Route (1:N), Vehicle (0:N) |
| Employee | Company (N:1), Branch (N:1, optional), Pickup Location (1:N), Trip (N:M via assignment), Attendance (1:N), Complaint (0:N) |
| Pickup Location | Employee (N:1), Route (stops N:M), Trip (boarding points) |
| Captain | Vehicle (drives 1:N), Trip (assigned 1:N), Attendance (records) |
| Vehicle | Trip (1:N), Captain (1:N), Route (0:N, open V1) |
| Route | Branch (N:1), Pickup Location (stops), Trip (1:N) |
| Trip | Route (N:1), Vehicle (N:1), Captain (N:1), Employee (N:M), Attendance (1:N), Wallet (charges) |
| Attendance | Employee (N:1), Trip (N:1), Captain (records) |
| Wallet | Company (1:1), Trip (charges), Transactions (1:N) |
| Complaint | Employee (N:1), Trip (0:1), Call Center Agent (handles), Admin (escalation) |
| Call Center | Complaint (1:N), Employee (contacts), Company Manager (contacts) |
| Notification | Trip (event source), Complaint (event source), Employee/Captain/Manager (recipients) |
| Admin | Company (manages), Complaint (escalation target), All entities (platform-wide view) |
