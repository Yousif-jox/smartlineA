# Non-Functional Requirements — Smart Line

**Task:** Day 1 — Task 06 (Requirements Engineering)
**Context:** Smart Line must support 1,000+ companies, millions of trip records, and real-time driver tracking.
**Format:** Every NFR is measurable and independently verifiable (reused verbatim as acceptance criteria on Day 6).

---

## Performance

- **NFR-01** — Read API endpoints shall respond within **300 ms at the 95th percentile** under a load of **5,000 requests/second**.
- **NFR-02** — A trip status update submitted by a captain shall appear on company-manager dashboards within **2 seconds (P95)** of submission.
- **NFR-03** — List queries on large tables (e.g., an employee's trips for a week) shall return within **500 ms (P95)** against **20M+ rows**, using pagination.

## Scalability

- **NFR-04** — The system shall support **1,000+ companies and up to 10M employees** without degradation of the targets above.
- **NFR-05** — The API layer shall be horizontally scalable to **2+ instances behind a load balancer**, with no instance-local state required for correctness (sessions, rate limits, realtime channels).
- **NFR-06** — The system shall ingest **1,000–2,000 driver location updates/second at peak** (10,000 captains sending every 5–10 s) without degrading unrelated API latency.

## Availability

- **NFR-07** — Service availability shall be **99.9% per month** (≈43 min downtime budget), excluding scheduled maintenance windows.
- **NFR-08** — A Redis outage shall not cause permanent data loss or incorrect state: realtime clients fall back to polling, and wallet balances are never served from a stale cache.

## Security

- **NFR-09** — Cross-tenant access shall be structurally impossible: a request for a resource of another company shall return **404 without confirming the resource exists**.
- **NFR-10** — Passwords shall be hashed with a strong algorithm (bcrypt/argon2); no secrets, tokens, or raw credentials shall appear in code, logs, or Git history; all traffic shall use TLS.

## Reliability & Data Integrity

- **NFR-11** — Wallet transactions shall be **exactly-once**: retried or concurrent duplicate requests shall never create a duplicate financial transaction.
- **NFR-12** — Overbooking shall be impossible: concurrent assignment requests shall never double-book a captain or exceed vehicle capacity.

---

## Reconciliation of Conflicting NFRs

| Conflict | Resolution | Trade-off accepted |
|----------|-----------|--------------------|
| **Wallet strong consistency (NFR-11) vs low latency** | Wallet writes use transactional, constraint-based guarantees (unique idempotency key + non-negative balance check). The latency cost is accepted **only** on the wallet path; non-financial reads may be cached. | Higher latency and more lock contention on wallet operations; guaranteed financial correctness. |
| **Real-time attendance (NFR-02) vs offline industrial zones** | Attendance events are captured offline with client-generated event IDs and synced later; deduplication by event ID makes the sync safe. Dashboard may show a "pending sync" state. | Attendance freshness can lag behind network recovery; requires idempotent ingestion logic (Task 13). |

## Acceptance Summary

12 NFRs across 5 categories (Performance, Scalability, Availability, Security, Reliability), each with a measurable target and a stated reconciliation where targets conflict. These numbers become the Day 6 test thresholds.
