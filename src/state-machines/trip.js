// src/state-machines/trip.js — Task 25 state machine (pure, tested)
// Legal transitions only; everything else is rejected. Terminal states
// (Completed/Cancelled/Failed) have no outgoing transitions.

const STATES = ['Scheduled', 'Assigned', 'Started', 'In Progress', 'Completed', 'Cancelled', 'Failed'];

const LEGAL = {
  Scheduled: ['Assigned', 'Cancelled'],
  Assigned: ['Started', 'Cancelled'],
  Started: ['In Progress', 'Failed'],
  'In Progress': ['Completed', 'Cancelled', 'Failed'],
  Completed: [],
  Cancelled: [],
  Failed: [],
};

function isLegal(from, to) {
  return Boolean(LEGAL[from] && LEGAL[from].includes(to));
}

module.exports = { STATES, LEGAL, isLegal };
