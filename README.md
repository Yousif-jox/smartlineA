# Smart Line Assessment — Day 1

Smart Line is an employee-transportation management platform for companies.
This repository contains the 7-day engineering assessment work, built as **one
evolving system** — every day builds on the previous day's artifacts.

## Day 1 — Requirements & Problem Solving

Deliverables:

- `docs/requirements/` — requirements baseline: glossary (14 entities), actors (5),
  clarification questions (23), assumptions (A1–A8), functional requirements
  (FR-01–FR-12), non-functional requirements (NFR-01–NFR-12), conflict analysis,
  scope boundary, and the consolidated `baseline.md`.
- `src/algorithms/day1/` — Tasks 09–13: vehicle capacity, trip overlap,
  pickup-point clustering, route stop ordering, attendance aggregation
  (with design notes in `README.md`).
- `src/challenges/trip-conflict-detector/` — Day 1 practical challenge.
- `tests/day1/` — 45 unit tests covering all edge cases.

## How to run the tests

```bash
npm test
```

Requires Node.js >= 18 (uses the built-in test runner, zero external dependencies).

## Docs

- Handwritten planning sheet & scope map: `docs/handwritten/` (photos).
