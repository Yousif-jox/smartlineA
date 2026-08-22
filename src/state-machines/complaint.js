// src/state-machines/complaint.js — complaint lifecycle (Task 22/70)
const STATES = ['submitted', 'assigned', 'escalated', 'resolved'];

const LEGAL = {
  submitted: ['assigned', 'escalated'],
  assigned: ['escalated', 'resolved'],
  escalated: ['resolved'],
  resolved: [], // locked — only Admin may reopen (documented exception, C4 default)
};

function isLegal(from, to) {
  return Boolean(LEGAL[from] && LEGAL[from].includes(to));
}

module.exports = { STATES, LEGAL, isLegal };
