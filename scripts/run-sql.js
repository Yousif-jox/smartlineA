#!/usr/bin/env node
// scripts/run-sql.js — run SQL files through the SAME DATABASE_URL pool.
// Drop-in replacement for psql when psql is not installed (Windows / minimal
// environments). Handles psql-style \set defaults and :var substitution.
//
// Usage:
//   node scripts/run-sql.js tests/database/rls_policy_test.sql
//   node scripts/run-sql.js scripts/benchmark/employee-trips-explain.sql
//   node scripts/run-sql.js scripts/benchmark/generate-trips.sql --set n=200000
//   node scripts/run-sql.js --exec "DROP POLICY tenant_isolation_employee ON employee;"
//
// NOTE: multi-statement files run through the simple query protocol (no
// parameters) — fine for these scripts; never pass user input through it.
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const cliSets = {};
for (const a of args) {
  const m = a.match(/^--set\s+([\w]+)=(.+)$/);
  if (m) cliSets[m[1]] = m[2];
}

function substitute(sql, sets) {
  return sql
    .split('\n')
    .map((line) => {
      const setMatch = line.match(/^\s*\\set\s+([\w]+)\s+(.+)\s*$/);
      if (setMatch) {
        // keep the DEFAULT from the file unless the CLI overrode it
        if (!(setMatch[1] in cliSets)) cliSets[setMatch[1]] = setMatch[2];
        return null; // drop the \set line itself
      }
      if (/^\s*\\echo/.test(line)) { console.log(line.replace(/^\s*\\echo\s*/, '')); return null; }
      let out = line;
      for (const [k, v] of Object.entries(cliSets)) out = out.split(`:${k}`).join(v);
      return out;
    })
    .filter((l) => l !== null)
    .join('\n');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (same one you use for npm run migrate).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const execIdx = args.indexOf('--exec');
  let sql;
  if (execIdx !== -1) {
    sql = args[execIdx + 1];
    if (!sql) { console.error('--exec requires a SQL string'); process.exit(1); }
  } else {
    if (!file) { console.error('usage: node scripts/run-sql.js <file.sql> [--set k=v ...]'); process.exit(1); }
    sql = substitute(fs.readFileSync(file, 'utf8'), cliSets);
  }

  try {
    const res = await pool.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const r of results) {
      if (r.rows && r.rows.length) {
        for (const row of r.rows) {
          const plan = row['QUERY PLAN'] ?? row['query plan'];
          if (plan) console.log(plan);
          else console.log(JSON.stringify(row));
        }
      } else {
        console.log(`OK (rowCount=${r.rowCount ?? 0})`);
      }
    }
  } catch (err) {
    console.error(`SQL ERROR: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
