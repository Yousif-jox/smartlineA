# Queueing Strategy — Smart Line

**Task:** Day 4 — Task 49
**Rule:** synchronous APIs stay fast (NFR-001); anything slow, retryable, or fan-out lives on the queue. Delivery is **at-least-once**, so every consumer must be **idempotent** — that combination equals effectively-once.

---

## The three asynchronous operations

| Operation | Why async | Consumer idempotency |
|---|---|---|
| **1. Notify on Trip Cancelled** (FR-017) | fan-out to all assigned employees — blocking the API on push is unacceptable | `notification.event_id` UNIQUE (schema) — a redelivered message is a no-op |
| **2. Charge wallet on Trip Completed** (FR-013) | financial write with locking (Task 39) — don't hold the HTTP request | `UNIQUE(wallet_id, idempotency_key)` — retried charge is exactly-once |
| **3. Complaint escalation alert** (FR-015) | notify agent/admin + audit — non-critical path | dedup by `event_id` in the message + notification dedup |

## Message contract — example: Trip Cancelled → Notify

```json
{
  "eventId": "evt-9f2c...",        // global unique — the idempotency key
  "type": "trip.cancelled",
  "occurredAt": "2026-08-19T06:10:00Z",
  "tripId": 3,
  "companyId": 2,                  // tenant context travels with the message
  "recipients": [41, 42, 43],      // assigned employee account ids
  "reason": "captain_unavailable"
}
```

The consumer: (1) checks `notification.event_id` unique → insert or no-op; (2) writes the notification rows; (3) acks. A crash between insert and ack → redelivery → unique constraint → no-op. **Effectively-once.**

## Retry & dead-letter policy

- **Retry:** exponential backoff (1s → 2s → 4s → 8s), max 3 attempts, for transient failures (DB connection, Redis).
- **Dead-letter queue (DLQ):** after 3 attempts the message moves to DLQ with the original payload + error. A DLQ alert fires to on-call (Day 7 incident tooling).
- **Poison messages** (malformed payload): straight to DLQ, never retried.

## Edge cases

- **Worker crash mid-notify:** redelivery + unique event_id → no duplicate notifications (FR-017).
- **Queue down:** the API publishes with a bounded in-process retry + a persisted outbox pattern (events written to the DB in the same transaction as the domain change, drained by a worker) — the API never loses a domain event. (Outbox is the reliability answer to "queue as SPOF".)
- **Ordering:** notification fan-out has no ordering requirement; wallet charges per wallet are serialized by the row lock (Task 39), not by queue ordering.

## Consistency references

- Wallet charge consumer reuses the exact Task 39 transaction.
- Outbox rows reuse the audit_log write path (Task 41) — same transactional pattern.
- The 3 ops map to FR-013/FR-015/FR-017 and to the Day 6 failure-mode tests.
