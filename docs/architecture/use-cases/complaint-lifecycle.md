# Use Case Description — Submit and Resolve Complaint

**Task:** Day 2 — Task 22
**Related use case:** "Submit Complaint" / "Handle Complaint" / "Escalate Complaint" (Task 20)
**Actors:** Employee (submits), Call Center Agent (handles), Admin (escalation target)

---

## Preconditions

1. The Employee is authenticated (FR-014).
2. The complaint references a valid category and priority (C1 is an open question — see Assumptions; a default category is used until answered).

## Main Flow

1. The Employee submits a complaint with a category, priority, description, and optional attachment (FR-014).
2. The System creates the complaint in the "submitted" state and notifies the call center queue.
3. A Call Center Agent takes ownership of the complaint (FR-015).
4. The Agent investigates and updates the complaint with resolution notes.
5. The Agent marks the complaint resolved; the System notifies the complainant (FR-017 pattern).

## Alternate Flows

- **AF1 — Escalation (Agent → Admin):** if the complaint is high-priority, or the SLA is breached, or it involves a company-level issue, the Agent escalates it to an Admin. The Admin may resolve it directly or route it back to the call center with instructions. (Matches the escalation path in the use-case diagram — UC11.)
- **AF2 — Duplicate complaint for the same incident:** the System links the new complaint to the existing one instead of creating an independent record, so the call center handles one thread per incident.

## Exception Flows

- **EX1 — Complaint submitted without a category:** the System either requires a category or applies a documented default and flags it for review (the decision depends on open question C1; the default is recorded until the PO answers).
- **EX2 — Invalid attachment (wrong type / too large):** the complaint is still created, but the attachment is rejected with a clear error — a malicious file must never block the complaint (Task 84 security rule).

## Postconditions

1. The complaint has a complete, auditable lifecycle (submit → assign → escalate/resolve).
2. The complainant was notified of the resolution.
3. Resolved complaints are locked: only an Admin may edit them afterward (documented exception, C4-dependent; default: locked).

## Business rules enforced

FR-014 (submit), FR-015 (workflow with validated transitions), tenant isolation for complaint data (NFR-009), and the Call Center Agent's audited cross-company read (BR-6 exception, to be reconciled in Task 52/53).
