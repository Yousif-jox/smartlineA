# Database Entities — Smart Line

**Task:** Day 3 — Task 31
**Source:** SRS v1.0 (FR-001…FR-019, NFR-001…NFR-014) + glossary (14 entities) + state machines (Tasks 25/26)
**Method:** every entity is extracted from the SRS and justified by the requirement that needs it. No entity without a requirement; no requirement without an entity.

---

## Core tenant chain

| # | Entity | Justification (requirement) | Key attributes |
|---|--------|------------------------------|----------------|
| 1 | **Company** | Tenant root — NFR-009 (isolation), FR-005 (scope) | id, name, status, created_at |
| 2 | **Branch** | BR-1 (company → branches) | id, company_id (FK), name, address |
| 3 | **Employee** | FR-005/006/010 (assignment, attendance) | id, company_id (FK), branch_id (FK nullable — A1), name, phone, status |
| 4 | **PickupLocation** | A2 + Task 11 (clustering needs shared points) | id, company_id (FK — A3), name, lat, lng, address |
| 5 | **EmployeePickup** (junction) | A2 (several per employee, one default) | employee_id (FK), pickup_location_id (FK), is_default, UNIQUE(employee_id, pickup_location_id) |
| 6 | **Captain** | FR-002/010 (overlap guard, attendance writer) | id, company_id (FK), name, phone, status |
| 7 | **Vehicle** | FR-003/006 (availability, capacity) — minimum attributes from V2 resolution | id, company_id (FK — A9, company fleet), capacity (int), status (available/unavailable), plate, type |
| 8 | **Route** | BR-1 (branch → routes) | id, branch_id (FK), name |
| 9 | **RouteStop** | FR-001, Task 12 (ordered stops) | id, route_id (FK), pickup_location_id (FK), position (int) |

## Execution chain

| # | Entity | Justification | Key attributes |
|---|--------|---------------|----------------|
| 10 | **Trip** | FR-001/004/018 + Task 25 (state machine) | id, company_id (FK), route_id (FK), vehicle_id (FK), captain_id (FK), trip_date, start_time, end_time, **state** (CHECK — 7 states), **stops_snapshot** (JSON — history immutability, Day 2 consistency finding 2), created_at |
| 11 | **TripEmployee** (junction) | FR-009 (assignment record — single source of truth for attendance) | trip_id (FK), employee_id (FK), assigned_at, removed_at, UNIQUE(trip_id, employee_id) |
| 12 | **Attendance** | FR-010/011/012 + Task 26 (final record) | id, trip_id (FK), employee_id (FK), state (CHECK — 5 states), updated_at, UNIQUE(trip_id, employee_id) |
| 13 | **AttendanceEvent** | FR-011 + Task 13 (idempotent event log) | id, attendance_id (FK), event_id (UNIQUE — dedup), state, timestamp, recorded_by (captain_id FK) |

## Financial chain

| # | Entity | Justification | Key attributes |
|---|--------|---------------|----------------|
| 14 | **Wallet** | FR-013, A7/A8 | id, company_id (FK UNIQUE — one per company), balance (CHECK ≥ 0), updated_at |
| 15 | **WalletTransaction** | FR-013 + Task 39 (idempotent) | id, wallet_id (FK), **idempotency_key**, amount, type, trip_id (FK), status, created_at, **UNIQUE(wallet_id, idempotency_key)** |

## Support chain

| # | Entity | Justification | Key attributes |
|---|--------|---------------|----------------|
| 16 | **Complaint** | FR-014/015 + Task 22 (lifecycle) | id, company_id (FK), employee_id (FK), category, priority, state (submit→assign→escalate→resolve), assigned_agent_id (FK), resolution, created_at |
| 17 | **Account** (User) | RBAC — Day 4 (Task 52) | id, company_id (FK nullable — Admin/Call Center), role (enum), name, credentials_hash |
| 18 | **Notification** | FR-017 (async, idempotent) | id, recipient_id (FK), type, payload, status, event_id (UNIQUE — dedup), created_at |
| 19 | **AuditLog** | Task 41 (soft deletes + audit) | id, company_id (FK), actor_id, action, entity, entity_id, old_value, new_value, created_at |

---

## Edge cases addressed (from Task 31)

- **PickupLocation as an entity (not an embedded field):** justified by A2 (several per employee) and by Task 11 — clustering groups employees by *points*, so points must be first-class rows. An embedded field would force duplicating coordinates per employee and break sharing (Day 2 interview finding 2).
- **Employee with no branch:** `branch_id` nullable (A1) — the employee still belongs to the company; branch-scoped queries treat them as unassigned.
- **Attendance as record + event:** two tables — the final record (unique per employee per trip) and the idempotent event log (unique event_id). This is the DB realization of Task 13's latest-timestamp-wins model and of the freeze rule (Task 26): the record updates until the trip completes; the event log never deletes.
- **Trip snapshot:** `stops_snapshot` JSON — a route edit on Tuesday must not rewrite Monday's completed trips (Day 2 finding). The snapshot is written once at trip creation and never updated.

## Count

19 entities — 14+ required, each justified and mapped to FR/NFR. Relationships and cardinalities: `relationships.md`.
