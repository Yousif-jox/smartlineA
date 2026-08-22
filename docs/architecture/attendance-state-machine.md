# Attendance State Transition Diagram — Smart Line

**Task:** Day 2 — Task 26
**Purpose:** The lifecycle of an Attendance record (per employee per trip), deliberately **decoupled from the Trip state machine** (BR-8). A cancelled trip does not silently rewrite attendance — history stays true.

---

## States (5)

`Unknown` (initial) · `Boarded` · `Not Boarded` · `Absent` · `Cancelled`

## Transitions

| From | To | Trigger |
|------|-----|---------|
| Unknown | Boarded | Captain records the employee boarded (FR-010) |
| Unknown | Not Boarded | Captain records the employee present but not boarded |
| Unknown | Absent | Captain records the employee absent (after grace, see Task 24) |
| Unknown | Cancelled | The trip is Cancelled/Failed and no event was recorded for this employee |
| Boarded / Not Boarded / Absent | (no outgoing) | Recorded states are preserved — factual history |

**Corrections are handled by the event model, not by state transitions:** a newer captain event with a later timestamp overrides an earlier one (Task 13 semantics — latest-timestamp-wins, idempotent, order-independent). This is the same rule the Day 1 algorithm implements.

## Decoupling Rules (BR-8) — the interview-critical part

1. **Trip Cancelled before departure (Scheduled/Assigned → Cancelled):** all attendance records for that trip become `Cancelled` — the ride never happened.
2. **Trip Cancelled mid-route (In Progress → Cancelled):** attendance **already recorded** (Boarded/Not Boarded/Absent) is **preserved** — those people really were on the road. Employees **without a recorded event** are finalized to `Cancelled`.
3. **Trip Failed:** same rule as mid-route cancellation — recorded events preserved, unrecorded employees finalized to `Cancelled`. A Failed trip can legitimately have Boarded records (they boarded, then the trip failed en route).
4. **After the trip is Completed, no new attendance events are accepted** — the record is frozen. The only exception is an Admin correction, which is audited (same pattern as complaint lock, C4).

## Consistency

- FR-010 (assigned-only boarding), FR-011 (idempotent), FR-012 (latest event wins).
- Task 13 algorithm (`src/algorithms/day1/attendance.js`) is the implementation of the event model.
- Visual: `docs/architecture/attendance-state-machine.puml`.
