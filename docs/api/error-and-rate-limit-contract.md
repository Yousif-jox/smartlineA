# Error Handling & Rate Limiting Contract — Smart Line

**Task:** Day 4 — Task 54

---

## The error envelope (every error, everywhere)

```json
{
  "error": {
    "code": "TRIP_ILLEGAL_STATE",
    "message": "Transition Completed -> Started is not allowed",
    "details": { "currentState": "Completed", "attemptedState": "Started" },
    "requestId": "req-9f2c..."
  }
}
```

- `code` — stable machine-readable identifier (API contract, not free text).
- `message` — human-readable, **never leaks internals** (no stack traces, no SQL).
- `details` — optional structured context.
- `requestId` — correlation ID, echoed in logs (NFR-013); the only thing support needs to trace.

## Status-code mapping

| Code | Meaning | Examples |
|---|---|---|
| 400 | Malformed request | bad JSON, unknown parameter |
| 401 | Unauthenticated | missing/expired token |
| 403 | Authenticated but role denied | captain tries to assign employees (Task 52 matrix) |
| 404 | Not found **or tenant-hidden** | cross-tenant ID — identical response (NFR-009, Task 53) |
| 409 | State/conflict error | illegal trip transition (with current/attempted), capacity exceeded, overlap, idempotency-key mismatch (Task 39) |
| 422 | Validation error | schema violation (request body), invalid state value |
| 429 | Rate limited | + `Retry-After` header |

## Rate limiting

| Dimension | Limit | Justification |
|---|---|---|
| Per-user (authenticated) | 100 req/s, burst 200 (token bucket) | NFR-001 budgets 5,000 RPS across instances; per-tenant fairness |
| Per-IP (anonymous) | 50 req/s, burst 100 | abuse control for unauthenticated surface |
| Captain attendance events | 120 req/s (higher burst) | legitimate burst after offline reconnect (Conflict 1, Day 1) |

- **Shared counters in Redis** — a per-instance counter is meaningless with 2..n instances (NFR-005); the Redis counter is the same across instances (Task 55 uses the same Redis).
- **429 responses** carry `Retry-After` (seconds); clients back off — no retry storms.
- Redis unavailable → rate limiting **fails open** with a log alert (availability NFR-07 over abuse control), not fail-closed.

## Edge cases

- **Validation vs conflict order:** schema validation (422) runs at the controller boundary; business-rule failures (409) come from services. A request with both problems returns 422 (cheap check first).
- **Idempotency-key mismatch** (same key, different body — Task 39) → 422 with a specific code (`IDEMPOTENCY_KEY_REUSED`), never a silent second write.
- **RequestId propagation** across queue consumers (Task 49): the message carries the originating requestId so a notification failure traces back to the API call that caused it.
