# Day 1 — Daily Report

## 1) What did I complete?

- **Requirements baseline:** glossary of all 14 named entities (each with purpose + at least two relationships), 23 clarification questions grouped by domain (Employees / Trips / Vehicles / Wallet / Complaints), 8 assumptions with risks, 5 actors with concrete capabilities, 12 functional requirements (FR-01–FR-12), 12 non-functional requirements (NFR-01–NFR-12), 3 conflict analyses with resolutions, scope boundary (7 in / 6 out), and the consolidated `baseline.md`.
- **Algorithm tasks (09–13):** vehicle capacity validation, captain trip-overlap detection (sort-based), pickup-point clustering (haversine + BFS), route stop ordering (nearest-neighbor heuristic), and attendance aggregation (idempotent, out-of-order safe).
- **Practical challenge:** Trip Conflict Detector — per-captain conflict pairs + summary count, reusing the Task 10 overlap logic without duplication; handles midnight-crossing trips and cross-date comparisons via absolute-minute normalization.
- **Tests:** 45 unit tests passing via `npm test` (Node built-in test runner, zero external dependencies).

## 2) What did I fail to complete?

- **Handwritten deliverables:** the planning sheet and the scope map (Task 15) are content-ready but the physical hand-writing + photograph step is pending — they are not yet committed to `docs/handwritten/`. This is my biggest gap today; it must land before I consider the day done (assessment rule 3).
- **GitHub:** the repository is not yet created/pushed. Planned as `feature/day-1-requirements` with separate commits for docs, algorithms, challenge, and tests.

## 3) What problems did I face?

- My own test run caught **4 failures on the first pass**:
  1. A real bug in the attendance resolver — I was comparing timestamps against a stored status string instead of the full event record, so "latest timestamp wins" silently failed.
  2. A misread of the assessment's own example ("unless timestamps say otherwise") — my first test asserted the wrong expectation; the rule is latest-timestamp-wins, and I rewrote the test to encode the rule.
  3. A performance test whose generated data did not actually create overlaps — fixed the data, not the code.
  4. A duplicate-IDs edge case needed the decision "count unique employees per trip" — resolved and tested.
- All four are fixed; the suite is green.

## 4) What decisions did I make?

- Duplicate employee IDs inside one trip are counted **once** (a duplicated ID is the same person).
- Adjacent trips (one ending 08:00, next starting 08:00) are **not** an overlap; zero-duration trips are excluded from conflict detection (an instant cannot conflict) — both documented in `src/algorithms/day1/README.md`.
- Pickup points **exactly at** max distance are connected (inclusive `<=`).
- Route ordering uses **nearest-neighbor with an id tie-break**, justified against exact TSP (documented — 25! is impossible, Held-Karp is too heavy, NN is instant and near-optimal on realistic clustered routes).
- Attendance: **latest timestamp wins**; identical timestamps tie-break by **eventId** so the result is deterministic and order-independent.
- **A5 (one vehicle per trip) is my least-confident assumption** — I kept vehicle identity isolated inside the assignment layer so a mid-trip change stays contained.
- Walk-on boarding is rejected (business rule); an employee may hold two same-day trips only if they don't overlap.

## 5) What assumptions did I make?

- A1 — one branch per employee (branch optional).
- A2 — pickup location is its own entity; several per employee, one default.
- A3 — pickup locations are company-scoped.
- A4 — one trip = one branch.
- A5 — one vehicle per trip for its full duration (**riskiest**).
- A6 — the captain is the only attendance writer.
- A7 — flat per-trip fare, auto-charged on completion, company pays.
- A8 — wallet balance never negative.

(Full risk analysis in `docs/requirements/assumptions.md`.)

## 6) What would I improve?

- Do the handwritten planning sheet **first thing** tomorrow-like days — rule 3 wants it committed before implementation, and I drafted content first, leaving the photo step for late in the day.
- Add an adversarial performance test for the overlap detector (all-nested intervals) to prove the sweep's early-break behavior.
- Route ordering: 2-opt refinement is a cheap upgrade over plain NN — noted as future work, not required today.

## 7) What did I learn?

- The assessment's example ("unless timestamps say otherwise") taught me to encode the **stated rule** in tests rather than my first reading of an example — and that a passing-looking test can still assert the wrong thing.
- The idempotency bug I introduced (storing the status instead of the full event) is exactly the bug class the wallet task (39) will care about: comparisons need the whole record, not a projection.
- Sort-based sweeps with an early break beat blind pairwise comparison, and honest complexity notes (O(n log n) sort + O(k) reported pairs) matter more than claiming a flat number.
