# Day 3 — Planning Sheet (محتوى للنسخ بخط يدك — بالإنجليزي)

**Name:** ____________ &nbsp;&nbsp; **Task:** Day 3 planning &nbsp;&nbsp; **Date:** ____________

---

## 1) Entities from the SRS (first pass — write the list)

Company · Branch · Employee · PickupLocation · Captain · Vehicle · Route · RouteStop · Trip · TripEmployee · Attendance · AttendanceEvent · Wallet · WalletTransaction · Complaint · Account · Notification · AuditLog

## 2) Cardinality guesses (sketch)

- Company 1:N Branch / Employee / Captain / Vehicle / PickupLocation · Company 1:1 Wallet
- Branch 1:N Employee / Route
- Employee N:M PickupLocation (junction, one default) · Employee N:M Trip (junction TripEmployee)
- Route 1:N RouteStop (ordered) · Route 1:N Trip
- Trip N:1 Route / Vehicle / Captain · Trip 1:N Attendance
- Wallet 1:N WalletTransaction · Trip 1:N WalletTransaction
- Employee 1:N Attendance / Complaint · Complaint N:1 Account (agent)

## 3) Trip state machine (for the CHECK constraint — quick sketch)

Scheduled → Assigned → Started → In Progress → Completed / Cancelled / Failed
(Cancelled/Completed/Failed = terminal; no transition out)

## 4) Hardest relationship (write the decision)

Employee ↔ Trip = N:M via TripEmployee (direct junction, not route-derived) — because attendance (FR-009) needs the assignment record as its single source of truth, and FR-010 (no walk-on) validates against it.

## 5) Two denormalizations (write which + why)

1. Trip.stops_snapshot (JSON) — history immutability; written once, never updated.
2. Wallet.balance — O(1) reads; updated transactionally with FOR UPDATE + CHECK >= 0.

---

## Task 33 — ERD handwritten (draw before digitizing)

- Boxes: all 18-19 entities with PK/FK marks
- Lines: cardinality labels (1:N / N:M via junction)
- Must match `relationships.md` — no new relationships invented
- Photo: name + "Task 33" + date visible → `docs/handwritten/day3-erd.jpg`
