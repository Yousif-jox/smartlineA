# Smart Line Actors

**Task:** Day 1 — Task 04 (Requirements Engineering)
**Purpose:** Identify every actor who interacts with the system and the 3–5 most important things each one must be able to do. Capabilities are phrased as **user goals** ("view my company's employees"), not implementation details — this document feeds the Day 2 Use Case Diagram directly.

---

## 1. Company Manager
Manages a company's transportation operations end to end.
- View my company's employees and their daily attendance status
- Create and manage my company's branches, routes, and vehicles
- Schedule trips and assign employees to them
- View live trip status and my company's wallet balance and transactions
- Handle complaints escalated to my company

## 2. Employee
The person being transported — the core consumer of the service.
- View my assigned trips and pickup locations
- View my attendance history
- Submit a complaint about my transportation
- Receive notifications about my trip changes
- View my wallet charges (if the company model charges employees)

## 3. Captain
Operates trips and is the trusted on-the-ground recorder.
- View my trips and routes for today
- Change a trip's status (start, complete, cancel)
- Record employee attendance on my trip
- Report a vehicle breakdown or incident
- View my schedule to avoid overlapping assignments

## 4. Call Center Agent
Runs the support function across companies.
- View and take ownership of complaints across all companies (legitimate cross-tenant read)
- Update complaint status and resolution notes
- Escalate a complaint to an Admin
- Look up an employee or company to verify complaint details
- Close the loop with the complainant on resolution

## 5. Admin (Smart Line Platform)
Owns the platform itself, not any single company.
- Onboard and deactivate companies and their accounts
- Manage users, roles, and permissions
- Resolve escalated complaints
- Review audit logs and platform-wide data
- Configure reference data (complaint categories, priorities, etc.)

---

## Edge Cases

- **A user can hold multiple roles** (e.g., an Employee who is also a Company Manager). Capabilities are defined per role, and the system must scope every action by the role being used — not by a single global identity. The same person acts as "Employee" when riding and as "Manager" when scheduling.
- **An Employee's complaint can be escalated to a manager who is also an employee of the same company.** The escalation target acts under the Manager role (complaint handling), while the source acts under the Employee role (complaint submission). Roles must not be conflated.
- **Call Center Agent cross-tenant access** is the documented exception to tenant isolation: an agent may legitimately read employees/complaints of any company (a caller's company is not always known upfront). This exception must be reconciled in Tasks 52–53 without reopening the IDOR vulnerability — the agent's access is role-based and auditable, not a general tenant-bypass.

---

## Actor → Domain Mapping (feeds Day 2)

| Actor | Primary domains |
|-------|-----------------|
| Company Manager | Trips, Employees, Attendance (view), Wallet, Complaints (approval) |
| Employee | Trips (view), Attendance (view), Complaints, Notifications |
| Captain | Trips (status), Attendance (record), Vehicles (incidents) |
| Call Center Agent | Complaints (all companies), Employees/Companies (lookup) |
| Admin | Companies, Users/Roles, Complaints (escalation), Audit, Reference data |
