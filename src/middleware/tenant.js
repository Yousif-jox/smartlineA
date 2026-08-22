// src/middleware/tenant.js — THE systemic tenant binding (Task 53, flagship).
// Extracts the tenant ONCE from the authenticated principal and binds it to
// the request. Repositories ALWAYS filter by req.tenant (via services).
// The tenant NEVER comes from the URL or body.
// Cross-tenant resources resolve to 404 (no existence oracle, NFR-009).

function bindTenant(req, _res, next) {
  if (!req.auth) return next();
  req.tenant = req.auth.companyId ?? null; // null for admin / call center (documented exception)
  next();
}

// Task 53 rule: any service lookup against a tenant-scoped table goes through
// this guard — a caller without a tenant cannot read tenant-scoped data.
function requireTenant(req, _res, next) {
  if (req.tenant === null || req.tenant === undefined) {
    const err = new Error('TENANT_REQUIRED');
    err.status = 403;
    return next(err);
  }
  next();
}

module.exports = { bindTenant, requireTenant };
