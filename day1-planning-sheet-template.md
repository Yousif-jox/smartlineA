# Day 1 — Planning Sheet

**Name:**Yousif &nbsp;&nbsp; **Task:** 02 / 03 + 15 &nbsp;&nbsp; **Date:** ____________

---

## 1) Problem Understanding

Smart Line = employee transport for companies, not individual riders.

Business chain: companies → branches → employees → pickup points → captains → vehicles → routes → trips → attendance → wallet → complaints → call center → notifications → admin.

Goal: requirements baseline for Day 2. No DB, no code today.

## 2) Assumptions (working with these until the PO answers)

- A1 — one branch per employee (branch optional)
- A2 — pickup location = own entity; several per employee, 1 default
- A3 — pickup locations belong to one company only
- A4 — one trip = one branch
- A5 — one vehicle per trip, fixed for the whole trip (riskiest — breakdowns happen)
- A6 — captain records attendance (only writer)
- A7 — flat fare per trip, auto-charged on completion, company pays
- A8 — wallet balance never negative

## 3) Open Questions for the PO (15)

- Employees: E3 — trip outside own branch? | E4 — future trips when employee leaves?
- Trips: T4 — parallel trips, same route? | T5 — cancel/refund rules? | T6 — on-demand or schedule?
- Vehicles: V1 — fixed route or per trip? | V2 — which attributes matter (maintenance/license)? | V3 — shared between branches? | V4 — breakdown mid-route?
- Wallet: W3 — who triggers charge? | W4 — refund after cancel?
- Complaints: C1 — categories/priorities? | C2 — anonymous or linked? | C3 — escalation + SLA? | C4 — reopen resolved?

## 4) First-pass Entities (14)

Company · Branch · Employee · PickupLocation · Captain · Vehicle · Route · Trip · Attendance · Wallet · Complaint · CallCenter · Notification · Admin

## 5) Scope Map (Task 15) — draw by hand

- Boundary box: "Smart Line System"
- Outside (actors): Company Manager, Employee, Captain, Call Center Agent, Admin → arrows into the system
- Inside (subsystems): Trip Management, Wallet, Complaints, Notifications, Admin Panel, Core Data
- Must match actors (Task 04) and entities (Task 01)
