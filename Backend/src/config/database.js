'use strict';

const { Pool } = require('pg');
const config = require('./index');
const logger = require('./logger');

/**
 * Single shared Postgres connection pool (Supabase-compatible).
 * All modules query through the helpers exported here; no raw pool access elsewhere.
 */
const pool = new Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  // Serverless invocations are short-lived and many may run concurrently, so a
  // large pool per instance exhausts the database's connection limit fast. Keep
  // it tiny on serverless (use a pooled/Supavisor connection string too) and
  // generous on a long-running server.
  max: config.isServerless ? 3 : 20,
  idleTimeoutMillis: config.isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: config.isServerless,
});

pool.on('error', (err) => {
  logger.error('Unexpected Postgres pool error', { error: err.message, stack: err.stack });
});

/**
 * Run a parameterised query.
 * @param {string} text - SQL with $1, $2 placeholders.
 * @param {Array} [params] - bound values.
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn('Slow query', { duration, rows: result.rowCount, sql: text.slice(0, 120) });
    } else {
      logger.debug('Executed query', { duration, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    logger.error('Query failed', { sql: text.slice(0, 200), error: err.message });
    throw err;
  }
}

/**
 * Convenience: return the first row or null.
 */
async function queryOne(text, params = []) {
  const { rows } = await query(text, params);
  return rows[0] || null;
}

/**
 * Convenience: return all rows.
 */
async function queryMany(text, params = []) {
  const { rows } = await query(text, params);
  return rows;
}

/**
 * Run a set of statements inside a transaction.
 * The callback receives a client with the same query(text, params) signature.
 * @param {(client: {query: Function}) => Promise<any>} callback
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wrapped = {
      query: (text, params = []) => client.query(text, params),
    };
    const result = await callback(wrapped);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify DB connectivity (used on boot / health checks).
 */
async function healthCheck() {
  try {
    const { rows } = await pool.query('SELECT NOW() as now');
    return { ok: true, time: rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, queryOne, queryMany, transaction, healthCheck, close };
