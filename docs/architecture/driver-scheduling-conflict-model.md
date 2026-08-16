# Practical Challenge — Driver Scheduling Conflict Model (design note)

**Day 2 practical challenge** — design only, no implementation (implementation is Day 5).
**Goal:** a formal validation rule engine that combines Task 10's overlap logic with Task 25's state machine, so a proposed trip assignment is accepted or rejected **with a reason code** before it is persisted.

---

## Design

A deterministic rule table, evaluated in fixed order (cheap checks first, expensive last). Each rule returns `ACCEPT` or `REJECT` with a reason code.

| # | Rule | Decision | Reason code |
|---|------|----------|-------------|
| R1 | The trip state must be legal for the requested action per Task 25 (e.g., assignment requires Scheduled/Assigned; starting requires Assigned). | REJECT if illegal | `ILLEGAL_TRANSITION` |
| R2 | Proposed trip overlaps an existing trip whose state is **Cancelled** or **Failed**. | ACCEPT | — (cancelled/failed trips occupy no schedule capacity) |
| R3 | Proposed trip overlaps an existing trip in **Scheduled** or **Assigned**. | REJECT | `CAPTAIN_OVERLAP` |
| R4 | Proposed trip overlaps an existing trip in **Started** or **In Progress**. | REJECT | `CAPTAIN_BUSY` (trip is physically running — stronger signal) |
| R5 | Vehicle capacity would be exceeded (Task 9 semantics, unique employees). | REJECT | `CAPACITY_EXCEEDED` |

## Key design decisions

- **R2 before R3/R4:** a cancelled/failed trip does not reserve the captain's time, so it must not trigger an overlap rejection. This is the explicit edge case: "overlap with a Cancelled trip is allowed."
- **R3 vs R4 are separate codes** so dispatch can tell "planned conflict" from "captain currently on the road" — the dashboard renders them differently.
- **Adjacent trips are NOT overlaps** (Task 10 boundary decision): strict comparison `next.start >= current.end` — reused verbatim, no new rule.
- **Midnight-crossing trips** are normalized to absolute minutes (Day 1 challenge approach) before the overlap check — timezone-safe.
- **Zero-duration trips** are excluded from overlap (Task 10 decision) — an instant cannot conflict.
- **Ordering:** R1 (state) → R2–R4 (overlap) → R5 (capacity). Capacity is last because it is the most expensive check and the least likely to fire.

## Complexity

Per candidate trip: **O(log n)** — existing trips are kept sorted by start time; overlap candidates are found via binary search on the interval start, then the local sweep (Task 10) runs on the few neighbors only. With 50 trips/week per captain, this is microseconds.

## Edge cases covered

1. Overlap with a Cancelled trip → allowed (R2). Overlap with In Progress → rejected (R4).
2. Illegal state change requested → rejected with `ILLEGAL_TRANSITION` (R1).
3. Adjacent times → allowed (Task 10 boundary rule).
4. Trip crossing midnight → normalized, still checked correctly.
5. Capacity at the boundary (exactly full) → rejected; duplicates in the employee list counted once (Task 9).

## Handoff to Day 5

The rule table maps 1:1 to the validation service in Task 57 (trip assignment business rules) and Task 66 (state-transition enforcement). The reason codes become the API error contract (409 + code + current/attempted state).
