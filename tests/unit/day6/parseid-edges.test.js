// Day 6 — Task 80: input-boundary tests for the shared id parser (Task 73 util)
const { test } = require('node:test');
const assert = require('node:assert');
const { parseId } = require('../../../src/utils/http');

function expectReject(raw, name) {
  assert.throws(() => parseId(raw, name), (e) => e.status === 422 && e.code === 'VALIDATION_ERROR');
}

test('valid ids parse to numbers', () => {
  assert.strictEqual(parseId('1'), 1);
  assert.strictEqual(parseId('9007199254740991'), 9007199254740991); // MAX_SAFE_INTEGER
});

test('zero and negative ids are rejected', () => {
  expectReject('0');
  expectReject('-1');
  expectReject('-42');
});

test('floats are rejected', () => {
  expectReject('1.5');
});

test('exponent form parses to its exact integer value (harmless, documented)', () => {
  // Number('1e3') === 1000 — an exact integer, so it is accepted as 1000.
  assert.strictEqual(parseId('1e3'), 1000);
});

test('non-numeric input is rejected', () => {
  expectReject('abc');
  expectReject('');
  expectReject(undefined);
  expectReject(null);
  expectReject('12abc');
});

test('ids beyond MAX_SAFE_INTEGER are rejected (BIGINT precision loss)', () => {
  expectReject('9007199254740992'); // 2^53 — rounds in JS Number
  expectReject('99999999999999999');
});

test('the custom name appears in the error message', () => {
  assert.throws(() => parseId('x', 'walletId'), (e) => e.message.includes('walletId'));
});
