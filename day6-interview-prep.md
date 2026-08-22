# Day 6 — Interview Preparation (إجابات جاهزة)

> ملف شخصي للتحضير — اقرأه، افهم، وأعد الصياغة بأسلوبك. كل الإجابات مبنية على كود حقيقي وإصلاحات فعلية: **129 اختبار وحدة/يوم-1 أخضر** + سويتات أمان ومحفظة على Supabase الحقيقي.

## 1) القصة في 60 ثانية

> "Day 6 هو يوم الاختبار والأمان والأداء: لقيت ثغرة حقيقية في كود يوم 5 — الـ read paths كانت معزولة، لكن الـ write paths كانت بتقبل مراجع من شركة تانية: مدير شركة A يقدر يعمل رحلة بقبطان من شركة B ويجسّ جدوله. أصلحتها بتحقق واحد من الملكية بيرجع 404 زي 'مش موجود' بالظبط. وضفت طبقة RLS على قاعدة البيانات كخط دفاع مستقل — دور محدود الصلاحيات من غير سياق المستأجر بيشوف صفر صفوف، ومع السياق بيشوف شركته بس. شخّصت استعلام الـ 4 ثواني: Sort على 20 مليون صف — فهرس مركب واحد `(company_id, trip_date, start_time)` بيشبع الفلتر والترتيب. واتعاملت مع الخطأين المحقونين: خطأ المحفظة المكرر سببه الجذري TOCTOU — مصمم خارجًا بالقفل من يوم 3 واختبارات الإجهاد بتثبت الخصم الواحد؛ وفشل التفويض المتقطع سببه `UNION` من غير `ORDER BY` — الاختيار بقي حتمي بدالة نقية. الإجمالي: 129/129 أخضر محليًا + سويتات التكامل على DB حقيقي."

## 2) أسئلة المقابلة — إجابات جاهزة

### Q1 — شغّل مجموعة عزل المستأجرين قدامي واشرحها (بوابة اليوم — لازم دي)
> "This is `tests/integration/tenant-isolation.test.js`. Four tenant-scoped resources — employees, trips, wallets, complaints — across two companies. A company-1 token touching company-2/3 data gets 404 in every case: reading employee 41, changing trip 6's state, charging wallet 2, resolving complaint 2. Then the Day-6 discovery: creating a trip with company-2's captain used to SUCCEED — now it's 404, indistinguishable from a missing captain. And the call-center positive case: a tenant-less agent can escalate a complaint because the tenant filter is conditional — scoped actors always filter, the documented exception doesn't. The invariant: 404, never 403, never data — NFR-009."

### Q2 — ليه كان خطأ المحفظة متقطعًا؟ (المهمة 89)
> "The duplicate-charge bug is a check-then-act race: read balance, decide, write later. Two concurrent requests both pass the check, then both write — two debits for one charge. It's intermittent because the window between check and write is tiny at low load and widens under load — queues, GC pauses. In this codebase the race is designed OUT: Day 3 locked the wallet row FOR UPDATE, so check AND act are one atomic critical section, and the UNIQUE idempotency key is the backstop. The proof is `wallet-stress.test.js`: 8 concurrent same-key requests → exactly one charge, balance debited once; and the racing-toward-zero test → at most two winners, never negative. If someone removes the lock, these tests fail."

### Q3 — ليه الحذف بالـ commit مش كفاية للأسرار؟ (المهمة 82)
> "Because a secret in an old commit is in every clone's history — `git checkout <old-sha>` brings it back. Deleting the file in a new commit removes it from the tree, not from history. The fix is history rewrite — filter-repo or filter-branch, then force-push — AND rotation, because rewriting can't un-leak a credential from clones that already exist. The audit scans `git log --all -p` for secret patterns, not just the working tree. Current tree is clean: `.env.example` has empty values only, and the seed's 'hash-placeholder' is a placeholder, not a credential."

### Q4 — خطة الاستعلام قبل/بعد للـ 4 ثواني (المهمة 85)
> "Before: the query ordered by `(trip_date, start_time)` but the index was `(company_id, trip_date)` — the ORDER BY forced a Sort node over every matching row, and at 20M rows that sort plus the join fan-out is the ~4 seconds. After: one composite index `(company_id, trip_date, start_time)` satisfies filter AND order — no Sort node, and the keyset cursor walks the index so deep pages don't scan to skip. The evidence is EXPLAIN ANALYZE before/after — you look for the Sort and Seq Scan nodes disappearing. I can't fabricate timings here — the benchmark scripts generate the data and measure both plans, and the numbers go into the signoff table."

### Q5 — أول مكوّن ينكسر عند 10,000 قبطان؟ (المهمة 88)
> "10,000 captains at one ping per 10 seconds ≈ 1,200 req/s sustained. The first component to fail is the single API instance — its event loop and DB pool saturate; the fix is horizontal scaling, which the Day-4 architecture already mandates (two+ instances behind a load balancer). The second-order failure is the reconnect storm: when the instance dies, every app retries at once and the burst can exceed the pooler's connection limit. The defenses: exponential backoff with jitter on the client, queueing at the pooler, and the rate limiter fails open on Redis outage — availability over abuse control, documented."

### Q6 — أصعب اختبار RBAC؟ (المهمة 83)
> "The tampered-claim test — forging the role claim: take a valid employee token and swap the payload to role=admin while keeping the old signature. The signature check must reject it, because a valid-signed 'admin' token would pass RBAC by definition — JWT trusts the signature, not the claims. That's the boundary: honest tokens with a role are confined by the matrix (17 escalation denials tested), and dishonest tokens are killed by the signature. The call-center case is the subtle one: it must keep its narrow cross-tenant actions without becoming a tenant bypass — no user.manage, no wallet.read, no trip.assign."

### Q7 — هتفحص إيه بيوم أمان إضافي؟
> "In priority order: 1) provision Redis and run the cross-instance rate-limit test — the only designed-but-unproven guarantee from Day 5; 2) run the full benchmark on the real 20M-row database and verify the deep-page plan has no Seq Scan; 3) exercise the file-upload guard through a real multipart endpoint once one exists; 4) add OpenAPI specs for the new endpoints; 5) a dependency audit (npm audit) and a check of the Supabase project's exposed anon/authenticated roles against the new RLS policies."

## 3) بوابة اليوم 6 (احفظ دول)

1. **شغّل سويت العزل + سويت المحفظة مباشرة:** "سويت العزل: 4 موارد × شركتين → 404 كله، بما فيها الـ create بمراجع من شركة تانية؛ وسويت المحفظة: 8 متزامن بنفس المفتاح → خصم واحد."
2. **اشرح السببين الجذريين شفهيًا من غير ملاحظات:** TOCTOU (check-then-act بلا قفل) والـ UNION غير الحتمي.
3. **RLS دليل حي:** `SET ROLE smartline_rls_test` — من غير سياق = صفر صفوف، مع السياق = شركته بس.
4. **الاستعلام البطيء:** الفهرس المركب + EXPLAIN قبل/بعد (Sort وSeq Scan يختفوا).

## 4) أرقام احفظها

129/129 أخضر (45 + 84) · 60+ اختبار وحدة جديد يوم 6 · 17 إنكار تصعيد RBAC · 12 حالة auth سلبية · 8 متزامن → خصم واحد · `FOR UPDATE` + `UNIQUE(wallet_id, idempotency_key)` · 20 جدول RLS · `(company_id, trip_date, start_time)` · 10,000 قبطان ≈ 1,200 req/s · 404 لا 403 · 0 صفوف بدون config

## 5) قبل المقابلة

- [ ] شغّل `npm test` كاملًا على Supabase وخلّي النتيجة ظاهرة (129 + كل التكامل)
- [ ] شغّل سويت العزل لوحده: `npx node --test tests/integration/tenant-isolation.test.js`
- [ ] شغّل سويت المحفظة: `npx node --test tests/integration/wallet-stress.test.js`
- [ ] شغّل `psql "$DATABASE_URL" -f tests/database/rls_policy_test.sql`
- [ ] اقرأ `docs/debugging/wallet-toctou.md` + `intermittent-auth-failure.md` (السببان الجذريان)
- [ ] ارفع ورقة التخطيط اليدوية في `docs/handwritten/` + push على `feature/day-6-testing-security-performance` (مرتين على الأقل)
- [ ] درّب نفسك على Q1 (شغّل السويت واشرحه) وQ2 (الـ TOCTOU) بصوت عالٍ
