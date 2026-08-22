// ============================================================
// Migration runner — applies database/migrations/*.sql in order,
// records them in schema_migrations, and rolls back with the
// matching *.down.sql files in reverse order (rollback-safe).
// Usage: npm run migrate | npm run migrate:down
// ============================================================
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL;

async function main(mode) {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required (e.g. your Supabase connection string).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: DATABASE_URL });
  // NOTE: our own tracking table — Supabase already owns `schema_migrations`
  // with a different shape, so we never collide with it.
  await pool.query(`CREATE TABLE IF NOT EXISTS app_schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (mode === 'up') {
    for (const file of files) {
      const { rows } = await pool.query('SELECT 1 FROM app_schema_migrations WHERE name = $1', [file]);
      if (rows.length) { console.log(`skip  ${file} (already applied)`); continue; }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${file}`);
      // Each migration runs inside one transaction: all-or-nothing
      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO app_schema_migrations (name) VALUES ($1)', [file]);
        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }
  } else if (mode === 'down') {
    const applied = (await pool.query('SELECT name FROM app_schema_migrations ORDER BY applied_at DESC')).rows.map((r) => r.name);
    for (const file of applied) {
      // Day-6 fix: the repo convention is `NNN.down.sql` (e.g. 001.down.sql),
      // but the previous code derived `NNN_name.down.sql` from the up file —
      // so migrate:down silently SKIPPED every rollback. Match the number.
      const num = (file.match(/^(\d+)/) || [])[1];
      const downFile = num ? `${num}.down.sql` : file.replace('.sql', '.down.sql');
      const downPath = path.join(MIGRATIONS_DIR, downFile);
      if (!fs.existsSync(downPath)) { console.warn(`no down file for ${file} — skipped`); continue; }
      console.log(`revert ${file}`);
      await pool.query('BEGIN');
      try {
        await pool.query(fs.readFileSync(downPath, 'utf8'));
        await pool.query('DELETE FROM app_schema_migrations WHERE name = $1', [file]);
        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }
  }

  await pool.end();
}

main(process.argv[2] || 'up').catch((err) => { console.error(err); process.exit(1); });
