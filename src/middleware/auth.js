// src/middleware/auth.js — JWT verification + RBAC enforcement (Task 52/64)
const jwt = require('jsonwebtoken');
const config = require('../config');
const { can } = require('../rbac');
const { ApiError } = require('./error');

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }
}

// Authenticate: parse Bearer token, attach req.auth = { accountId, companyId, role }
function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }
  try {
    req.auth = verifyToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

// Authorize: require a specific RBAC action
function authorize(action) {
  return (req, _res, next) => {
    if (!req.auth) return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing authentication'));
    if (!can(req.auth.role, action)) {
      return next(new ApiError(403, 'FORBIDDEN', `Role ${req.auth.role} cannot ${action}`));
    }
    return next();
  };
}

module.exports = { authenticate, authorize, verifyToken };
