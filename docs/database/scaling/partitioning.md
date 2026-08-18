# Partitioning & Archival — Trips and Attendance

**Task:** Day 3 — Task 40 (Expert)
**Goal:** keep NFR-003 (≤ 500 ms at 20M+ rows) and NFR-004 (10M employees, millions of trips) true as the hot tables grow, and make archival mechanical.

---

## What is partitioned

- **trips** — RANGE partition by month on `trip_date`.
- **attendance** — RANGE partition by month on a denormalized `trip_date` column (see below).

Monthly ranges match the business query pattern ("this week", "this month", "last 45 days") and keep each partition small enough that scans stay local.

## Partition key decisions

| Table | Key | Why |
|---|---|---|
| trip | `trip_date` | every hot query filters by date (dashboard, dispatch, reporting) — partition pruning makes those queries touch 1–3 partitions |
| attendance | `trip_date` (denormalized) | attendance joins to trip by `trip_id`, but the *month* boundary must be on the partition key; a denormalized `trip_date` is written by the application at insert time, from the trip — justified denormalization (same policy as Task 34: explicit, documented, never updated) |

## Schema implications (FK and PK)

1. **PostgreSQL requires the partition key in every unique index** on a partitioned table → the trip primary key becomes `(id, trip_date)`.
2. **FKs referencing a partitioned table must include the partition key**:
   - `trip_employee (trip_id, trip_date)` — kept as composite FK (assignment is a hot join, referential integrity matters).
   - `wallet_transaction → trip` — **FK dropped**, enforced in the application: wallet transactions are append-only financial records; a dropped trip reference is handled as `trip_id NULL` with the charge still valid. Justification: keeping the FK would force the partition key into the wallet table purely for referential cosmetics, and wallet history must never block trip archival (below).
3. `attendance.trip_id` FK keeps the partition key via its own `trip_date` column — the FK is `(trip_id, trip_date)`.

## Boundary-spanning queries

"Last 45 days" spans 2–3 monthly partitions. The planner prunes by partition key automatically:

```sql
EXPLAIN (ANALYZE)
SELECT * FROM trip
WHERE company_id = $1 AND trip_date >= now() - interval '45 days';
-- -> only the relevant monthly partitions are scanned (partition pruning)
```

## Archival & retention

1. A monthly partition older than the retention window (e.g., 12 months) is **detached**, not deleted:
   ```sql
   ALTER TABLE trip DETACH PARTITION trip_2025_08;
   ```
2. Detached partitions move to cold storage / archive schema (`trip_archive`), kept for audit and legal retention.
3. `audit_log` is **never partitioned by trip** — it is append-only and retained independently (it references entities, not trips).
4. The wallet ledger is **never archived by trip month** — financial history is immutable and must remain queryable; its growth is bounded by transactions, not by trip age (index 5 keeps reads fast).

## Edge cases

- **Mid-month schema change** (e.g., new column): `DEFAULT` partition for unpruned inserts + rolling monthly migrations — one month at a time, no table rebuild.
- **Insert with out-of-range date** (no matching partition): fails loudly by default (good — catches bugs), with an option to auto-create partitions for the current month via a trigger.
- **Report across many months** (annual summary): accepted as a heavier query — partition pruning still limits it to 12 partitions, far better than one 20M-row table.
