# Trip Assignment — API Business Rules

**Task:** Day 4 — Task 57
**Goal:** define the API-side validation of `POST /trips/{id}/assignments` — the exact order of checks, which layer is *primary* (UX) and which is *defense in depth* (guarantee), and the dual-failure behavior.

---

## Check order (cheap → expensive, matching the Day 2 rule table)

| # | Check | Rule (Day 2/3) | Failure → status |
|---|-------|----------------|------------------|
| 1 | Trip state allows assignment | Task 25 machine (Scheduled/Assigned) | 409 `ILLEGAL_TRANSITION` |
| 2 | Employee belongs to the same company | FR-005 + tenant binding (Task 53) | 404 (no existence leak) |
| 3 | Captain schedule has no overlap | R2–R4 table + Task 38 query | 409 `CAPTAIN_OVERLAP` / `CAPTAIN_BUSY` |
| 4 | Vehicle is available | FR-003 + `status='available'` | 409 `VEHICLE_UNAVAILABLE` |
| 5 | Capacity not exceeded | Task 9 semantics + best-fit (Task 43) | 409 `CAPACITY_EXCEEDED` |
| 6 | Employee has no overlapping assignment | FR-007 (overlap logic, Task 10) | 409 `EMPLOYEE_OVERLAP` |

Rationale: state and tenant checks are O(1) and catch most invalid requests cheaply; capacity is the most expensive (aggregate count) and fires last; the DB (UNIQUE/CHECK/EXCLUDE — Day 3) is the final guard for the race window between checks 3–6 and the commit.

## Primary vs defense in depth (the interview distinction)

| Layer | Role |
|---|---|
| **API validation (this doc)** | **Primary** — friendly UX: precise codes, no waits, no deadlocks |
| **Transaction + FOR UPDATE (Task 38)** | Defense 1 — serializes the race window |
| **DB constraints (EXCLUDE, UNIQUE, CHECK — Day 3)** | Defense 2 — impossible-by-construction, even with a buggy app (proven by the Day 3 challenge test) |

The API check is *not* the security boundary; it exists so clients get good errors. The security boundary is the schema.

## Dual failure behavior

If two rules fail at once (e.g., state illegal AND capacity exceeded):

- The response carries **one** primary error — the **first rule in the order** that failed (state) — with `details` listing the secondary failures found.
- No partial writes ever: the service validates everything before a single INSERT (Task 47 layering).
- Client retry semantics: fix the primary error, re-submit; the request stays idempotent from the client's perspective.

## Consistency

- Reuses the Day 2 challenge rule table (reason codes identical: `ILLEGAL_TRANSITION`, `CAPTAIN_OVERLAP`, `CAPTAIN_BUSY`, `CAPACITY_EXCEEDED`).
- Reuses the Task 38 transaction verbatim; the 409 envelope per Task 54; the OpenAPI path in Task 51.
- Day 5 (Task 67) implements this exact order; Day 6 (Task 77) tests it, including the concurrency case.
