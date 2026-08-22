# Trip State Transition Diagram — Smart Line

**Task:** Day 2 — Task 25
**Purpose:** The definitive lifecycle of a Trip. This model becomes the database CHECK constraint on Day 3 and the API validation rule on Day 5. It must be unambiguous — the 7 states and every legal/illegal transition are listed explicitly.
**Hand-drawn first-pass:** Day 2 planning sheet (Section 4) — photographed in `docs/handwritten/`.

---

## States (7)

`Scheduled` · `Assigned` · `Started` · `In Progress` · `Completed` · `Cancelled` · `Failed`

## Legal Transitions

| From | To | Trigger |
|------|-----|---------|
| Scheduled | Assigned | Employees assigned to the trip (FR-005..FR-007) |
| Scheduled | Cancelled | Cancelled before any assignment |
| Assigned | Started | Captain starts the run |
| Assigned | Cancelled | Cancelled after assignment, before start |
| Started | In Progress | Trip underway (en route) |
| Started | Failed | Breakdown reported immediately after start |
| In Progress | Completed | All stops delivered, trip finished |
| In Progress | Cancelled | Mid-route cancellation (e.g., road closure) |
| In Progress | Failed | Breakdown / cannot complete |

**Terminal states:** Completed, Cancelled, Failed — no outgoing transitions.

## Illegal Transitions (explicitly rejected)

- **Completed → anything** — a finished trip cannot change.
- **Cancelled → anything** — including `Cancelled → Scheduled`.
- **Failed → anything** — including reopening a failed trip.
- **Scheduled → Started / In Progress / Completed / Failed** — skips mandatory states.
- **Assigned → In Progress / Completed / Failed** — skips Started.
- **Started → Completed / Cancelled** — Started is a transitional state; completion requires In Progress.
- **Any state → Completed except In Progress** — completion is only reachable from In Progress.

## Decisions (documented, interview-ready)

1. **Rescheduling is NOT `Cancelled → Scheduled`.** Cancelling and re-creating are two separate operations: a cancelled trip is terminal, and a new trip is created if the route must run later. One legal path keeps the state machine and the audit trail simple.
2. **A Failed trip cannot be reopened.** The failure is investigated, and a new trip is created after the cause is resolved. Reopening would blur the boundary between historical fact and current state.
3. **Mid-route cancellation (In Progress → Cancelled) is legal** and has defined effects: attendance already recorded is preserved; unrecorded employees are finalized to Cancelled (see attendance-state-machine.md). The wallet charge is not triggered for a cancelled trip (FR-018).
4. **Started is deliberately short-lived** — it marks the captain's explicit "run begins" action; the operational state is In Progress. This gives the dashboard a crisp "the vehicle is moving" signal (NFR-002).

## Consistency

- Enforced at the application layer (Day 5, Task 66 — 409 with current/attempted state).
- Enforced at the database layer (Day 3, Task 35 — CHECK constraint; defense in depth).
- FR-004 (legal states only), FR-018 (cancellation effects), BR-7.
- Visual: `docs/architecture/trip-state-machine.puml`.
