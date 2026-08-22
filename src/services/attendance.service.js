// src/services/attendance.service.js — business rules (Task 69)
const repo = require('../repositories/attendance.repo');
const { ApiError } = require('../middleware/error');

const RECORDABLE = ['Boarded', 'Not Boarded', 'Absent'];

async function record(tenant, tripId, employeeId, input) {
  const { eventId, state, timestamp } = input || {};
  if (!eventId || !state || !timestamp) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'eventId, state and timestamp are required');
  }
  if (!RECORDABLE.includes(state)) {
    throw new ApiError(422, 'VALIDATION_ERROR', `state must be one of ${RECORDABLE.join(', ')}`);
  }

  const result = await repo.recordEvent(tenant, tripId, employeeId, {
    eventId,
    state,
    ts: new Date(timestamp).toISOString(),
  });

  switch (result.error) {
    case 'NOT_FOUND':
      throw new ApiError(404, 'NOT_FOUND', 'Trip not found');
    case 'ILLEGAL_STATE':
      throw new ApiError(409, 'TRIP_ILLEGAL_STATE', `Attendance cannot be recorded while trip is ${result.state}`, { currentState: result.state });
    case 'NOT_ASSIGNED':
      throw new ApiError(409, 'EMPLOYEE_NOT_ASSIGNED', 'Employee is not assigned to this trip (walk-on rejected)');
    case 'DUPLICATE_EVENT':
      return { applied: false, reason: 'duplicate_event' };
    case 'STALE_EVENT':
      return { applied: false, reason: 'stale_event' };
    default:
      return { applied: true, state };
  }
}

async function list(tenant, tripId) {
  return repo.listForTrip(tenant, tripId);
}

module.exports = { record, list };
