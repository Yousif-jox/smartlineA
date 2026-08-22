# Day 4 — Interview Preparation (إجابات جاهزة)

> ملف شخصي للتحضير — اقرأه، افهم، وأعد الصياغة بأسلوبك.

## 1) القصة في 60 ثانية

> "Today I designed the backend architecture and locked the API contract. The architecture: an HA load balancer in front of 2..n stateless API instances and 2..n WebSocket gateways, PostgreSQL as the single source of truth, Redis for cache and pub/sub only, and a queue with idempotent consumers. The API: `/api/v1`, an OpenAPI spec for trips with cursor pagination and 409 for illegal state transitions, JWT with rotating refresh and a full RBAC matrix, and a systemic IDOR fix — one tenant middleware that binds the company once and every repository query carries it, with 404 for anything outside the tenant. Realtime works across instances because every gateway subscribes to the shared channel and clients catch up by eventId after reconnecting. I signed off the architecture with four documented open risks."

---

## 2) أسئلة المقابلة السبع — إجابات جاهزة

### Q1 — What happens if API instance B dies mid-request while a client is connected to it via WebSocket?
> "Two separate concerns. For the request: either it committed or it rolled back — the transaction is atomic, and the client's retry is safe because writes are idempotent (idempotency keys for wallet, assignment checks re-validated). For the WebSocket: the client's connection was to a gateway, not to the API instance that processed the request. If the gateway dies, the client reconnects — the load balancer routes it to any healthy gateway — and sends its last received eventId; the new gateway replays the missed events. No sticky sessions required, because all gateways subscribe to the same channel."

### Q2 — Why did you choose this TTL — what breaks if it's too long?
> "Branches 5 minutes, the trips dashboard list 30 seconds, employee profile 10 minutes. But the TTL is not the mechanism — invalidation is: every write deletes the affected cache keys in the same request. TTLs are only a crash-safety backstop for a missed delete. If a TTL were too long, the consequence is bounded: after an invalidation miss, stale data could be served for up to the TTL — so I deliberately kept the trips list (the most visible data) at 30 seconds and excluded the wallet entirely, because serving a stale balance is a financial correctness violation, not a freshness issue."

### Q3 — Walk me through how your fix prevents IDOR — then break your own fix.
> "One middleware extracts the tenant from the authenticated token and binds it to the request context. Every repository call receives that context and filters by company_id — there is no path to the database without the tenant filter, because the layering (routes → services → repositories) makes the repository the only data access point. A manager of tenant A requesting tenant B's employee: the query returns zero rows, and the response is 404 — identical to 'not found', so there's no existence oracle. To break it you'd have to bypass the middleware — which the architecture doesn't allow — or find a query path that doesn't bind the tenant, which the Day 6 security suite explicitly tests, and RLS at the database is the final independent layer that rejects even a buggy query."

### Q4 — How does the Call Center get cross-tenant access without reopening the vulnerability?
> "It's a narrow, audited role override inside the same tenant middleware — not a tenant bypass. Three rules: verified-key lookup only (phone or national ID resolves to exactly the relevant records — there is no list or browse endpoint across tenants), read-only and field-minimized (never financial data), and every cross-tenant read is written to the audit log with who/when/what/why, visible to the tenant admin. Any other role, or any request without a verified key, falls back to standard tenant scoping."

### Q5 — What happens to a queue message when the worker crashes mid-notify?
> "Delivery is at-least-once, so the message is redelivered. The consumer is idempotent — the notification table has a unique event_id, so the redelivery is a no-op: no duplicate notifications. After three failed attempts the message moves to the dead-letter queue and an alert fires. And the event itself can't be lost even if the queue goes down, because domain events are written to an outbox table in the same transaction as the state change, then drained by a worker — so a queue outage costs latency, never data."

### Q6 — Prove wallet idempotency with a concrete request sequence.
> "Request 1: POST with Idempotency-Key K, amount 50 → executes, 201. Request 2: same key K, same body (the client lost the response and retried) → the unique constraint (wallet_id, K) rejects the insert, the API returns the original transaction — 200, no duplicate. Request 3: same key K but amount 500 → 422, IDEMPOTENCY_KEY_REUSED — a client bug, surfaced loudly. Request 4: two copies arrive concurrently → they serialize on the wallet row lock; one commits, the other hits the constraint and gets the original result. Exactly-once under every scenario."

### Q7 — What's the biggest architectural risk and how do you mitigate it?
> "Realtime channel isolation: every gateway subscribes to all trip channels, so a mis-scoped subscription could cross tenants. Mitigations: the WebSocket upgrade authenticates and binds a tenant, channel names are tenant-namespaced (trip.{tenantId}.{tripId}), and Day 6 includes a malicious cross-tenant subscription test. Second risk: rate limiting fails open during a Redis outage — documented trade-off (availability over abuse control) with an alert and a conservative per-instance fallback counter."

---

## 3) بوابة اليوم 4 (احفظ دول)

1. **IDOR منهجي:** "middleware واحد يربط المستأجر + كل استعلام يحمله + الغلط = 404 — مفيش رقعة لكل نقطة نهاية."
2. **اللحظية عبر نسخ:** "كل البوابات بتشترك في القناة + catch-up بـ eventId عند إعادة الاتصال — من غير sticky sessions."
3. **تصميم خادم واحد = فشل:** "نسختا API على الأقل خلف LB ولا حالة لكل نسخة — أي تصميم أحادي هيُرفض."

## 4) أرقام احفظها

`/api/v1` · 15 دقيقة JWT · مصفوفة 5×10 · 3 نقاط cache (30s–10min) · 3 عمليات async · 4 مخاطر موثقة · 100 req/s مستخدم · 2..n API + 2..n gateways · 404 لا 403

## 5) قبل المقابلة

- [ ] اقرأ `docs/api/security/idor-fix.md` (المخطط قبل/بعد) + `docs/architecture/realtime-multi-instance.md`
- [ ] اقرأ `docs/architecture/summary.md` — المخاطر الأربعة (لو اتسألت عن "أضعف نقطة")
- [ ] ارفع ملفات يوم 4 + الصور اليدوية (46 و59) في `docs/handwritten/`
- [ ] درّب نفسك على Q3 (اكسر إصلاحك) وQ7 (أكبر خطر) بصوت عالٍ
