# Day 4 — Planning Sheet (محتوى للنسخ بخط يدك — بالإنجليزي)

**Name:** ____________ &nbsp;&nbsp; **Task:** Day 4 planning &nbsp;&nbsp; **Date:** ____________

---

## 1) Architecture boxes (draw)

- Clients: Employee App, Captain App, Manager Dashboard, Call Center Tool, Admin Console
- Load Balancer (HA) → API Instances (2..n) + WebSocket Gateways (2..n)
- PostgreSQL (source of truth) · Redis (cache + Pub/Sub) · Message Queue + workers
- Rules: NO single API instance; every arrow has a direction; SPOFs acknowledged

## 2) API impact notes (referencing Day 3 schema)

- Pagination: cursor (Task 42) → `?cursor=` contract
- Tenant: `company_id` bound via middleware (Task 36) — never from URL
- Wallet: no cache (Task 48) · idempotency key header (Task 39/58)
- State machine: 409 with current/attempted (Task 25)
- Errors: envelope + 422/403/404/409 (Task 54)

## 3) First-pass API resources

companies · branches · employees · captains · vehicles · routes · trips · attendance · complaints · wallets

## 4) The security question to answer on paper

"How does a Company Manager of tenant A get a 404 (not 403, not data) when requesting tenant B's resource — and where in the request path is that enforced?"
