'use strict';

const { query, queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { getPagination } = require('../../utils/pagination');
const { hashPassword, randomToken } = require('../../utils/security');
const { ROLES } = require('../../utils/constants');
const emailService = require('../../services/email.service');
const logger = require('../../config/logger');

/* ------------------------------ Dashboard ------------------------------ */

async function dashboard() {
  const users = await queryOne(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE role = 'applicant')::int AS applicants,
        COUNT(*) FILTER (WHERE role = 'officer')::int AS officers,
        COUNT(*) FILTER (WHERE role = 'registrar')::int AS registrars,
        COUNT(*) FILTER (WHERE role = 'jamb')::int AS jamb,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
        COUNT(*) FILTER (WHERE is_active = FALSE)::int AS deactivated
       FROM users`
  );
  const institutions = await queryOne(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active)::int AS active,
            COUNT(*) FILTER (WHERE has_post_utme)::int AS with_post_utme
       FROM institutions`
  );
  const applications = await queryOne(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted,
        COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review,
        COUNT(*) FILTER (WHERE status = 'recommended')::int AS recommended,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'forwarded_jamb')::int AS forwarded_jamb,
        COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted
       FROM applications`
  );
  const finance = await queryOne(
    `SELECT
        COALESCE(SUM(amount_kobo) FILTER (WHERE status = 'success'),0)::bigint AS revenue_kobo,
        COUNT(*) FILTER (WHERE status = 'success')::int AS successful_payments,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_payments,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_payments
       FROM payments`
  );
  const recentApplications = await queryMany(
    `SELECT a.reference, u.full_name, i.name AS institution, a.status, a.created_at
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       JOIN institutions i ON i.id = a.institution_id
       ORDER BY a.created_at DESC LIMIT 10`
  );

  return {
    users,
    institutions,
    applications,
    finance: {
      revenueNaira: Number(finance.revenue_kobo) / 100,
      successfulPayments: finance.successful_payments,
      pendingPayments: finance.pending_payments,
      failedPayments: finance.failed_payments,
    },
    recentApplications,
  };
}

/**
 * Per-institution progress: approved / processed / admitted counts.
 */
async function institutionStatus() {
  return queryMany(
    `SELECT i.id, i.name,
            COUNT(a.*)::int AS total_applications,
            COUNT(a.*) FILTER (WHERE a.status = 'recommended')::int AS recommended,
            COUNT(a.*) FILTER (WHERE a.status = 'approved')::int AS approved,
            COUNT(a.*) FILTER (WHERE a.status = 'forwarded_jamb')::int AS forwarded,
            COUNT(a.*) FILTER (WHERE a.status = 'admitted')::int AS admitted
       FROM institutions i
       LEFT JOIN applications a ON a.institution_id = i.id
       GROUP BY i.id, i.name ORDER BY i.name ASC`
  );
}

/* -------------------------------- Users -------------------------------- */

function shapeUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    phone: u.phone,
    role: u.role,
    institutionId: u.institution_id,
    institutionName: u.institution_name,
    isEmailVerified: u.is_email_verified,
    isActive: u.is_active,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

async function listUsers(q) {
  const { page, limit, offset } = getPagination(q);
  const filters = [];
  const params = [];
  let i = 1;
  if (q.role) { filters.push(`u.role = $${i++}`); params.push(q.role); }
  if (q.institutionId) { filters.push(`u.institution_id = $${i++}`); params.push(q.institutionId); }
  if (q.isActive) { filters.push(`u.is_active = $${i++}`); params.push(q.isActive === 'true'); }
  if (q.search) { filters.push(`(u.full_name ILIKE $${i} OR u.email ILIKE $${i})`); params.push(`%${q.search}%`); i++; }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await queryMany(
    `SELECT u.*, i.name AS institution_name FROM users u
       LEFT JOIN institutions i ON i.id = u.institution_id
       ${where} ORDER BY u.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*)::int AS t FROM users u ${where}`, params)).t;
  return { data: rows.map(shapeUser), total, page, limit };
}

async function getUser(id) {
  const u = await queryOne(
    `SELECT u.*, i.name AS institution_name FROM users u
       LEFT JOIN institutions i ON i.id = u.institution_id WHERE u.id = $1`,
    [id]
  );
  if (!u) throw ApiError.notFound('User not found');
  return shapeUser(u);
}

/**
 * Create a staff user (officer/registrar/jamb/admin). A temporary password is
 * generated and emailed to them. Officers/registrars require an institution.
 */
async function createStaff(body, actor) {
  const role = body.role;
  if (![ROLES.OFFICER, ROLES.REGISTRAR, ROLES.JAMB, ROLES.ADMIN].includes(role)) {
    throw ApiError.badRequest('Invalid staff role');
  }
  if ([ROLES.OFFICER, ROLES.REGISTRAR].includes(role) && !body.institutionId) {
    throw ApiError.badRequest('institutionId is required for institution staff', { code: 'INSTITUTION_REQUIRED' });
  }
  if (body.institutionId) {
    const inst = await queryOne('SELECT id FROM institutions WHERE id = $1', [body.institutionId]);
    if (!inst) throw ApiError.notFound('Institution not found');
  }
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [body.email]);
  if (existing) throw ApiError.conflict('A user with that email already exists');

  const tempPassword = body.password || `${randomToken(4)}Aa1!`;
  const passwordHash = await hashPassword(tempPassword);

  const user = await queryOne(
    `INSERT INTO users (email, password_hash, role, full_name, phone, institution_id, is_email_verified, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING *`,
    [body.email, passwordHash, role, body.fullName, body.phone || null, body.institutionId || null, actor.id]
  );

  try {
    await emailService.sendCredentials(body.email, body.fullName, {
      email: body.email,
      password: tempPassword,
      role,
    });
  } catch (err) {
    logger.warn('Failed to email credentials', { error: err.message });
  }

  return { user: shapeUser(user), temporaryPassword: body.password ? undefined : tempPassword };
}

/**
 * Manually create an applicant account (admin-driven onboarding).
 */
async function createApplicant(body, actor) {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [body.email]);
  if (existing) throw ApiError.conflict('A user with that email already exists');
  const tempPassword = body.password || `${randomToken(4)}Aa1!`;
  const passwordHash = await hashPassword(tempPassword);

  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone, is_email_verified, created_by)
       VALUES ($1,$2,'applicant',$3,$4,TRUE,$5) RETURNING *`,
      [body.email, passwordHash, body.fullName, body.phone || null, actor.id]
    );
    await client.query('INSERT INTO applicant_profiles (user_id) VALUES ($1)', [rows[0].id]);
    return rows[0];
  });

  try {
    await emailService.sendCredentials(body.email, body.fullName, {
      email: body.email, password: tempPassword, role: 'applicant',
    });
  } catch (err) {
    logger.warn('Failed to email applicant credentials', { error: err.message });
  }
  return { user: shapeUser(user), temporaryPassword: body.password ? undefined : tempPassword };
}

async function updateUser(id, body) {
  const existing = await queryOne('SELECT * FROM users WHERE id = $1', [id]);
  if (!existing) throw ApiError.notFound('User not found');
  const map = { fullName: 'full_name', phone: 'phone', institutionId: 'institution_id', isActive: 'is_active' };
  const sets = []; const values = []; let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = $${i++}`); values.push(body[k]); }
  }
  if (!sets.length) return shapeUser(existing);
  values.push(id);
  const row = await queryOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return shapeUser(row);
}

async function setActive(id, isActive) {
  const row = await queryOne('UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *', [isActive, id]);
  if (!row) throw ApiError.notFound('User not found');
  return shapeUser(row);
}

async function resetUserPassword(id) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) throw ApiError.notFound('User not found');
  const tempPassword = `${randomToken(4)}Aa1!`;
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(tempPassword), id]);
  // Revoke sessions.
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
  try {
    await emailService.sendCredentials(user.email, user.full_name, {
      email: user.email, password: tempPassword, role: user.role,
    });
  } catch (err) {
    logger.warn('Failed to email reset credentials', { error: err.message });
  }
  return { temporaryPassword: tempPassword };
}

/* ------------------------------ Finances ------------------------------- */

async function finances(q) {
  const { page, limit, offset } = getPagination(q);
  const filters = [];
  const params = [];
  let i = 1;
  if (q.status) { filters.push(`p.status = $${i++}`); params.push(q.status); }
  if (q.from) { filters.push(`p.created_at >= $${i++}`); params.push(q.from); }
  if (q.to) { filters.push(`p.created_at <= $${i++}`); params.push(q.to); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await queryMany(
    `SELECT p.*, u.full_name, u.email, a.reference AS application_ref
       FROM payments p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN applications a ON a.id = p.application_id
       ${where} ORDER BY p.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*)::int AS t FROM payments p ${where}`, params)).t;
  const totals = await queryOne(
    `SELECT COALESCE(SUM(amount_kobo) FILTER (WHERE status='success'),0)::bigint AS revenue_kobo
       FROM payments p ${where}`,
    params
  );
  return {
    data: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      user: r.full_name,
      email: r.email,
      applicationRef: r.application_ref,
      amountNaira: Number(r.amount_kobo) / 100,
      status: r.status,
      channel: r.channel,
      paidAt: r.paid_at,
      createdAt: r.created_at,
    })),
    total, page, limit,
    revenueNaira: Number(totals.revenue_kobo) / 100,
  };
}

/* ----------------------------- Audit logs ------------------------------ */

async function auditLogs(q) {
  const { page, limit, offset } = getPagination(q);
  const filters = [];
  const params = [];
  let i = 1;
  if (q.action) { filters.push(`l.action ILIKE $${i++}`); params.push(`%${q.action}%`); }
  if (q.entity) { filters.push(`l.entity = $${i++}`); params.push(q.entity); }
  if (q.userId) { filters.push(`l.actor_id = $${i++}`); params.push(q.userId); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await queryMany(
    `SELECT l.*, u.full_name, u.email FROM audit_logs l
       LEFT JOIN users u ON u.id = l.actor_id
       ${where} ORDER BY l.created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*)::int AS t FROM audit_logs l ${where}`, params)).t;
  return {
    data: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      user: r.full_name,
      email: r.email,
      ip: r.ip_address,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
    total, page, limit,
  };
}

/* --------------------------- Mock data mgmt ---------------------------- */

async function listMock(kind, q) {
  const table = { jamb: 'mock_jamb_records', olevel: 'mock_olevel_records', nin: 'mock_nin_records' }[kind];
  if (!table) throw ApiError.badRequest('Invalid mock data kind');
  const { page, limit, offset } = getPagination(q);
  const rows = await queryMany(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*)::int AS t FROM ${table}`)).t;
  return { data: rows, total, page, limit };
}

async function createMock(kind, body) {
  if (kind === 'jamb') {
    return queryOne(
      `INSERT INTO mock_jamb_records (jamb_reg_no, full_name, jamb_score, date_of_birth, gender, state_of_origin, subjects, exam_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.regNo || body.jambRegNo, body.fullName, body.jambScore, body.dateOfBirth || null, body.gender || null,
       body.stateOfOrigin || null, body.subjects ? JSON.stringify(body.subjects) : null, body.examYear || null]
    );
  }
  if (kind === 'olevel') {
    return queryOne(
      `INSERT INTO mock_olevel_records (exam_type, reg_no, full_name, results, exam_year)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.examType, body.regNo, body.fullName, JSON.stringify(body.results || []), body.examYear || null]
    );
  }
  if (kind === 'nin') {
    return queryOne(
      `INSERT INTO mock_nin_records (nin, first_name, last_name, middle_name, date_of_birth, gender, state_of_origin, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.nin, body.firstName || null, body.lastName || null, body.middleName || null,
       body.dateOfBirth || null, body.gender || null, body.stateOfOrigin || null, body.phone || null]
    );
  }
  throw ApiError.badRequest('Invalid mock data kind');
}

module.exports = {
  dashboard,
  institutionStatus,
  listUsers,
  getUser,
  createStaff,
  createApplicant,
  updateUser,
  setActive,
  resetUserPassword,
  finances,
  auditLogs,
  listMock,
  createMock,
};
