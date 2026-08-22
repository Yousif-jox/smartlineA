#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { Client } = require('pg');
require('dotenv').config();

const policyName = 'tenant_isolation_employee';
const testFile = 'tests/integration/rls.test.js';
const createPolicy = `CREATE POLICY ${policyName} ON employee USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());`;

function runTests() {
  const result = spawnSync(process.execPath, ['--test', testFile], {
    encoding: 'utf8',
    env: process.env
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output);
  return result.status === 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let dropped = false;
  try {
    await client.connect();
    const existing = await client.query(
      `SELECT 1 FROM pg_policy WHERE polname = $1 AND polrelid = 'employee'::regclass`,
      [policyName],
    );
    if (existing.rowCount === 0) {
      throw new Error(`${policyName} is missing; run npm run migrate first`);
    }

    console.log(`1) Dropping policy ${policyName} ...`);
    await client.query(`DROP POLICY ${policyName} ON employee`);
    dropped = true;

    console.log('2) Running rls.test.js (expect FAILURE) ...');
    const passedWithoutPolicy = runTests();
    if (passedWithoutPolicy) {
      throw new Error('FAIL: the tests are NOT guarding anything');
    }
    console.log('ok: suite failed as expected (the tests are real)');
  } finally {
    if (dropped) {
      try {
        console.log(`3) Restoring policy ${policyName} ...`);
        await client.query(createPolicy);
      } catch (error) {
        console.error(`FAILED TO RESTORE POLICY: ${error.message}`);
        throw error;
      }
    }
    await client.end();
  }

  const verify = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await verify.connect();
    const restored = await verify.query(
      `SELECT 1 FROM pg_policy WHERE polname = $1 AND polrelid = 'employee'::regclass`,
      [policyName],
    );
    if (restored.rowCount === 0) throw new Error('FAIL: policy was not restored');
  } finally {
    await verify.end();
  }

  console.log('4) Running rls.test.js (expect PASS) ...');
  if (!runTests()) throw new Error('FAIL: suite did not pass after policy restore');
  console.log('ok: suite passed after restore');
  console.log('RITUAL COMPLETE: fail-without-protection + pass-with-protection proven.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
