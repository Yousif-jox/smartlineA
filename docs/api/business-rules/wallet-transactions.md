# Wallet Transactions — Idempotency Contract

**Task:** Day 4 — Task 58
**Goal:** the HTTP contract for exactly-once wallet operations (Task 39 implemented at the API boundary).

---

## The contract

```
POST /wallets/{walletId}/transactions
Headers: Idempotency-Key: <uuid>     (required for charge/refund)
Body:    { "type": "charge"|"refund", "amount": 3000.00, "tripId": 9 }
```

| Request | Behavior |
|---|---|
| First request with key `K` | executes; **201** with the created transaction |
| Same key, same body (retry after lost response) | **200** with the ORIGINAL transaction — never a duplicate |
| Same key, different body | **422** `IDEMPOTENCY_KEY_REUSED` — a client bug, surfaced loudly |
| Missing key | **422** `IDEMPOTENCY_KEY_REQUIRED` |
| Concurrent copies with the same key | one wins (unique constraint); the losers get the original result — exactly-once under concurrency |

## Why it works (API view of Task 39)

- The key maps to `UNIQUE (wallet_id, idempotency_key)` in the schema — the *database* rejects the second insert; the API catches the violation and returns the original record (a follow-up SELECT by key).
- The balance update is in the same transaction as the insert (Task 39), so a successful response always reflects the applied balance.
- `tripId` links the charge to the completed trip (FR-013); refunds carry the originating transaction reference.

## Edge cases

- **Balance insufficient:** the transaction rolls back (CHECK ≥ 0); the API returns **409 `INSUFFICIENT_BALANCE`** with the shortfall; the ride and attendance are unaffected (Day 2 Q7 answer — manager is notified out-of-band).
- **Key scope:** the key is per wallet (not global) — two wallets can reuse the same key safely; the unique constraint is `(wallet_id, key)`.
- **Retry storm from the mobile client:** rate limiting (Task 54) caps retries; the idempotency key makes every retry safe regardless.

## OpenAPI snippet

```yaml
/wallets/{walletId}/transactions:
  post:
    summary: Create a transaction (exactly-once)
    parameters:
      - name: Idempotency-Key
        in: header
        required: true
        schema: { type: string, format: uuid }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [type, amount]
            properties:
              type: { type: string, enum: [charge, refund] }
              amount: { type: number, exclusiveMinimum: 0 }
              tripId: { type: integer }
    responses:
      '201': { description: Created }
      '200': { description: Duplicate key — original transaction returned }
      '409': { description: Insufficient balance }
      '422': { description: Validation / key reuse }
```

## Consistency

- Task 39 transaction (proof-by-example table) is the implementation.
- Day 5 Task 68 implements this contract; Day 6 Task 89 (the injected duplicate-wallet bug) verifies the regression.
