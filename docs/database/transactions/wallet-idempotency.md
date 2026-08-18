# Idempotent Wallet Design — exactly-once charging

**Task:** Day 3 — Task 39 (Expert — highest-weighted task in the Database category)
**Problem (from the Morning Brief):** a retried charge request creates a duplicate financial transaction. Duplicate charges are a critical-failure class — a client dispute is guaranteed.

**Non-negotiable rule:** a charge is applied **exactly once**, no matter how many times the same request is retried, and no matter how many copies arrive concurrently.

---

## The design

```sql
-- wallet_transaction (from migration 001)
UNIQUE (wallet_id, idempotency_key)        -- the guarantee

-- wallet (from migration 001)
balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0)   -- A8: never negative
```

The charging transaction:

```sql
BEGIN;

-- 1. Serialize on the wallet row (denormalized balance lives here — Task 34)
SELECT id FROM wallet WHERE id = $1 FOR UPDATE;

-- 2. Insert the transaction; the UNIQUE(wallet_id, idempotency_key)
--    constraint is the exactly-once gate
INSERT INTO wallet_transaction (wallet_id, idempotency_key, amount, type, trip_id)
VALUES ($1, $2, $3, 'charge', $4);

-- 3. Update the denormalized balance in the SAME transaction
UPDATE wallet SET balance = balance - $3, updated_at = now() WHERE id = $1;

COMMIT;   -- CHECK (balance >= 0) fails -> whole transaction rolls back
```

## Proof by example — the same request arrives twice

| # | Request | What happens | Result |
|---|---------|--------------|--------|
| 1 | `POST charge {idempotency_key: "K-1", amount: 50}` | insert succeeds; balance 100 → 50 | **applied once** |
| 2 | Same `idempotency_key: "K-1"` (retry — e.g., response was lost) | `UNIQUE(wallet_id, "K-1")` violation → caught → return the original transaction result | **no duplicate** |
| 3 | Same key but *different* amount (`amount: 500`) | unique constraint fires → **reject with an explicit error** (key reuse with different body is an API bug, never a silent second charge) | **rejected** |
| 4 | Two copies arrive concurrently | both attempt step 2; one blocks on the wallet row lock; after the first commits, the second hits the unique violation | **one row** |

## Why each element exists

1. **`UNIQUE(wallet_id, idempotency_key)`** — the guarantee itself: the database rejects the second insert, regardless of application logic (defense in depth against TOCTOU).
2. **`FOR UPDATE` on the wallet row** — serializes the read-modify-write of the denormalized `balance` (Task 34); without it, two charges could both read 100 and both write 50 (lost update).
3. **`CHECK (balance >= 0)`** — the final guard: even if everything else fails, a charge that would drive the balance negative is rejected and the whole transaction rolls back (A8). The ride itself is never affected (Day 2 interview answer: pending-charge + notify manager).
4. **Same-transaction insert + update** — the ledger and the balance can never diverge: they commit or roll back together.

## Failure modes handled

- **Request succeeded but response lost** → client retries with the same key → case 2 → client gets the original result. Exactly-once from the client's perspective.
- **Concurrent duplicates** → case 4 → one row wins, the rest are rejected by the constraint.
- **Insufficient balance** → CHECK fails → transaction rolls back → the charge is recorded as `failed`/pending (out-of-band), manager notified (Day 2 Q7 answer) — never a negative balance, never a half-applied ledger.
- **Key collision across different trips** → the key is generated per operation (trip_id + random suffix) — collisions are cryptographically improbable and, if they ever happen, the unique constraint surfaces them loudly instead of double-charging.

## What this design deliberately does NOT do

- No app-level "SELECT then INSERT" check as the mechanism (TOCTOU race — the Morning Brief's incident).
- No balance update without the same-transaction insert (lost-update / divergence).
- No per-company key — the key is per **wallet** (the UNIQUE is `(wallet_id, key)`), which keeps retry semantics scoped to the account that owns the charge.
