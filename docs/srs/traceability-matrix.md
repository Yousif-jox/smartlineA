# Traceability Matrix — Day 1 → Day 2 SRS

**Task:** Day 2 — Task 19
**Rule:** 100% mapping coverage in both directions; no orphaned requirements. Day 1 items that no longer apply are marked "descoped" with a reason — never deleted silently.

---

## Day 1 Functional Requirements → SRS

| Day 1 item | Day 2 SRS ID | Status |
|------------|--------------|--------|
| FR-01 (create trip with vehicle + captain) | FR-001 | mapped |
| FR-02 (reject overlapping captain trip) | FR-002 | mapped |
| FR-03 (reject unavailable vehicle) | FR-003 | mapped |
| FR-04 (legal states only) | FR-004 | mapped |
| FR-05 (same-company assignment) | FR-005 | mapped |
| FR-06 (capacity) | FR-006 | mapped |
| FR-07 (no overlapping double assignment) | FR-007 | mapped |
| FR-08 (remove before completion) | FR-008 | mapped |
| FR-09 (assignment records) | FR-009 | mapped |
| FR-10 (no walk-on) | FR-010 | mapped |
| FR-11 (idempotent attendance) | FR-011 | mapped |
| FR-12 (attendance states, latest wins) | FR-012 | mapped |
| Scope S3 (wallet idempotent, non-negative) | FR-013, NFR-011 | mapped |
| Scope S4 (complaint lifecycle) | FR-014, FR-015 | mapped |
| Scope S5 (real-time status) | FR-016, NFR-002 | mapped |
| Scope S7 (notifications) | FR-017 | mapped |
| Scope S2 (trip lifecycle incl. cancellation) | FR-018 | mapped |
| Scope S6 (tenant isolation + RBAC) | NFR-009 | mapped |

## Day 1 Non-Functional Requirements → SRS

| Day 1 item | Day 2 SRS ID | Status |
|------------|--------------|--------|
| NFR-01 (300 ms p95 @ 5k RPS) | NFR-001 | mapped |
| NFR-02 (2 s dashboard) | NFR-002 | mapped |
| NFR-03 (500 ms @ 20M rows) | NFR-003 | mapped |
| NFR-04 (1,000+ companies / 10M employees) | NFR-004 | mapped |
| NFR-05 (horizontal scaling) | NFR-005 | mapped |
| NFR-06 (location ingestion) | NFR-006 | mapped |
| NFR-07 (99.9%) | NFR-007 | mapped |
| NFR-08 (Redis outage safe) | NFR-008 | mapped |
| NFR-09 (404, no existence leak) | NFR-009 | mapped |
| NFR-10 (hashing, no secrets, TLS) | NFR-010 | mapped |
| NFR-11 (wallet exactly-once) | NFR-011 | mapped |
| NFR-12 (no overbooking) | NFR-012 | mapped |
| — (new, maintainability) | NFR-013, NFR-014 | added (from Day 2 requirement 18) |

## Business Rules → SRS

| Day 1 item | SRS ID(s) | Status |
|------------|-----------|--------|
| BR-1 (tenant chain: company→branch→route) | FR-005, FR-009 | mapped |
| BR-2 (assigned-only boarding) | FR-010 | mapped |
| BR-3 (capacity) | FR-006 | mapped |
| BR-4 (no double-booking, captain + employee) | FR-002, FR-007 | mapped |
| BR-5 (wallet non-negative, exactly-once) | FR-013, NFR-011 | mapped |
| BR-6 (cross-tenant 404) | NFR-009 | mapped |
| BR-7 (legal transitions) | FR-004, FR-018 | mapped |
| BR-8 (attendance decoupled from trip) | FR-012 | mapped |

## Assumptions → SRS (each traceable to a later decision)

| Assumption | Affects SRS | Checked on |
|------------|-------------|------------|
| A1 single branch per employee | FR-005 (scope of "same company/branch") | Day 3 (ERD), Day 4 (RBAC) |
| A2 pickup location entity | FR-007 (assignment context) | Day 3 (ERD) |
| A3 pickup company-scoped | NFR-009 | Day 3 (multi-tenancy) |
| A4 one branch per trip | FR-001 | Day 3 (ERD) |
| A5 one vehicle per trip (flagged, riskiest) | FR-001, FR-003, FR-018 | Day 3 (state machine / ERD) |
| A6 captain records attendance | FR-010, FR-011 | Day 3 (ERD), Day 5 (auth) |
| A7 flat fare, auto-charge, company pays | FR-013 | Day 3 (wallet), Day 4 (API) |
| A8 balance never negative | FR-013 | Day 3 (constraint) |

## Open Questions (flagged, not silently resolved)

| Question | Blocks / affects | Status |
|----------|------------------|--------|
| E3, E4 (employees) | FR-005, FR-008 | flagged — pending PO |
| T4, T5, T6 (trips) | FR-001, FR-018, scope | flagged — pending PO |
| V1–V4 (vehicles) | FR-001, FR-003 | flagged — pending PO |
| W3, W4 (wallet) | FR-013 | flagged — pending PO |
| C1–C4 (complaints) | FR-014, FR-015 | flagged — pending PO |

## Descoped items

| Item | Reason |
|------|--------|
| (none so far) | No Day 1 requirement is being dropped; any future descope will be recorded here with a reason instead of being deleted |

---

**Coverage:** 12/12 Day 1 FRs, 12/12 Day 1 NFRs, 8/8 business rules, 8/8 assumptions — 100% mapped in both directions.
