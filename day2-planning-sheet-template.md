# Day 2 — Planning Sheet (محتوى للنسخ بخط يدك — بالإنجليزي)

**Name:** ____________ &nbsp;&nbsp; **Task:** Day 2 planning &nbsp;&nbsp; **Date:** ____________

---

## 1) Use Cases to Model (12+)

- Create Trip (Manager)
- Assign Employee to Trip (Manager) — with capacity/overlap/state checks
- Update Trip Status / Start / Complete / Cancel (Captain)
- Record Attendance (Captain)
- View Trip Status (Manager + Employee — shared use case, no duplication)
- View Attendance (Manager, Employee)
- Submit Complaint (Employee)
- Assign / Resolve Complaint (Call Center Agent)
- Escalate Complaint (Agent → Admin)
- Manage Company / Branches / Routes (Manager, Admin)
- View Wallet & Transactions (Manager)
- Manage Users & Roles (Admin)

## 2) Actors per Use Case

- **Company Manager:** Create Trip, Assign Employee, View Status/Attendance/Wallet, handle escalated complaints
- **Employee:** View Trip Status, View Attendance, Submit Complaint, receive notifications
- **Captain:** Update Trip Status, Record Attendance, report breakdowns
- **Call Center Agent:** Assign/Resolve/Escalate complaints (cross-company read)
- **Admin:** Users/Roles, escalated complaints, audit, reference data

## 3) Trip State Diagram — first pass (sketch)

Scheduled → Assigned → Started → In Progress → Completed / Cancelled / Failed

Legal transitions (draft):
- Scheduled → Assigned, Cancelled
- Assigned → Started, Cancelled
- Started → In Progress
- In Progress → Completed, Failed
- Completed / Cancelled / Failed = terminal

Illegal (examples): Completed → anything; Cancelled → Started (reschedule = new trip); Failed → Completed.
Attendance is decoupled: Cancelled trip does not rewrite attendance.
