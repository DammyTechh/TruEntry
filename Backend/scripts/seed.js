'use strict';
/**
 * Standalone: create OR reset the super admin.
 *   node scripts/seed-admin.js
 *
 * Uses the app's own bcryptjs hashing (cost from BCRYPT_ROUNDS, default 12),
 * so the produced hash is guaranteed compatible with login.
 *
 * Override via env if you like:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
const { pool, queryOne } = require('../src/config/database');
const { hashPassword } = require('../src/utils/security');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@truentry.org';
  const password = process.env.SEED_ADMIN_PASSWORD || 'TruEntry@2026';
  const name = process.env.SEED_ADMIN_NAME || 'System Administrator';

  const passwordHash = await hashPassword(password);
  const row = await queryOne(
    `INSERT INTO users (email, password_hash, role, full_name, is_email_verified, is_active)
     VALUES ($1, $2, 'admin', $3, TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin', is_email_verified = TRUE, is_active = TRUE, updated_at = NOW()
     RETURNING id, email`,
    [email, passwordHash, name]
  );
  console.log(`✔ Super admin ready: ${row.email} (id ${row.id})`);
  console.log(`  Password set to: ${password}`);
  await pool.end();
}

main().catch((err) => {
  console.error('✖ Failed to seed admin:', err.message);
  process.exit(1);
});