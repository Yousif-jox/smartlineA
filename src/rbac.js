// src/rbac.js — RBAC matrix (Task 52). Pure, testable, no I/O.
// Row: role. Column: action. Allowed = true.
// The call-center cross-tenant exception is encoded as the 'complaint.lookup'
// action — verified-key lookups only (Task 52/53), never enumeration.

const RBAC = {
  company_manager: {
    'trip.create': true, 'trip.assign': true, 'trip.read': true,
    'trip.status': false, 'attendance.record': false, 'attendance.read': true,
    'employee.read': true, 'employee.manage': true,
    'branch.manage': true, 'route.manage': true, 'vehicle.manage': true,
    'wallet.read': true, 'wallet.transact': false,
    'complaint.handle': false, 'complaint.read': true, 'complaint.escalate': false,
    'user.manage': false,
  },
  employee: {
    'trip.read': true, 'attendance.read': true,
    'complaint.submit': true, 'complaint.read': true,
    'notification.read': true, 'profile.read': true,
  },
  captain: {
    'trip.read': true, 'trip.status': true, 'attendance.record': true,
    'vehicle.report': true, 'schedule.read': true,
  },
  call_center: {
    'complaint.read': true, 'complaint.handle': true, 'complaint.escalate': true,
    'complaint.lookup': true,   // audited verified-key cross-tenant lookup (Task 52)
    'employee.lookup': true,    // verified-key employee lookup to verify complaints
  },
  admin: {
    'trip.read': true, 'complaint.handle': true, 'complaint.escalate': true,
    'user.manage': true, 'wallet.read': true, 'wallet.transact': true, 'audit.read': true,
  },
};

function can(role, action) {
  return Boolean(RBAC[role] && RBAC[role][action]);
}

module.exports = { RBAC, can };
