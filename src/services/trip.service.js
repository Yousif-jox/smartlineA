// src/services/trip.service.js — business rules (Tasks 66/67)
const repo = require('../repositories/trip.repo');
const employeeRepo = require('../repositories/employee.repo');
const { isLegal } = require('../state-machines/trip');
const { ApiError } = require('../middleware/error');

async function create(tenant, input) {
  const { routeId, vehicleId, captainId, tripDate, startTime, endTime } = input || {};
  if (!routeId || !vehicleId || !captainId || !tripDate || !startTime || !endTime) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'routeId, vehicleId, captainId, tripDate, startTime, endTime are required');
  }
  if (await repo.captainConflict(captainId, tripDate, startTime, endTime)) {
    throw new ApiError(409, 'CAPTAIN_CONFLICT', 'Captain already has an overlapping trip');
  }
  if (await repo.vehicleConflict(vehicleId, tripDate, startTime, endTime)) {
    throw new ApiError(409, 'VEHICLE_CONFLICT', 'Vehicle is already assigned at that time');
  }
  try {
    return await repo.create(tenant, { routeId, vehicleId, captainId, tripDate, startTime, endTime });
  } catch (err) {
    // defense in depth: the Day 3 exclusion constraint is the final guard
    if (err.code === '23P01' || /exclusion/.test(err.message)) {
      throw new ApiError(409, 'CAPTAIN_CONFLICT', 'Overlapping trip rejected by database constraint');
    }
    throw err;
  }
}

async function updateStatus(tenant, id, newState) {
  const trip = await repo.findById(tenant, id);
  if (!trip) throw new ApiError(404, 'NOT_FOUND', 'Trip not found');

  if (!isLegal(trip.state, newState)) {
    throw new ApiError(409, 'TRIP_ILLEGAL_STATE', `Transition ${trip.state} -> ${newState} is not allowed`, {
      currentState: trip.state,
      attemptedState: newState,
    });
  }

  const updated = await repo.updateState(tenant, id, trip.state, newState);
  if (!updated) {
    // another request moved the trip first — optimistic concurrency conflict
    const fresh = await repo.findById(tenant, id);
    throw new ApiError(409, 'TRIP_CONCURRENT_UPDATE', 'Trip state changed concurrently', {
      currentState: fresh ? fresh.state : null,
      attemptedState: newState,
    });
  }
  return updated;
}

// Task 67 — assignment with the Task 57 check order and the Task 38 lock
async function assignEmployee(tenant, tripId, employeeId) {
  // 1) tenant-scoped employee lookup FIRST (FR-005) — 404, no existence leak
  const employee = await employeeRepo.findById(tenant, employeeId);
  if (!employee) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');

  // 2) state + capacity + overlap inside ONE locked transaction
  const result = await repo.assignWithLock(tenant, tripId, employeeId);
  switch (result.error) {
    case 'NOT_FOUND':
      throw new ApiError(404, 'NOT_FOUND', 'Trip not found');
    case 'ILLEGAL_STATE':
      throw new ApiError(409, 'TRIP_ILLEGAL_STATE', `Cannot assign to trip in state ${result.state}`, { currentState: result.state });
    case 'CAPACITY_EXCEEDED':
      throw new ApiError(409, 'CAPACITY_EXCEEDED', `Vehicle capacity is ${result.capacity}, ${result.assigned} already assigned`, result);
    case 'EMPLOYEE_OVERLAP':
      throw new ApiError(409, 'EMPLOYEE_OVERLAP', 'Employee already assigned to an overlapping trip');
    case 'ALREADY_ASSIGNED':
      throw new ApiError(409, 'ALREADY_ASSIGNED', 'Employee is already assigned to this trip');
    default:
      return { tripId, employeeId, assignedAt: new Date().toISOString() };
  }
}

async function removeAssignment(tenant, tripId, employeeId) {
  const trip = await repo.findById(tenant, tripId);
  if (!trip) throw new ApiError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.state === 'Completed') {
    throw new ApiError(409, 'TRIP_ILLEGAL_STATE', 'Cannot remove after trip completion', { currentState: trip.state });
  }
  const ok = await repo.removeAssignment(tenant, tripId, employeeId);
  if (!ok) throw new ApiError(404, 'NOT_FOUND', 'Assignment not found');
  return { removed: true };
}

module.exports = { create, updateStatus, assignEmployee, removeAssignment };
