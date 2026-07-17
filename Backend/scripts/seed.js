'use strict';

/**
 * Bootstraps the system:
 *  - a super admin from SEED_ADMIN_* env vars
 *  - a couple of demo institutions (one with Post-UTME, one without) so the
 *    admissions workflow can be exercised end to end against the seeded mock
 *    JAMB/O-Level/NIN records already inserted by the migration.
 *
 * Idempotent: re-running will not duplicate rows.
 */
const { pool, queryOne } = require('../src/config/database');
const { hashPassword } = require('../src/utils/security');
const logger = require('../src/config/logger');

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@truentry.org';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe_Admin123!';
  const name = process.env.SEED_ADMIN_NAME || 'System Administrator';

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    logger.info(`Super admin already exists: ${email}`);
    return existing.id;
  }
  const passwordHash = await hashPassword(password);
  const row = await queryOne(
    `INSERT INTO users (email, password_hash, role, full_name, is_email_verified, is_active)
     VALUES ($1,$2,'admin',$3,TRUE,TRUE) RETURNING id`,
    [email, passwordHash, name]
  );
  logger.info(`Created super admin: ${email} (password from SEED_ADMIN_PASSWORD)`);
  return row.id;
}

async function seedInstitutions() {
  const category = await queryOne(
    `SELECT id FROM institution_categories ORDER BY name ASC LIMIT 1`
  );
  const categoryId = category ? category.id : null;

  const demos = [
    { name: 'University of Lagos', code: 'UNILAG', hasPostUtme: true, state: 'Lagos', email: 'admissions@unilag.edu.ng' },
    { name: 'Federal Polytechnic Nekede', code: 'FPNO', hasPostUtme: false, state: 'Imo', email: 'admissions@fpno.edu.ng' },
  ];

  for (const d of demos) {
    let inst = await queryOne('SELECT id FROM institutions WHERE code = $1', [d.code]);
    if (!inst) {
      inst = await queryOne(
        `INSERT INTO institutions (name, code, category_id, has_post_utme, state, email)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [d.name, d.code, categoryId, d.hasPostUtme, d.state, d.email]
      );
      await queryOne(
        `INSERT INTO institution_parameters (institution_id, admission_criteria, total_quota, admission_open)
         VALUES ($1,$2,$3,TRUE) RETURNING id`,
        [inst.id, d.hasPostUtme ? 'jamb_postutme_average' : 'jamb_only', 100]
      );
      logger.info(`Created demo institution: ${d.name}`);
    }
    // Ensure a demo department exists.
    const dept = await queryOne(
      'SELECT id FROM departments WHERE institution_id = $1 AND name = $2',
      [inst.id, 'Computer Science']
    );
    if (!dept) {
      await queryOne(
        `INSERT INTO departments (institution_id, name, code, admission_quota, jamb_cutoff, aggregate_cutoff)
         VALUES ($1,'Computer Science','CSC',50,200,50) RETURNING id`,
        [inst.id]
      );
      logger.info(`  + department Computer Science for ${d.name}`);
    }
  }
}

async function run() {
  await seedAdmin();
  await seedInstitutions();
  logger.info('Seed complete');
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', { error: err.message, stack: err.stack });
    pool.end().finally(() => process.exit(1));
  });
