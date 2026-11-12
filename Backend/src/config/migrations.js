'use strict';

/**
 * Schema migrations, applied automatically on boot.
 *
 * The deployment story used to be "push the code, then remember to run the
 * SQL by hand". When the second half was forgotten the API served requests
 * against a schema the code no longer matched, and every affected feature
 * failed with an "unexpected error" that looked like an application bug but
 * was really `relation ... does not exist`. Applying pending migrations
 * before the first request removes that failure mode for good.
 *
 * Safety:
 *   • Every file applied is recorded in `schema_migrations`, so each one runs
 *     exactly once even though the migrations themselves are idempotent.
 *   • A Postgres advisory lock serialises concurrent boots — several Vercel
 *     lambdas starting at once cannot race each other.
 *   • Each file runs in its own transaction, so a failure leaves the schema
 *     exactly as it was rather than half-applied.
 *   • Memoised per process: one quick query per cold start once up to date.
 *
 * Set MIGRATE_ON_BOOT=false to turn this off and run `npm run migrate` by hand.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./database');
const logger = require('./logger');

// Any constant works; it only has to be the same in every process.
const LOCK_KEY = 835142075;
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** Apply every migration that has not been recorded yet. */
async function runPending() {
  const files = migrationFiles();
  if (!files.length) {
    logger.warn('No migration files found');
    return { applied: [], pending: [] };
  }

  const client = await pool.connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const done = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !done.has(f));

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
        applied.push(file);
        logger.info('Migration applied', { file });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error('Migration failed', { file, error: err.message });
        throw err;
      }
    }

    if (applied.length) logger.info('Database schema brought up to date', { applied: applied.length });
    return { applied, pending };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

let inFlight = null;

/**
 * Run pending migrations once per process. Safe to await on every request:
 * after the first call it resolves immediately. A failure resets the promise
 * so the next request retries, rather than poisoning the process for good.
 */
function ensureSchema() {
  if (!inFlight) {
    inFlight = runPending().catch((err) => {
      inFlight = null;
      throw err;
    });
  }
  return inFlight;
}

module.exports = { ensureSchema, runPending, migrationFiles };
