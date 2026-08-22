# The Wallet Duplicate Error — Root-Cause Analysis (Day 6, Task 89)

## The reported symptom

A wallet charge applied **twice** for one request — the classic "duplicate
transaction" production bug.

## Root-cause class: TOCTOU (time-of-check to time-of-use)

The bug class lives in the naive "check then act" pattern:

```
1. read balance            <- check
2. if balance >= amount:   <- decision based on the check
3. INSERT transaction
4. UPDATE balance          <- act (seconds later, under load)
```

Two concurrent requests both pass step 2 (each read the same balance before
either wrote), then both execute 3–4 → **two debits for one logical charge**.
The check and the act are not atomic.

## Why the Day-5 implementation does NOT have the bug

Auditing `src/repositories/wallet.repo.js` — the order is:

1. `BEGIN`
2. `SELECT id, balance FROM wallet WHERE id = $1 FOR UPDATE`  ← the row lock
3. duplicate check (SELECT by `idempotency_key`) **inside the lock**
4. balance check **inside the lock**
5. `INSERT ... RETURNING` + `UPDATE wallet SET balance = balance - $1`
6. `COMMIT`

Two same-key requests **serialize on the wallet row lock** (step 2): the
second one, after the lock releases, re-reads the fresh balance AND sees the
first one's committed transaction row at step 3 → returns the **original**
transaction (200), never a second debit. The `UNIQUE(wallet_id,
idempotency_key)` constraint is the backstop if the lock were ever removed,
and `CHECK (balance >= 0)` is the final guard against a negative balance.

So: the TOCTOU was **designed out** on Day 3 (Task 39) and implemented
correctly on Day 5 (Task 68) — the row lock makes check-and-act a single
atomic critical section.

## The regression suite that would CATCH the bug if the lock were removed

`tests/integration/wallet-stress.test.js` (Day 6):

| Test | Invariant |
|------|-----------|
| 8 concurrent requests, same key | exactly **one** charge, 7 duplicates, balance debited once |
| 8 concurrent requests, different keys | **8** debits, balance exact |
| 5 parallel charges racing toward a 700 balance | **at most 2** winners, balance exactly 100, never negative |
| retry after success | same transaction id returned (200 semantics) |

If anyone "optimizes away" the `FOR UPDATE`, the racing tests fail — that is
the point of writing them now.

## Why it *would* have been intermittent (the interview answer)

Without the lock, the duplicate is **timing-dependent**: it only happens when
two requests arrive within the window between another request's check and its
write. Under low load the window is tiny (rarely observed → "intermittent");
under load it widens (queues, GC pauses, slow disks) and the duplicates
appear in bursts. That's why "duplicate wallet charges" is a classic
production mystery — it's invisible in a single-request test and loud under
concurrency.

## Interview one-liner

> "The duplicate-charge bug is a check-then-act race: read balance, decide,
> write later — two requests can both pass the check. The Day-5 wallet locks
> the row before check AND act, so the race cannot exist; the Day-6 stress
> suite proves exactly-one-charge under 8-way concurrency and would fail the
> moment someone removes the lock."
