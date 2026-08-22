// src/services/complaint.service.js — business rules (Task 70)
const repo = require('../repositories/complaint.repo');
const { isLegal } = require('../state-machines/complaint');
const { ApiError } = require('../middleware/error');

async function create(tenant, employeeId, input) {
  const { category, priority } = input || {};
  if (!category) throw new ApiError(422, 'VALIDATION_ERROR', 'category is required');
  return repo.create(tenant, { employeeId, category, priority: priority || 'normal' });
}

async function transition(tenant, id, action, { agentId, resolution, role } = {}) {
  const target = { assign: 'assigned', escalate: 'escalated', resolve: 'resolved' }[action];
  if (!target) throw new ApiError(422, 'VALIDATION_ERROR', 'action must be assign, escalate or resolve');

  const complaint = await repo.findById(tenant, id);
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');

  // resolved complaints are locked — only Admin may modify (C4 default)
  if (complaint.state === 'resolved' && role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Resolved complaints are locked except for admin');
  }
  if (!isLegal(complaint.state, target)) {
    throw new ApiError(409, 'COMPLAINT_ILLEGAL_STATE', `Transition ${complaint.state} -> ${target} is not allowed`, {
      currentState: complaint.state,
      attemptedState: target,
    });
  }
  if (action === 'resolve' && !resolution) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'resolution note is required to resolve');
  }

  const updated = await repo.updateState(tenant, id, complaint.state, target, { agentId, resolution });
  if (!updated) throw new ApiError(409, 'COMPLAINT_CONCURRENT_UPDATE', 'Complaint changed concurrently');
  return updated;
}

module.exports = { create, transition };
