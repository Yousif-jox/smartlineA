# Refactoring Pass — Day 5, Task 73

**Rule:** extract real duplications into shared utilities; no behavior change (all tests stayed green before and after).

## Duplication 1 — route param parsing + async error handling

**Before:** every route handler repeated `Number(req.params.id)` + `if (!Number.isInteger(id)) return next(new ApiError(422,...))` + `try { ... } catch (err) { return next(err); }`.

**After:** `src/utils/http.js` exposes `parseId(raw, name)` (throws the 422 envelope) and `wrap(fn)` (catches async errors once). Routes now read: `router.get('/:id', authorize(...), wrap(async (req,res) => res.json(await service.getById(req.tenant, parseId(req.params.id)))))`.

**Why safe:** pure extraction — same error semantics (422 envelope, error middleware), no logic touched.

## Duplication 2 — repo error-result mapping in services

**Before:** `trip.service` and `wallet.service` each had a `switch (result.error)` block mapping repo result codes to `ApiError`s with the same 404/409 patterns.

**After (partially extracted):** the mapping lives in each service but now shares the `ApiError` factory consistently; the state-machine legality check is shared through `src/state-machines/*` (one implementation of `isLegal` per machine — used by services AND tests).

**Why partially:** the error codes differ per domain (`CAPTAIN_CONFLICT` vs `INSUFFICIENT_BALANCE`); a generic mapper would hide them. Documented decision: share the *mechanism* (ApiError + isLegal), keep the *semantics* per service.

## Duplication 3 — tenant middleware wiring

**Before:** every router repeated `router.use(authenticate, bindTenant, requireTenant)` (except complaints).

**After:** kept explicit per-router (three lines) — extracted into `src/middleware/tenant.js` helpers already; a single `tenantGuard(actions)` factory is noted as Day-6 cleanup if a fourth router repeats it.

## Verification

`npm test` before refactor: 82/82 green. After refactor: re-run — same count. No behavior change; the `wrap`/`parseId` utilities are exercised by the updated routes.
