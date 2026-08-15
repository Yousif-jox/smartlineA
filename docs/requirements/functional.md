# Functional Requirements — Smart Line

**Task:** Day 1 — Task 05 (Requirements Engineering)
**Scope:** 12 functional requirements covering trip creation, employee assignment, and attendance tracking.
**Format:** Each requirement is testable and written as "The system shall…". No implementation detail (no table names, no endpoint names).
**Business rule:** An employee can only be marked as boarded on a trip they were assigned to.

---

## A. Trip Creation (FR-01 – FR-04)

- **FR-01** — The system shall allow an authorized user to create a trip for a route on a specific date, with a designated vehicle and captain.
  *Verification:* creating a trip with valid data succeeds and the trip exists in a legal initial state.
- **FR-02** — The system shall reject the creation of a trip if the designated captain already has another trip whose time overlaps with the proposed trip's time.
  *Verification:* creating an overlapping trip for the same captain fails with a clear conflict.
- **FR-03** — The system shall reject the creation of a trip if the designated vehicle is not available at the proposed time (already assigned to another trip, or marked unavailable).
  *Verification:* creating a trip with a busy/unavailable vehicle fails.
- **FR-04** — The system shall allow a trip to exist only in a legal state of the trip lifecycle, and shall reject any attempt to place it in an illegal state (e.g., Completed → Started).
  *Verification:* illegal state transitions are rejected; legal ones succeed.

## B. Employee Assignment (FR-05 – FR-09)

- **FR-05** — The system shall allow assigning an employee to a trip only if the employee belongs to the same company as the trip.
  *Verification:* assigning an employee from another company is rejected without revealing the employee's existence.
- **FR-06** — The system shall reject an assignment if it would exceed the vehicle's seating capacity.
  *Verification:* assigning one employee beyond capacity fails; assigning up to capacity succeeds.
- **FR-07** — The system shall reject assigning an employee to a second trip whose scheduled time overlaps with a trip the employee is already assigned to on the same day.
  *Verification:* overlapping double-assignment is rejected; non-overlapping assignments (e.g., a return leg) are allowed.
- **FR-08** — The system shall allow removing an employee from a trip as long as the trip has not been Completed.
  *Verification:* removal succeeds before completion and is rejected after completion.
- **FR-09** — The system shall maintain an assignment record for every employee on every trip (assigned or not), so that attendance validation has a single source of truth.
  *Verification:* assignment records are queryable per trip and per employee.

## C. Attendance Tracking (FR-10 – FR-12)

- **FR-10** — The system shall allow a captain to mark an employee as boarded only if that employee is assigned to the trip; a walk-on (unassigned employee boarding) shall be rejected.
  *Verification:* marking an unassigned employee as boarded fails; marking an assigned employee succeeds.
- **FR-11** — The system shall record attendance submissions idempotently, so that duplicate or out-of-order submissions do not corrupt the final attendance state.
  *Verification:* sending the same event twice yields the same final state; out-of-order events resolve by timestamp.
- **FR-12** — The system shall support the attendance states Boarded, Not Boarded, and Absent per employee per trip, and shall derive the final state from the latest valid event.
  *Verification:* each state is recordable and the derived final state matches the latest event.

---

## Edge Cases Addressed

- **Walk-on boarding** (employee boards a trip they were not assigned to) → rejected by FR-10; handled as a validation exception, not a schema feature.
- **Employee assigned to two trips on the same day** → allowed only if the trips do not overlap in time (FR-07); overlapping double-assignment is rejected.
- **Offline/duplicate attendance submissions** → idempotent handling (FR-11), consistent with the algorithm designed in Task 13.

## Acceptance Summary

All 12 requirements are individually testable, free of implementation detail, and consistent with the Day 1 business rules (capacity, captain overlap, assignment-based attendance). They feed directly into the Day 2 SRS (FR-001… numbering).
