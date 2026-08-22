# Day 3 — Interview Preparation (إجابات جاهزة)

> ملف شخصي للتحضير — اقرأه، افهم، وأعد الصياغة بأسلوبك. المقابلة بالإنجليزي غالبًا.

## 1) القصة في 60 ثانية (نطقها كده)

> "Today I turned the SRS into a relational database design: 19 entities, each justified by a requirement; a full ERD (hand-drawn first, then digitized); a complete DDL with CHECK constraints for both state machines and explicit ON DELETE; schema-level multi-tenancy; 10 justified indexes; two concurrency patterns — transaction locking for trip assignment and exactly-once idempotent wallet transactions; then scaling: monthly partitioning, soft deletes with audit triggers, cursor pagination, best-fit vehicle allocation, and idempotent seeds covering all trip states. The practical challenge proved the schema rejects captain double-booking at the database layer — I verified it on a real PostgreSQL instance."

---

## 2) أسئلة المقابلة السبع — إجابات جاهزة

### Q1 — Why does each entity exist?
> "Every entity maps to a tested requirement. Employee exists because FR-005/006/010 need assignment and attendance; PickupLocation exists because A2 and Task 11's clustering need shared points as first-class rows; Attendance is split into a final record plus an idempotent event log to realize Task 13's latest-timestamp-wins model and Task 26's freeze rule; WalletTransaction exists because FR-013 requires exactly-once charging with a unique idempotency key. If I can't name the requirement behind an entity, the entity doesn't belong in the schema."

### Q2 — Why this cardinality for Employee ↔ Trip?
> "N:M through TripEmployee. The junction is the assignment record — FR-009 says it's the single source of truth for attendance. FR-010 validates boarding against this record, so a walk-on is rejected even if the employee's route matches. And it keeps open question E3 answerable: whether cross-branch rides are legal is an application decision, not a schema change."

### Q3 — Why this index and what does it cost on writes?
> "Each index names its query. The captain schedule index (captain_id, trip_date, start, end) serves overlap detection and dispatch; it's composite because those are time-range queries — two single-column indexes would force a bitmap OR and a bigger sort. The default-pickup index is partial — clustering reads one row per employee, so the index is a fraction of the size. Honest cost: the three indexes on high-churn tables (assignments, transactions, events) add write overhead — that's the trade-off, and Day 6's load test will validate it empirically."

### Q4 — How does the schema prevent captain double-booking under concurrency?
> "Three independent layers. The application validates first — that's UX. Then the assignment transaction takes `SELECT ... FOR UPDATE` on the guardian row, serializing concurrent attempts — that closes the check-then-act race. And the exclusion constraint (`EXCLUDE USING gist` on captain_id + time range) makes the overlap impossible by definition — I proved it by bypassing the application entirely: a direct SQL insert of two overlapping active trips is rejected by the database, while overlapping Cancelled trips are allowed because they don't reserve the captain."

### Q5 — How does the wallet guarantee no duplicates?
> "`UNIQUE (wallet_id, idempotency_key)` is the guarantee, plus the balance updated in the same transaction under a row lock, plus `CHECK (balance >= 0)`. Proof by example: the same charge request retried — the first insert wins; the retry hits the unique constraint and returns the original result. Concurrent duplicates — one row, the rest rejected. Same key with a different body — explicitly rejected. Insufficient balance — the whole transaction rolls back, never a negative balance, never a half-applied ledger."

### Q6 — How does the system scale to 100 million rows?
> "Monthly range partitioning on Trips and Attendance: every hot query filters by date, so the planner prunes to 1–3 partitions. Old partitions are detached, not deleted — they move to cold storage while the wallet ledger stays fully queryable. List queries use cursor pagination — index-backed, O(page size) even at page 100,000, where OFFSET would scan two million rows. And every hot path is tenant-scoped by the direct company_id column, so no query ever scans the global table."

### Q7 — What changes if companies jump from 500 to 50,000?
> "The schema is already built for it. Tenant isolation is structural — company_id NOT NULL everywhere, direct column on trip, RLS policies bind to it — so 50,000 tenants don't change the design, only the row counts, and per-tenant hot paths stay small by construction. Partial indexes (default pickup, active phone) stay small per tenant. The real work would be operational, not structural: connection pooling, per-tenant RLS policy tuning, and observability at scale."

---

## 3) بوابة اليوم 3 — احفظ دول

- **الكيانات**: كل واحد مربوط بمتطلب (19 كيان)
- **العلاقات**: Employee↔Trip = N:M عبر TripEmployee (سجل التكليف = مصدر الحقيقة)
- **الفهارس**: 10 — كل واحد باستعلامه وتكلفته
- **التوسع**: قسمة شهرية + أرشفة DETACH + cursor + عزل بالمفتاح المباشر
- **التزامن**: 3 طبقات (تطبيق ← FOR UPDATE ← EXCLUDE) — مثبتة باختبار حي
- **السلامة**: UNIQUE idempotency + CHECK ≥ 0 + تدقيق بالترجير

## 4) قصص إضافية قوية (لو اتسألت "مشكلة واجهتك؟")

1. **قصة 42P17 (الأفضل):** "Migration 003 failed on the first real run — `tstzrange` in an index expression must be IMMUTABLE, and timestamp-to-timestamptz depends on the session timezone. I switched to `tsrange`: semantically correct because all our times are company-local, and immutable by construction. Lesson: test index expressions against the real engine, not the documentation."
2. **قرار RLS:** "Supabase offered to create the tables with RLS enabled — I took it. Owner bypasses RLS so our tests run unchanged, but the tables are never exposed to anon keys. Enabling it during migration costs nothing and removes a whole misconfiguration class later."

## 5) أرقام احفظها

19 جدول · 10 فهارس · 7 حالات Trip · 5 حالات حضور · 50 موظف · 10 رحلات · 3 معاملات محفظة بمفاتيح idempotency · `violating_rows = 0` · PASS 1/2/3

## 6) قبل المقابلة

- [ ] شغّل الاختبار مرة تانية قدامك (PASS 1/2/3 + 0) — عشان تحكي عنه بثقة
- [ ] اقرأ `docs/database/summary.md` (ملخص يوم 4) + `transactions/wallet-idempotency.md`
- [ ] ارفع كل ملفات يوم 3 على GitHub (`feature/day-3-database`)
- [ ] تأكد إن الـ ERD اليدوية + ورقة التخطيط في `docs/handwritten/`
