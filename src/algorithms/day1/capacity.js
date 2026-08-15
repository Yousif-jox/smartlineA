// Task 09 — Vehicle Capacity Validation.
//
// Given a vehicle capacity and a list of trips (each with assigned employee IDs),
// return the trips that exceed capacity, with the overflow count.
//
// Decision (edge case): duplicate employee IDs inside one trip are counted ONCE —
// a duplicated ID is still the same person, so it must not inflate the count.
//
// Complexity: O(n) over the total number of employee assignments
// (each ID is inserted into a Set exactly once).

function findCapacityViolations(capacity, trips) {
  const violations = [];
  for (const trip of trips || []) {
    const uniqueCount = new Set(trip.employeeIds || []).size;
    const overflow = uniqueCount - capacity;
    if (overflow > 0) {
      violations.push({ tripId: trip.tripId, overflow });
    }
  }
  return violations;
}

module.exports = { findCapacityViolations };
