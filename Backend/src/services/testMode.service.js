'use strict';

/**
 * ==========================================================================
 * TESTING SWITCH — free onboarding (no NIN lookup, no Paystack charge)
 * ==========================================================================
 *
 * This file is the ONLY place that decides whether the testing shortcut is on.
 * The real NIN lookup and the real Paystack checkout are untouched; each of
 * them asks `isFreeOnboarding()` once, at the top, and returns early when it
 * is on. Turn the switch off and the live code runs exactly as before.
 *
 * Where it is read:
 *   • services/nin.service.js           validateNin()       → skip Dojah
 *   • modules/profile/profile.service   verifyNin()         → allow a NIN on
 *                                                             several accounts
 *   • modules/payments/payment.service  initializeSession() → skip Paystack
 *   • modules/sessions/session.service  quote()             → tells the UI
 *
 * How it is turned on (either is enough):
 *   1. Admin → Fees → "Testing mode" toggle (stored in app_settings), or
 *   2. TEST_MODE_FREE_ONBOARDING=true in the environment (forces it on; the
 *      admin toggle cannot switch it off while the env var is set).
 *
 * Records created while it is on are tagged so they can be found later:
 *   payments.channel = 'test_mode'   and   applicant_profiles.nin_data.simulated
 * See Backend/TEST_MODE.md for the clean-up SQL.
 * ==========================================================================
 */

const config = require('../config');
const logger = require('../config/logger');
const { query, queryOne } = require('../config/database');

const KEY = 'test_mode_free_onboarding';
const CACHE_MS = 15 * 1000;

let cache = null; // { value, at }
let tableReady = false;

/**
 * The settings table is created by migrations/0009_app_settings.sql. It is also
 * created here on first use so the switch works on a database where that
 * migration has not been run yet. The first-ever value is ON, because the
 * switch was introduced specifically so the team could test end to end.
 */
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_by  UUID,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, 'true'::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [KEY]
  );
  tableReady = true;
}

function envForcesOn() {
  return Boolean(config.testMode.freeOnboarding);
}

async function storedValue() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    await ensureTable();
    const row = await queryOne('SELECT value, updated_at FROM app_settings WHERE key = $1', [KEY]);
    const value = row ? row.value === true : false;
    cache = { value, at: Date.now(), updatedAt: row?.updated_at || null };
    return value;
  } catch (err) {
    // Never let a settings read break onboarding: fall back to "off" so the
    // real checks run.
    logger.error('Could not read the testing switch; treating it as OFF', { error: err.message });
    return false;
  }
}

/** True when NIN lookups and the exam-processing payment should be skipped. */
async function isFreeOnboarding() {
  if (envForcesOn()) return true;
  return storedValue();
}

/** Full state for the admin screen. */
async function status() {
  const stored = await storedValue();
  return {
    enabled: envForcesOn() || stored,
    storedValue: stored,
    forcedByEnvironment: envForcesOn(),
    updatedAt: cache?.updatedAt || null,
  };
}

async function setEnabled(enabled, userId) {
  await ensureTable();
  await query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
                                     updated_by = EXCLUDED.updated_by,
                                     updated_at = NOW()`,
    [KEY, JSON.stringify(Boolean(enabled)), userId || null]
  );
  cache = null;
  logger.warn(`Testing switch turned ${enabled ? 'ON' : 'OFF'}`, { userId });
  return status();
}

module.exports = { isFreeOnboarding, status, setEnabled };
