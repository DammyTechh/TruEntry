'use strict';

/**
 * Institution onboarding (admin-driven).
 *
 * An administrator registers a school with its basic profile. The system:
 *   1. creates the institution record,
 *   2. creates ONE login for the school (role: 'institution'),
 *   3. generates a strong random password,
 *   4. flags the account so the password MUST be changed on first login,
 *   5. emails the credentials to the school's official address.
 *
 * The institution then signs in through the same /auth/login endpoint as every
 * other role — there is no separate auth stack.
 */

const crypto = require('crypto');
const { query, queryOne, transaction } = require('../../config/database');
const { hashPassword } = require('../../utils/security');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const email = require('../../services/email.service');
const { ROLES } = require('../../utils/constants');

/**
 * Generates a readable but strong temporary password, e.g. "Trky-7Fq2-93Xb".
 * Guaranteed to satisfy the platform rule (8+ chars, upper, lower, digit).
 */
function generateTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O
  const lower = 'abcdefghijkmnopqrstuvwxyz'; // no l
  const digits = '23456789'; // no 0/1
  const all = upper + lower + digits;

  const pick = (set) => set[crypto.randomInt(0, set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));

  // Fisher-Yates with CSPRNG.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const s = chars.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function shapeInstitution(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    email: row.email,
    phone: row.phone,
    state: row.state,
    region: row.region,
    lga: row.lga,
    address: row.address,
    logoUrl: row.logo_url,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    institutionType: row.institution_type || null,
    hasPostUtme: row.has_post_utme,
    isActive: row.is_active,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
  };
}

/**
 * Onboard a new institution and issue its login.
 *
 * @param {object} input
 * @param {string} input.name            Institution name
 * @param {string} input.code            Short unique code (e.g. UNILAG)
 * @param {string} input.email           Official email — receives the credentials
 * @param {string} [input.state]         State
 * @param {string} [input.region]        Geopolitical region
 * @param {string} [input.lga]           LGA
 * @param {string} [input.address]
 * @param {string} [input.phone]
 * @param {string} [input.categoryId]    institution_categories.id
 * @param {string} [input.logoUrl]       Public URL of the uploaded logo
 * @param {boolean} [input.hasPostUtme]
 * @param {string}  adminUserId          The admin performing the onboarding
 */
async function onboardInstitution(input, adminUserId) {
  const existingCode = await queryOne('SELECT id FROM institutions WHERE code = $1', [input.code]);
  if (existingCode) {
    throw ApiError.conflict('An institution with this code already exists', { code: 'CODE_TAKEN' });
  }

  const existingUser = await queryOne('SELECT id FROM users WHERE email = $1', [input.email]);
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists', { code: 'EMAIL_TAKEN' });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const result = await transaction(async (client) => {
    const { rows: instRows } = await client.query(
      `INSERT INTO institutions
         (name, code, email, phone, state, region, lga, address, logo_url,
          category_id, has_post_utme, onboarded_by, onboarded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING *`,
      [
        input.name,
        input.code.toUpperCase(),
        input.email,
        input.phone || null,
        input.state || null,
        input.region || null,
        input.lga || null,
        input.address || null,
        input.logoUrl || null,
        input.categoryId || null,
        input.hasPostUtme ?? false,
        adminUserId,
      ]
    );
    const institution = instRows[0];

    // One login per school. Verified immediately (the admin vouches for the
    // address) but locked behind a mandatory password change.
    const { rows: userRows } = await client.query(
      `INSERT INTO users
         (email, password_hash, role, full_name, phone, institution_id,
          is_email_verified, is_active, must_change_password, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE,TRUE,$7)
       RETURNING *`,
      [
        input.email,
        passwordHash,
        ROLES.INSTITUTION,
        input.name,
        input.phone || null,
        institution.id,
        adminUserId,
      ]
    );

    // Give the institution a default parameter row so its dashboard has state.
    await client.query(
      `INSERT INTO institution_parameters (institution_id)
       VALUES ($1) ON CONFLICT (institution_id) DO NOTHING`,
      [institution.id]
    );

    return { institution, user: userRows[0] };
  });

  // Email the credentials. A mail failure must not roll back onboarding — the
  // admin can resend from the dashboard.
  let emailed = true;
  try {
    await email.sendInstitutionCredentials(input.email, {
      institutionName: input.name,
      email: input.email,
      password: temporaryPassword,
    });
  } catch (err) {
    emailed = false;
    logger.error('Institution credentials email failed', { institution: input.code, error: err.message });
  }

  logger.info('Institution onboarded', { code: input.code, by: adminUserId, emailed });

  return {
    institution: shapeInstitution(result.institution),
    account: { id: result.user.id, email: result.user.email, role: result.user.role },
    credentialsEmailed: emailed,
  };
}

/**
 * Re-issue a temporary password for an institution and email it again.
 * Used when a school never received (or lost) the first message.
 */
async function resendCredentials(institutionId) {
  const institution = await queryOne('SELECT * FROM institutions WHERE id = $1', [institutionId]);
  if (!institution) throw ApiError.notFound('Institution not found');

  const user = await queryOne(
    `SELECT * FROM users WHERE institution_id = $1 AND role = $2 ORDER BY created_at LIMIT 1`,
    [institutionId, ROLES.INSTITUTION]
  );
  if (!user) throw ApiError.notFound('This institution has no login account');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await transaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2`,
      [passwordHash, user.id]
    );
    // Any existing session is invalidated.
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id]
    );
  });

  await email.sendInstitutionCredentials(user.email, {
    institutionName: institution.name,
    email: user.email,
    password: temporaryPassword,
    reissued: true,
  });

  logger.info('Institution credentials re-issued', { institutionId });
  return { resent: true, email: user.email };
}

/** List institutions with their onboarding/account status (admin view). */
async function listOnboarded({ page = 1, limit = 20, search, type }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(i.name ILIKE $${params.length} OR i.code ILIKE $${params.length})`);
  }
  if (type) {
    params.push(type);
    where.push(`c.type = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT i.*, c.name AS category_name, c.type AS institution_type,
            u.id AS account_id, u.email AS account_email,
            u.must_change_password, u.last_login_at, u.is_active AS account_active
       FROM institutions i
       LEFT JOIN institution_categories c ON c.id = i.category_id
       LEFT JOIN users u ON u.institution_id = i.id AND u.role = '${ROLES.INSTITUTION}'
       ${whereSql}
       ORDER BY i.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(
    `SELECT COUNT(*)::int AS total
       FROM institutions i
       LEFT JOIN institution_categories c ON c.id = i.category_id
       ${whereSql}`,
    params
  );

  return {
    items: rows.map((r) => ({
      ...shapeInstitution(r),
      account: r.account_id
        ? {
            id: r.account_id,
            email: r.account_email,
            mustChangePassword: r.must_change_password,
            lastLoginAt: r.last_login_at,
            isActive: r.account_active,
            hasSignedIn: Boolean(r.last_login_at),
          }
        : null,
    })),
    total: countRow?.total || 0,
  };
}

module.exports = {
  onboardInstitution,
  resendCredentials,
  listOnboarded,
  generateTemporaryPassword,
  shapeInstitution,
};
