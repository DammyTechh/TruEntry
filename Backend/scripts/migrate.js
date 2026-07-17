'use strict';

/**
 * Applies the single consolidated migration (migrations/0001_init.sql).
 * The SQL is idempotent (IF NOT EXISTS / ON CONFLICT), so it is safe to re-run.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');
const logger = require('../src/config/logger');

async function run() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (!files.length) {
    logger.warn('No migration files found');
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      logger.info(`Applying migration: ${file}`);
      await client.query(sql);
      logger.info(`Applied: ${file}`);
    }
    logger.info('All migrations applied successfully');
  } finally {
    client.release();
  }
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration failed', { error: err.message, stack: err.stack });
    pool.end().finally(() => process.exit(1));
  });
