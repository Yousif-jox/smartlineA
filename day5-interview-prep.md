# Day 5 — Interview Preparation (إجابات جاهزة)

> ملف شخصي للتحضير — اقرأه، افهم، وأعد الصياغة بأسلوبك. كل الإجابات مبنية على كود حقيقي شغال: **99/99 اختبار أخضر على Supabase حقيقي**.

## 1) القصة في 60 ثانية

> "Today I implemented the backend that Days 3–4 designed. Real code, not a happy-path demo: five rollback-safe migrations verified on PostgreSQL, JWT with rotating refresh and RBAC, tenant isolation enforced by one middleware in every repository query — 404 for anything outside your tenant. The trip state machine rejects illegal transitions with 409 carrying the current and attempted states. The two flagship guarantees are proven by tests that actually ran: a concurrency test where two simultaneous captain assignments produce exactly one winner, and wallet transactions that are exactly-once through an idempotency-key unique constraint — retries return the original result, and the balance can never go negative. Full suite: 99 tests, 99 green."

---

## 2) أسئلة المقابلة — إجابات جاهزة

### Q1 — شغّل اختبار التزامن قدامي واشرحه (بوابة اليوم — لازم دي)
> "This is `tests/integration/assignments.test.js` — the Day-5 gate test. Two writers call `assign` on the same trip at the same moment, both wanting the same captain. In the service, the assignment runs inside a transaction that first does `SELECT ... FOR UPDATE` on the trip row — so the two writers serialize on the row lock. The first one re-reads capacity and the captain's overlap inside the lock, finds everything free, and commits. The second one, after the lock releases, re-reads the state — the trip is no longer in a schedulable state, or the slot is taken — and is rejected. The test asserts exactly one fulfilled and one rejected promise. I run it live: `npm test` — you'll see it pass every time, because the guarantee comes from the database row lock plus the EXCLUDE constraint, not from luck."

### Q2 — سطرًا بسطر: إيه اللي بيحصل لما نفس Idempotency-Key يتتبعت مرتين؟
> "Wallet transaction flow, `POST /wallets/:id/transactions` with header `Idempotency-Key: K`:
> 1. Request 1, key K, amount 50 → the service opens a transaction, takes `SELECT ... FOR UPDATE` on the wallet row, tries to insert the transaction row — the table has `UNIQUE(wallet_id, idempotency_key)` — insert succeeds, balance is updated in the same transaction, `CHECK(balance >= 0)` guards it, commit → 201 with the transaction.
> 2. Request 2, same key K, same body (the client lost the response and retried) → the insert violates the unique constraint, the whole thing rolls back, and the API returns the ORIGINAL transaction with 200 — no double debit, no error.
> 3. Same key K but a different amount → 422 `IDEMPOTENCY_KEY_REUSED` — a client bug surfaced loudly instead of silently debiting a different amount.
> 4. Two copies arrive concurrently → they serialize on the wallet row lock; one commits, the other hits the constraint and gets the original result.
> So: retries are harmless, mistakes are loud, and the guarantee is in the database — not in application checks."

### Q3 — فين بيتفرض عزل المستأجر، وليه بالظبط هناك؟
> "One middleware, `src/middleware/tenant.js`, extracts the company from the authenticated JWT and binds it to the request context. Every repository method receives that context and filters by `company_id` — there is no data-access path that doesn't carry the tenant, because routes only talk to services, services only talk to repositories, and repositories are the only place SQL touches the database. That's why it's systemic: I don't fix IDOR per endpoint, I remove the vulnerability class at the data-access boundary. A company-1 manager requesting company-3's employee gets zero rows → 404 — identical to 'not found', so there's no existence oracle (NFR-009). And on Day 6, database-level RLS will be the independent last layer that rejects even a buggy query."

### Q4 — الـ refactor رجعلك إيه؟
> "Task 73: I extracted two real duplications into shared utilities — `parseId()` and `wrap()` in `src/utils/http.js`. Before, every route handler repeated param parsing with a 422 envelope and a try/catch that forwarded to the error middleware; after, a route is one line: `wrap(async (req,res) => res.json(await service.getById(req.tenant, parseId(req.params.id))))`. Also the state-machine legality check is shared — one `isLegal` implementation per machine, used by services AND the test suites, so the tests can't drift from the code. The rule was strict: zero behavior change. I ran the suite before the refactor (82 green) and after (82 green), and `refactoring-notes.md` documents exactly what moved and why it's safe. What it bought: every new route is now 3 lines shorter and has no place to introduce a bug."

### Q5 — وريني commit بتصلح فيه غلط أنا اللي عملته.
> "The honest one is in the complaint tests. I initially wrote tests assuming `submitted → resolved` was legal — that matched an early draft. The state machine says resolved is only reachable via assign/escalate (Task 70). When the tests failed, I checked the machine definition and the machine was right — I fixed the tests to walk the legal path: `submit → assign → resolve`. Commit message: `test: walk legal complaint path in integration tests`. The lesson I state out loud: when tests disagree with the state machine, the machine wins — I write tests against the documented transitions, not against convenience. And the concurrency-test loosening is the second one: I initially asserted the loser gets `TRIP_CONCURRENT_UPDATE`, but the loser can legitimately observe `TRIP_ILLEGAL_STATE` depending on timing — I fixed the assertion to the invariant that matters: exactly one winner."

### Q6 — إيه النقطة اللي ماوصلتهاش، وترتيب أولوياتها إيه؟
> "Honestly: a live test of the shared Redis rate limiter across two instances. The middleware is written against Redis with per-user and per-IP counters, 429 with Retry-After, and it falls back to in-memory when Redis is absent — the fallback is what the suite exercises. There was no Redis instance in this environment, so the cross-instance behavior is design-verified, not execution-verified. Priority: 1) provision Redis and run the cross-instance counter test — that closes the only gap between designed and proven; 2) OpenAPI specs for the three new resources; 3) then Day-6's real work — the injected IDOR and the 4-second query, which I've already scoped from Day-4 notes."

### Q7 — ليه 99 اختبار على قاعدة بيانات حقيقية مش mock؟
> "Because the guarantees the assessment asks for — exactly-one-winner under concurrency, exactly-once wallet debits, tenant isolation with no existence leak — are database behaviors, not function behaviors. A mock can't prove a row lock works, or that the EXCLUDE constraint rejects overlap, or that the unique idempotency key makes retries harmless. Running against Supabase means the tests prove the real system: the same constraints, indexes, and isolation levels the production database will have. It also means re-runnability — every suite cleans up after itself, so I can run the full set repeatedly and it stays green."

---

## 3) بوابة اليوم 5 (احفظ دول)

1. **اختبار التزامن الحقيقي:** "طلبان متزامنان على نفس القبطان → الـ row lock يخلّي واحد بس يربح — والاختبار شغال قدامك."
2. **Exactly-once:** "Idempotency-Key فريد في الـ DB — إعادة الإرسال ترجع النتيجة الأصلية، والمبلغ المختلف 422، والرصيد لا يمكن أن يكون سالبًا."
3. **IDOR منهجي:** "middleware واحد يربط المستأجر + كل repository يحمله + 404 — مفيش رقعة لكل نقطة نهاية."
4. **المصفوفة الكاملة:** "409 مع currentState و attemptedState — والـ state machine هي اللي بتحكم، مش الاختبارات."

## 4) أرقام احفظها

99/99 اختبار أخضر · 45 Day-1 + 19 unit + 35 integration · 5 migrations + 5 rollbacks · UNIQUE(wallet_id, idempotency_key) · CHECK(balance >= 0) · EXCLUDE USING gist (tsrange) · 404 لا 403 · 100 req/s مستخدم · 50 req/s IP · 3 أدوار RBAC

## 5) قبل المقابلة

- [ ] شغّل `npm test` قدامك مرة كاملة (99/99) وخلّي النتيجة ظاهرة على الشاشة
- [ ] شغّل اختبار التزامن لوحده: `npx node --test tests/integration/assignments.test.js`
- [ ] اقرأ `docs/refactoring-notes.md` + `docs/implementation-summary.md` (قسم Deferred لو اتسألت)
- [ ] ارفع ورقة التخطيط اليدوية ليوم 5 (صورة) في `docs/handwritten/` + اعمل الـ push على `feature/day-5-implementation` (مرتين على الأقل)
- [ ] درّب نفسك على Q1 (شغل الاختبار واشرحه) وQ6 (النقطة اللي ماوصلتهاش) بصوت عالٍ
