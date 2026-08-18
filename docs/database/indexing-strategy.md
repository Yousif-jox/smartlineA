# Indexing Strategy — Smart Line

**Task:** Day 3 — Task 37
**Rule:** every index must justify the query it serves, its expected selectivity, and its write cost. No index without a query; no query without an index.

---

## The indexes (migration 002)

| # | Index | Query it serves | Selectivity | Write cost |
|---|-------|-----------------|-------------|------------|
| 1 | `trip(captain_id, trip_date, start_time, end_time)` | captain overlap detection (Task 10/38) + dispatch "captain's day" | **High** — few trips per captain per day | Low (trip inserts) |
| 2 | `trip(company_id, trip_date)` | manager dashboard "today's trips" (NFR-003) | High — bounded by company+day | Low |
| 3 | `trip(vehicle_id, trip_date, start_time, end_time)` | vehicle double-booking guard (FR-003) | High | Low |
| 4 | `trip_employee(employee_id, trip_id)` | employee's trips + same-day overlap (FR-007) | High | Medium (assignment churn) |
| 5 | `wallet_transaction(wallet_id, created_at DESC)` | wallet history listing (NFR-003) | High | Medium (financial writes) |
| 6 | `route_stop(route_id, position)` | route stop ordering (Task 12) | High | Low (route edits rare) |
| 7 | `employee_pickup(employee_id) WHERE is_default = 1` — **partial** | pickup clustering (Task 11) reads only defaults | **Very high** — tiny index, one row per employee | Negligible |
| 8 | `vehicle(company_id, status, capacity)` | best-fit allocation (Task 43) | Medium — filtered by status | Low |
| 9 | `attendance_event(attendance_id, ts)` | latest-event-wins resolution (Task 13) | High | Medium (event stream) |
| 10 | `complaint(company_id, state, priority)` | call-center queue (FR-015) | Medium | Low |

## Key decisions (documented)

- **Composite over single (index 1 vs 3):** captain overlap and vehicle conflict are *time-range* queries — the composite (id, date, start, end) lets the planner scan one captain's day and sort locally. Two single-column indexes would force a bitmap OR and a bigger sort.
- **Partial index (7):** clustering reads only the *default* pickup per employee (A2). A partial index is a fraction of the size with identical query semantics — free win.
- **Why not index `attendance(trip_id, employee_id)`?** It already IS the table's UNIQUE constraint — the PK-adjacent unique index covers the lookup; adding another would be pure write overhead.
- **Write cost honesty:** indexes 4, 5, 9 sit on high-churn tables (assignments, transactions, events). Each is justified by a tested requirement; the Day 6 load test (NFR-006 location ingestion) will validate the trade-off empirically.

## Scaling note

At 20M+ trip rows, index 2 (`company_id, trip_date`) stays small per tenant — that is the point of tenant-scoped indexing: hot paths never scan the global table (complement to Task 40 partitioning).
