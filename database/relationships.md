# Relationships & Cardinalities — Smart Line

**Task:** Day 3 — Task 32
**Rule:** every relationship's cardinality is decided and justified; N:M relationships get a junction table; the hardest relationship (Employee ↔ Trip) is resolved explicitly.

---

## Cardinality map

| Relationship | Cardinality | Why |
|---|---|---|
| Company → Branch | 1 : N | BR-1: a company has several branches |
| Company → Employee | 1 : N | employees belong to a company (tenant) |
| Company → Wallet | 1 : 1 | A7: one wallet per company; UNIQUE on company_id |
| Company → Captain | 1 : N | captains are hired per company |
| Company → Vehicle | 1 : N | **A9 (company fleet):** vehicles belong to the company and float between branches — no branch_id on Vehicle |
| Company → PickupLocation | 1 : N | A3: pickup points are company-scoped |
| Branch → Employee | 1 : N | A1: one primary branch per employee (nullable FK) |
| Branch → Route | 1 : N | BR-1: routes are tied to a branch |
| Route → RouteStop | 1 : N | ordered stops (position) |
| RouteStop → PickupLocation | N : 1 | stops reference shared pickup points |
| Employee ↔ PickupLocation | **N : M** | A2 + shared points (Day 2 finding 2) → junction `EmployeePickup` with `is_default` |
| Employee ↔ Trip | **N : M** | assignment — resolved below |
| Trip → Route | N : 1 | one trip = one route execution (A4: one branch per trip) |
| Trip → Vehicle | N : 1 | A5: one vehicle per trip (per-trip binding, not permanent pairing — Day 2 finding 1) |
| Trip → Captain | N : 1 | one captain per trip; captain may have many trips (never overlapping — FR-002) |
| Trip → Attendance | 1 : N | attendance records per trip |
| Trip → WalletTransaction | 1 : N | charges reference the trip |
| Employee → Attendance | 1 : N | attendance per employee |
| Employee → Complaint | 1 : N | FR-014 |
| Wallet → WalletTransaction | 1 : N | financial ledger |
| Complaint → Account (agent) | N : 1 | handler; escalation to an Admin account |

## The hardest relationship — Employee ↔ Trip (resolved)

**Question:** is Employee ↔ Trip an N:M direct junction, or resolved through Route (the employee's default route) with a per-trip override?

**Decision:** **N:M direct via `TripEmployee`**, with route-based default resolution handled at the application layer.

**Why:**
- Attendance (FR-009) needs a *per-trip assignment record* as its single source of truth — the junction table IS that record (assigned_at / removed_at).
- FR-010 (assigned-only boarding) validates against the junction, not against a derived route match — a walk-on (unassigned) is rejected even if the employee's route matches.
- E3 (can an employee ride outside their branch's route?) stays an open question; a direct junction supports both answers without schema change (the app decides whether a non-default route is legal).
- Removing an employee (FR-008) is an update to the junction row (removed_at), not a delete — history preserved.

**Consequences:** capacity and overlap checks (Task 9/10 logic) query the junction; the employee-overlap guard is enforced here too (Day 7 incident 95 will add the exclusion constraint at this level — noted, not added today).

## Edge cases

- **Two trips, same vehicle, same day, non-overlapping times:** allowed (FR-003 is time-based, not day-based).
- **Employee in two same-day trips:** allowed only when non-overlapping (FR-007) — junction supports it; the app validates overlap.
- **Branch without routes / employee without branch:** both allowed by nullable/normalized design (edge cases from Task 31).
