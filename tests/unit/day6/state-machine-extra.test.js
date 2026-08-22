// Day 6 — Task 76: state-machine transition checker extras (Tasks 25/66 + 70)
// Full-matrix consistency: isLegal(from,to) must EXACTLY match the LEGAL table
// for every pair — the machine is the tests' boss, not the other way around.
const { test } = require('node:test');
const assert = require('node:assert');
const tripMachine = require('../../../src/state-machines/trip');
const complaintMachine = require('../../../src/state-machines/complaint');

test('trip machine: isLegal matches LEGAL for EVERY state pair (complete matrix)', () => {
  for (const from of tripMachine.STATES) {
    for (const to of tripMachine.STATES) {
      const expected = tripMachine.LEGAL[from].includes(to);
      assert.strictEqual(tripMachine.isLegal(from, to), expected, `${from} -> ${to}`);
    }
  }
});

test('trip machine: self-transitions are all illegal', () => {
  for (const s of tripMachine.STATES) {
    assert.strictEqual(tripMachine.isLegal(s, s), false, `${s} -> ${s} must be illegal`);
  }
});

test('trip machine: non-string inputs are rejected without throwing', () => {
  assert.strictEqual(tripMachine.isLegal(undefined, 'Started'), false);
  assert.strictEqual(tripMachine.isLegal('Scheduled', null), false);
  assert.strictEqual(tripMachine.isLegal('', ''), false);
});

test('trip machine: the Assigned gate — only Started/Cancelled are legal exits', () => {
  const exits = tripMachine.STATES.filter((s) => tripMachine.isLegal('Assigned', s));
  assert.deepStrictEqual(exits.sort(), ['Cancelled', 'Started']);
});

test('trip machine: the In Progress gate — Completed is only reachable from it', () => {
  const entrances = tripMachine.STATES.filter((s) => tripMachine.isLegal(s, 'Completed'));
  assert.deepStrictEqual(entrances, ['In Progress']);
});

test('complaint machine: full matrix consistency', () => {
  for (const from of complaintMachine.STATES) {
    for (const to of complaintMachine.STATES) {
      const expected = complaintMachine.LEGAL[from].includes(to);
      assert.strictEqual(complaintMachine.isLegal(from, to), expected, `${from} -> ${to}`);
    }
  }
});

test('complaint machine: resolved is terminal for everyone (the lock is RBAC, machine agrees)', () => {
  for (const to of complaintMachine.STATES) {
    assert.strictEqual(complaintMachine.isLegal('resolved', to), false, `resolved -> ${to} must be illegal`);
  }
  // The only legal path to resolved is assigned/escalated (Task 70).
  const entrances = complaintMachine.STATES.filter((s) => complaintMachine.isLegal(s, 'resolved'));
  assert.deepStrictEqual(entrances.sort(), ['assigned', 'escalated']);
});
