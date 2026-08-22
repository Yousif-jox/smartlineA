// Integration tests — complaint lifecycle (Task 70)
const { test, after, before } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../../src/db');
const service = require('../../src/services/complaint.service');

before(async () => {
  await pool.query(`DELETE FROM complaint WHERE id > 2`); // seeds have ids 1,2
});

after(async () => {
  await pool.query(`DELETE FROM complaint WHERE id > 2`);
  await pool.end();
});

test('full lifecycle: submit -> assign -> escalate -> resolve', async () => {
  const c = await service.create(1, 1, { category: 'Late pickup', priority: 'high' });
  assert.strictEqual(c.state, 'submitted');
  const assigned = await service.transition(1, c.id, 'assign', { agentId: 4 });
  assert.strictEqual(assigned.state, 'assigned');
  const escalated = await service.transition(1, c.id, 'escalate', { agentId: 5 });
  assert.strictEqual(escalated.state, 'escalated');
  const resolved = await service.transition(1, c.id, 'resolve', { resolution: 'Reassigned vehicle next day', role: 'call_center' });
  assert.strictEqual(resolved.state, 'resolved');
});

test('illegal transition (submitted -> resolved directly) -> 409', async () => {
  const c = await service.create(1, 1, { category: 'Noise' });
  await assert.rejects(
    () => service.transition(1, c.id, 'resolve', { resolution: 'x' }),
    (err) => err.status === 409 && err.code === 'COMPLAINT_ILLEGAL_STATE',
  );
});

test('resolved complaints are locked — non-admin gets 403', async () => {
  const c = await service.create(1, 1, { category: 'Cleanliness' });
  await service.transition(1, c.id, 'assign', { agentId: 4 });
  await service.transition(1, c.id, 'resolve', { resolution: 'Cleaned', role: 'call_center' });
  await assert.rejects(
    () => service.transition(1, c.id, 'assign', { agentId: 4, role: 'call_center' }),
    (err) => err.status === 403 && err.code === 'FORBIDDEN',
  );
});

test('resolve requires a resolution note -> 422', async () => {
  const c = await service.create(1, 1, { category: 'Driver behavior' });
  await service.transition(1, c.id, 'assign', { agentId: 4 });
  await assert.rejects(
    () => service.transition(1, c.id, 'resolve', {}),
    (err) => err.status === 422,
  );
});

test('cross-tenant complaint -> 404', async () => {
  await assert.rejects(
    () => service.transition(3, 1, 'assign', { agentId: 4 }), // tenant 3 asks for tenant-1 complaint
    (err) => err.status === 404,
  );
});
