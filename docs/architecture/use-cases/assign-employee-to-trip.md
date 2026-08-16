# Use Case Description — Assign Employee to Trip

**Task:** Day 2 — Task 21
**Related use case:** "Assign Employee to Trip" (use-case diagram, Task 20)
**Primary actor:** Company Manager
**Supporting actors:** System (validation), Employee (passive)

---

## Preconditions

1. The trip exists and is in an assignable state (Scheduled or Assigned — per the Task 25 state machine).
2. The employee belongs to the same company as the trip (tenant scope, FR-005).
3. The vehicle has remaining capacity at the moment of assignment (FR-006).

## Main Flow

1. The Company Manager selects a trip.
2. The Company Manager selects an employee to assign.
3. The System validates: employee belongs to the same company (FR-005), vehicle capacity would not be exceeded (FR-006), the employee has no overlapping trip on that day (FR-007), and the trip state allows assignment (FR-004).
4. The System records the assignment and confirms it to the Manager.

## Alternate Flows

- **AF1 — Employee already assigned to an overlapping trip:** the System rejects the assignment with a clear reason ("employee already assigned to trip X at overlapping time"). The Manager may pick another employee or remove the earlier assignment first. (Reuses Task 10 overlap logic — FR-007.)
- **AF2 — Vehicle at capacity:** the System rejects with the capacity count. The Manager may remove another employee, switch the vehicle (subject to FR-003), or split the route into another trip. (Reuses Task 9 capacity logic — FR-006.)

## Exception Flows

- **EX1 — Employee removed from the company mid-assignment:** the assignment fails atomically — no partial state is written; the Manager receives an error that does not reveal whether the employee exists elsewhere (FR-005, NFR-009).
- **EX2 — Route reassigned to a different vehicle after employees were added:** the System re-validates capacity against the new vehicle before confirming; if the new vehicle is smaller, employees are not silently dropped — the assignment fails with a clear message and the Manager resolves the conflict explicitly.
- **EX3 — System failure mid-transaction (e.g., DB error):** the whole assignment rolls back (no partial records), and a correlation ID is returned so the incident can be traced (NFR-013).

## Postconditions

1. The assignment record exists (FR-009).
2. Capacity and schedule state are consistent — no overbooking is possible under concurrency (NFR-012).
3. The action is audit-logged (who, when, what).

## Business rules enforced

BR-2 (assigned-only boarding — FR-010 relies on this record), BR-3 (capacity), BR-4 (no overlapping double-assignment), BR-7 (legal trip state).
