# Day 1 — Interview Preparation (كل اللي حصل + إجابات جاهزة)

> هذا ملف شخصي للتحضير — ليس تسليمًا. اقرأه، افهم كل نقطة، وأعد الصياغة بأسلوبك قبل المقابلة.
> المقابلة بالإنجليزي غالبًا — الإجابات مكتوبة بالإنجليزي، والتعليقات بالعربي عشان تفهم.

---

## 1) القصة الكاملة في 60 ثانية (نطقها كده)

> "Today was about understanding Smart Line as a business before any code. I walked the domain end-to-end — companies, branches, employees, pickup points, captains, vehicles, routes, trips, attendance, wallet, complaints, call center, notifications, admin. I produced a requirements baseline: a glossary of 14 entities, 23 clarification questions grouped into 5 domains, 8 assumptions with risks, 5 actors, 12 functional and 12 non-functional requirements, 3 conflict resolutions, and a scope boundary — consolidated into `baseline.md`. Then I solved the five algorithm tasks and the practical challenge (trip conflict detector), all covered by 45 passing tests. Everything I produced today is designed to be built on tomorrow: baseline → Day 2 SRS, glossary and assumptions → Day 3 ERD."

---

## 2) أسئلة المقابلة السبعة — إجابات جاهزة

### Q1 — Why did you group these entities the way you did?

> "I grouped entities by the natural ownership chain of the business plus the support functions. Core chain: Company → Branch → (Employee, Route, Vehicle) → Trip → Attendance and Wallet — that's 'who owns what', and it maps to the tenant hierarchy. Support functions: Complaint → Call Center → Admin, with Notification as event-driven glue between them. The grouping follows two questions: who owns the data (tenant chain) and who acts on it (actor model). Each group answers exactly one actor's questions — that's why it maps cleanly to the use-case actors tomorrow."

**عربي:** جَمّعت بالتبعية الطبيعية: من يملك البيانات (سلسلة المستأجر: شركة→فرع→...) ومن يتعامل معها (الفاعلون). كل مجموعة بتجاوب أسئلة فاعل واحد — وده اللي بيخليها جاهزة لمخطط Use Case يوم 2.

### Q2 — Which assumption are you least confident about, and why?

> "A5 — one vehicle per trip for its whole duration. Breakdowns are an operational reality; dispatch will want a backup vehicle to take over mid-route without creating a new trip. If that happens, I need a vehicle-history table and possibly a state-machine change. That's why I kept vehicle identity isolated inside the assignment layer — so the blast radius stays small if the assumption flips. I'm also somewhat uneasy about A1 (single branch per employee), but A5 is the riskiest because it touches the state machine, the ERD, and the wallet."

**عربي:** A5 (مركبة واحدة طوال الرحلة) — الأعطال واقع تشغيلي، وعزلت هوية المركبة في طبقة التكليف لاحتواء التغيير لو انقلب الافتراض.

### Q3 — Defend your trip-overlap boundary decision (touching endpoints)

> "Two trips overlap only if they share a positive-duration intersection. Adjacent trips — one ending at 08:00, the next starting at 08:00 — are NOT an overlap: there is no instant where the captain has two duties at once. I implemented it with a strict comparison: once the next trip's start reaches the current trip's end, I break the sweep. For zero-duration trips (start equals end), I treat them as instants and exclude them — an instant cannot conflict with anything, and flagging it would create noise. The defensible core: the business impact is zero for touching endpoints, and the rule is documented in the README."

**عربي:** التداخل = تقاطع بمدة موجبة. الملامسة (08:00/08:00) مش تداخل — مفيش لحظة ازدواج. المدة صفرية = لحظة زمنية مش نطاق، مستثناة. القاعدة مكتوبة في README.

### Q4 — What would break if an employee could belong to two branches at once?

> "Four things. First, the schema: `branch_id` as a single column becomes a junction table — a real ERD change. Second, queries: 'employees of branch X' and attendance grouping need joins. Third, RBAC: a manager's scope and the employee's branch resolution become ambiguous — which branch decides what the employee sees? Fourth, the assignment rule 'employee must belong to the trip's branch' needs a defined resolution instead of a simple check. Tenant isolation at company level still holds, but every branch-scoped check gets more complex. That's exactly why A1 assumes a single branch."

**عربي:** 4 حاجات تنكسر: المخطط (جدول وسيط)، الاستعلامات (joins)، الصلاحيات (غموض النطاق)، وقاعدة التكليف. عشان كده A1 يفترض فرعًا واحدًا.

### Q5 — How would your clustering change at 100,000 pickup points?

> "The BFS-over-implicit-graph approach is O(n²) — about 10 billion haversine evaluations at 100,000 points, which is minutes to hours. I'd switch to a spatial index: a uniform grid with cell size around the max distance, where each point only checks its own and the 8 neighboring cells — that drops the average case to near O(n). Alternatives are a quad-tree or k-d tree with range queries, or GeoHash prefixes for approximate grouping. All preserve the exact chained-proximity semantics; memory stays O(n)."

**عربي:** O(n²) = 10 مليار عملية — ممنوع. الحل: شبكة مكانية (grid) بحجم خلية = المسافة القصوى، كل نقطة تفحص خليتها و8 جيران بس → قرب O(n). أو quad-tree/k-d tree أو GeoHash تقريبي.

### Q6 — Which NFR is most at risk?

> "NFR-02 — trip status reaching the dashboard within 2 seconds at P95. It's the longest and most fragile chain: mobile app → API → database → pub/sub → WebSocket gateway → dashboard client, across multiple instances. It's the first thing to degrade under load and the hardest to debug when it breaks. Mitigation: idempotent events, reconnection catch-up for clients that were offline, and fallback polling if pub/sub degrades. NFR-06 (location ingestion at 1,000–2,000 writes per second) is a close second — but NFR-02 has the bigger blast radius because it's user-visible."

**عربي:** NFR-02 (الحالة اللحظية للوحة ≤ 2 ثانية) — أطول سلسلة وأكترها هشاشة (5 مكونات عبر نسخ متعددة). التخفيف: أحداث idempotent + اللحاق بعد إعادة الاتصال + استطلاع احتياطي.

### Q7 — What's the biggest ambiguity you still haven't resolved?

> "Whether a vehicle can change mid-route — question T2. The current design assumes one vehicle per trip, but dispatch reality may demand a mid-route replacement without creating a new trip. That single answer touches the trip state machine, the ERD cardinality, and the wallet charging — the widest blast radius of any open question. It's linked to my least-confident assumption, A5. A close second is T6: are trips created on demand or generated from a fixed schedule — that one changes the scope more than the schema."

**عربي:** سؤال T2 (تغيير مركبة منتصف الرحلة) — يلمس آلة الحالات + الـ ERD + المحفظة: أوسع أثر. وT6 (رحلات عند الطلب أم جدول) يغيّر النطاق.

---

## 3) بوابة اليوم 1 (Daily Gate) — لازم تشرح دول بدون ملاحظات

### الفاعلون الخمسة ولماذا يوجدون
- **Company Manager** — يدير العمليات: يشوف موظفيه وحضورهم، يجدول، يشوف المحفظة.
- **Employee** — المستهلك: يشوف رحلاته ونقاط التقاطه، يشتكي، يستقبل إشعارات.
- **Captain** — المنفذ على الأرض: يغيّر حالة الرحلة ويسجل الحضور ويبلّغ الأعطال.
- **Call Center Agent** — الدعم عبر الشركات (استثناء موثق للعزل).
- **Admin** — مالك المنصة: الشركات والأدوار والتدقيق والتصعيد النهائي.

### سلسلة علاقات الكيانات (ترويها زي ما هي)
"Company owns Branches; a Branch houses Employees and owns Routes; a Route is executed as Trips with a Vehicle and a Captain; assigned Employees are recorded in Attendance; completing a Trip triggers a Wallet charge; incidents become Complaints handled by the Call Center and escalated to Admin; events produce Notifications."

### تعقيدان خوارزميان على الأقل (احفظهم)
1. **Task 10 (تداخل الرحلات): O(n log n)** — فرز حسب البداية ثم مسح بكسر مبكر: أول رحلة تبدأ بعد نهاية الحالية = كسر الحلقة. البديل O(n²) ممنوع عند 5,000 رحلة.
2. **Task 13 (الحضور): O(n)** — ممرّان على Map (تجاهل تكرار eventId ثم أحدث طابع لكل موظف) — بدون فرز، idempotent ومستقل عن الترتيب. (ويمكن تقول Task 9 O(n) كمان: Set لكل رحلة.)

### خريطة النطاق (اشرحها بإيدك على الورقة)
"Boundary box is the Smart Line system. Outside: 5 actors with arrows in. Inside: Trip Management, Wallet, Complaints, Notifications, Admin Panel, Core Data. Nothing outside the boundary acts inside except through the API — that's the whole point of the boundary."

---

## 4) أسئلة إضافية متوقعة — إجابات قصيرة

| السؤال | الجواب |
|---|---|
| Why 14 entities when the brief says 13? | "The brief lists 14 names while saying 13 — I covered all 14 to be safe and noted the discrepancy in the glossary." |
| Why is walk-on rejected? | "Business rule BR-2: attendance is only trusted for assigned employees; an unassigned boarder breaks the attendance record's meaning." |
| Why count duplicate employee IDs once in Task 9? | "A duplicated ID is the same person — counting it twice would falsely overflow the vehicle." |
| Why tie-break attendance by eventId? | "Arrival order is not reliable, so the result must be deterministic and order-independent — eventId is the stable key." |
| Tell me about a bug you found today. | "My own tests caught 4 failures: a real bug where I compared timestamps against a status string instead of the full event, a misread of the assessment's example, and bad test data. Fixed all — suite green. The bug taught me the idempotency lesson that Day 3's wallet task will reuse." |
| Why is 404 better than 403 for cross-tenant? | "404 doesn't confirm the resource exists — 403 leaks that it exists but you can't access it. (This seeds Task 53.)" |

---

## 5) 5 فخاخ — لا تقع فيها

1. **لا تدّعي إن الورقة اليدوية اترفعت** — قول الصدق: "content ready, photo pending — I'll commit it before Day 1 closes" (الفجوة المبررة = مقبولة، الكذب = فشل البوابة).
2. **لا تدّعي إن GitHub اتعمل** — قول: "repo not pushed yet — planned as feature/day-1-requirements with 4 commits."
3. **لا تقول "التعقيد O(n²) ماشي" بدون تبرير** — قولها مع السبب (Task 11: مقبول عند 2,000 + الشبكة المكانية لـ100,000).
4. **لا تجاوب على Q2 بتردد** — A5 ثابت وواثق: عرفتها وعزلتها.
5. **لا تشتم الـ AI** ولا تقول "المساعد عملها" — المحتوى محضّر ليك، لكن الإجابات لازم تطلع منك بفهمك.

---

## 6) خطواتك قبل المقابلة (checklist)

- [ ] اقرأ `baseline.md` مرة أخيرة (13 قسمًا — هو مصدر الحقيقة).
- [ ] اقرأ `src/algorithms/day1/README.md` (قرارات الحدود + التوسع + تبرير TSP).
- [ ] شغّل `npm test` قدامك (45 pass) — عشان تحكي عنه بثقة.
- [ ] درّب نفسك على السكريبت الـ60 ثانية + الـ7 أسئلة بصوت عالٍ.
- [ ] جهّز ورقة اليدوية + خريطة النطاق (صور) وارفعهم قبل المقابلة.
