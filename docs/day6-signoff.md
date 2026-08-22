# Day 6 — Signoff (التحدي: أدلة بالأرقام)

> أربعة ادعاءات — كل واحد بأدلة قابلة للتشغيل. لا يُقبل أي ادعاء بدون دليل.

## 1) عزل المستأجرين محجوب (Tenant isolation blocked)

**الأدلة:**
- `tests/integration/tenant-isolation.test.js` — 4 موارد (employees / trips /
  wallets / complaints) × شركتان: كل وصول عبر المستأجرين → **404**، بما فيها
  محاولة إنشاء رحلة بمراجع من شركة تانية (الإصلاح الجديد) وشكوى لموظف من شركة
  تانية، + الحالة الإيجابية لوكيل مركز الاتصال (استثناء موثق) شغالة.
- `tests/database/rls_policy_test.sql` + `tests/integration/rls.test.js` —
  دور غير مخترق (`smartline_rls_test`): بدون `app.company_id` → **0 صفوف**
  (fail closed)؛ مع config=1 → عدّاد الشركة نفسها (المتغير data-relative:
  عرض RLS = فلتر `company_id` الصريح — مفيش رقم ثابت ينكسر مع بيانات قديمة)؛
  cross-tenant → 0؛ الـ view محمي بـ security_invoker. التشغيل بدون psql:
  `node scripts/run-sql.js tests/database/rls_policy_test.sql`
- **طقس التحقق:** احذف `tenant_isolation_employee` policy مؤقتًا → اختبار RLS
  يفشل → أعد الترحيل → الاختبار يرجع أخضر.

**التشغيل:** `npm test` (على Supabase) + `psql "$DATABASE_URL" -f tests/database/rls_policy_test.sql`

## 2) النقطة البطيئة تلبي الـ NFR (slow point meets NFR)

**الأدلة:**
- `GET /api/v1/employees/:id/trips` مبنية بترحيل فهرس `007`
  (`(company_id, trip_date, start_time)` — يشبع الفلتر والترتيب، بلا Sort node).
- `scripts/benchmark/generate-trips.sql` + `employee-trips-explain.sql` —
  قبل/بعد بالأرقام (يملؤها المستخدم من تشغيله الحقيقي):

| Query | Before (ms) | After (ms) |
|-------|------------|------------|
| employee trips, week, page 1 | `____` | `____` |
| deep page (~100,000) | `____` | `____` |
| company dashboard (no regression) | `____` | `____` |

- **شرط الفشل:** ظهور `Seq Scan` أو `Sort` في خطة الصفحة العميقة = الفهرس غير
  مستخدم (غالبًا stats قديمة → `ANALYZE trip;`).

## 3) لا أسرار في الشجرة/التاريخ (no secrets)

**الأدلة:**
- `docs/security/secrets-audit.md` — فحص الشجرة كاملًا (grep على أنماط
  الأسرار/المفاتيح/سلاسل الاتصال): **نظيف**؛ `.env.example` قيم فاضية فقط؛
  `'hash-placeholder'` في الـ seed ليس سرًا.
- النسخة المقدمة بلا `.git/` — تاريخ الـ push الخاص بالمستخدم يفحص بـ
  `git log --all -p | grep -iE "(BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|...)"`
  مع إجراء إعادة كتابة التاريخ + rotation موثقين في نفس الملف.
- [ ] المستخدم يثبت نتيجة فحص تاريخه هنا: `________________`

## 4) الخطأان المُصلحان باختبارات ناجحة (both injected errors fixed)

### (أ) خطأ المحفظة المكرر — Task 89
- **التحليل:** فئة TOCTOU (check-then-act بلا قفل) مصممة خارجًا من يوم 3
  (Task 39) — الكود يغلق صف المحفظة `FOR UPDATE` قبل الفحص والتنفيذ معًا.
- **الدليل:** `tests/integration/wallet-stress.test.js` — 8 طلبات متزامنة
  بنفس المفتاح → خصم واحد بالضبط؛ 8 مفاتيح مختلفة → 8 خصومات والرصيد مضبوط؛
  سباق على رصيد 700 → فائزان كحد أقصى ورصيد 100 بالضبط.
- لو اتشال القفل → الاختبارات تفشل (هذا هو الـ regression guard).

### (ب) فشل التفويض المتقطع — Task 90
- **السبب الجذري:** `UNION` بلا `ORDER BY` + `rows[0]` → اختيار حساب غير
  حتمي عند تصادم الأسماء/الأرقام → متقطع حسب خطة الاستعلام.
- **الإصلاح:** `ORDER BY id` + دالة نقية `selectAccount()` (أصغر id).
- **الدليل:** `tests/unit/day6/login-determinism.test.js` (تصادمات مخلوطة →
  نفس الفائز دايمًا) + إصلاح طريق مركز الاتصال المسدود
  (`tests/integration/tenant-isolation.test.js`).

## خلاصة التشغيل على جهاز المستخدم (checklist)

- [ ] `npm test` كاملًا على Supabase — كل شيء أخضر (129 unit/day1 + كل
  الـ integration)
- [ ] `psql "$DATABASE_URL" -f tests/database/rls_policy_test.sql` — كل
  التوقعات تتحقق
- [ ] بنشمارك EXPLAIN قبل/بعد + ملء جدول القسم 2
- [ ] فحص تاريخ Git للأسرار + تسجيل النتيجة في القسم 3
- [ ] رفع ورقة التخطيط اليدوية في `docs/handwritten/` + push على
  `feature/day-6-testing-security-performance` (مرتين على الأقل أثناء اليوم)
