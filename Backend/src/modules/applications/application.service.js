'use strict';

const { query, queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { reference } = require('../../utils/security');
const { getPagination, getSort } = require('../../utils/pagination');
const { canTransition, S } = require('./application.status');
const { ROLES, APPLICATION_STATUS, ADMISSION_CRITERIA } = require('../../utils/constants');
const emailService = require('../../services/email.service');
const logger = require('../../config/logger');

/* ------------------------------- Shaping ------------------------------- */

function shape(a) {
  return {
    id: a.id,
    reference: a.reference,
    applicantId: a.applicant_id,
    applicantName: a.applicant_name,
    applicantEmail: a.applicant_email,
    institutionId: a.institution_id,
    institutionName: a.institution_name,
    departmentId: a.department_id,
    departmentName: a.department_name,
    entryMode: a.entry_mode,
    jambScore: a.jamb_score != null ? Number(a.jamb_score) : null,
    postUtmeScore: a.post_utme_score != null ? Number(a.post_utme_score) : null,
    aggregateScore: a.aggregate_score != null ? Number(a.aggregate_score) : null,
    olevelResults: a.olevel_results,
    status: a.status,
    paymentStatus: a.payment_status,
    policyAccepted: a.policy_accepted,
    rank: a.rank,
    decisionNote: a.decision_note,
    state: a.state_of_origin,
    age: a.date_of_birth ? computeAge(a.date_of_birth) : null,
    createdAt: a.created_at,
    submittedAt: a.submitted_at,
    decidedAt: a.decided_at,
  };
}

function computeAge(dob) {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

const SELECT_JOINED = `
  SELECT a.*, u.full_name AS applicant_name, u.email AS applicant_email,
         i.name AS institution_name, d.name AS department_name,
         p.state_of_origin, p.date_of_birth
    FROM applications a
    JOIN users u ON u.id = a.applicant_id
    JOIN institutions i ON i.id = a.institution_id
    JOIN departments d ON d.id = a.department_id
    LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
`;

async function findById(id) {
  return queryOne(`${SELECT_JOINED} WHERE a.id = $1`, [id]);
}

/**
 * Persist a status change + history row and email the applicant.
 */
async function transitionStatus(client, application, toStatus, { note, changedBy } = {}) {
  const from = application.status;
  if (from !== toStatus && !canTransition(from, toStatus)) {
    throw ApiError.badRequest(`Cannot change status from "${from}" to "${toStatus}"`, {
      code: 'INVALID_TRANSITION',
    });
  }
  await client.query(
    `UPDATE applications SET status = $1, decision_note = COALESCE($2, decision_note),
        decided_at = NOW() WHERE id = $3`,
    [toStatus, note || null, application.id]
  );
  await client.query(
    `INSERT INTO application_status_history (application_id, from_status, to_status, note, changed_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [application.id, from, toStatus, note || null, changedBy || null]
  );
}

async function notifyStatus(application) {
  try {
    await emailService.sendApplicationStatus(application.applicant_email, application.applicant_name, {
      institution: application.institution_name,
      department: application.department_name,
      status: application.status,
      note: application.decision_note,
    });
  } catch (err) {
    logger.warn('Failed to send status email', { error: err.message });
  }
}

/* ---------------------------- Applicant flow --------------------------- */

/**
 * Create an application. Snapshots the applicant's verified JAMB/O-Level data.
 * Returns a PENDING_PAYMENT application; the payment module drives it to SUBMITTED.
 */
async function createApplication(userId, body) {
  const profile = await queryOne('SELECT * FROM applicant_profiles WHERE user_id = $1', [userId]);
  if (!profile) throw ApiError.badRequest('Complete your profile before applying');
  if (!profile.nin_verified) throw ApiError.badRequest('Verify your NIN before applying', { code: 'NIN_REQUIRED' });
  if (!profile.date_of_birth || !profile.state_of_origin) {
    throw ApiError.badRequest('Complete your biodata before applying', { code: 'BIODATA_REQUIRED' });
  }

  const department = await queryOne(
    `SELECT d.*, i.name AS institution_name, i.has_post_utme
       FROM departments d JOIN institutions i ON i.id = d.institution_id
      WHERE d.id = $1 AND d.institution_id = $2`,
    [body.departmentId, body.institutionId]
  );
  if (!department) throw ApiError.notFound('Department not found for that institution');
  if (!department.is_active) throw ApiError.badRequest('This department is not accepting applications');

  const params = await queryOne('SELECT * FROM institution_parameters WHERE institution_id = $1', [body.institutionId]);
  if (params && !params.admission_open) {
    throw ApiError.badRequest('Admissions are currently closed for this institution', { code: 'ADMISSION_CLOSED' });
  }

  const duplicate = await queryOne(
    'SELECT id FROM applications WHERE applicant_id = $1 AND department_id = $2',
    [userId, body.departmentId]
  );
  if (duplicate) throw ApiError.conflict('You already have an application to this department', { code: 'DUPLICATE_APPLICATION' });

  const jambScore = profile.jamb_data ? profile.jamb_data.jambScore : null;
  const olevelResults = profile.olevel_data ? profile.olevel_data.results : null;
  const ref = reference('TRU-APP');

  const app = await queryOne(
    `INSERT INTO applications
       (reference, applicant_id, institution_id, department_id, entry_mode,
        jamb_score, olevel_results, status, policy_accepted, policy_id, payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      ref, userId, body.institutionId, body.departmentId, profile.entry_mode || 'utme',
      jambScore, olevelResults ? JSON.stringify(olevelResults) : null,
      APPLICATION_STATUS.PENDING_PAYMENT, true, body.policyId || null, 'pending',
    ]
  );

  await query(
    `INSERT INTO application_status_history (application_id, to_status, note)
     VALUES ($1,$2,$3)`,
    [app.id, APPLICATION_STATUS.PENDING_PAYMENT, 'Application created; awaiting payment']
  );

  const joined = await findById(app.id);
  return shape(joined);
}

async function listMyApplications(userId, q) {
  const { page, limit, offset } = getPagination(q);
  const rows = await queryMany(
    `${SELECT_JOINED} WHERE a.applicant_id = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const total = (await queryOne('SELECT COUNT(*)::int AS t FROM applications WHERE applicant_id = $1', [userId])).t;
  return { data: rows.map(shape), total, page, limit };
}

async function getMyApplication(userId, id) {
  const a = await findById(id);
  if (!a || a.applicant_id !== userId) throw ApiError.notFound('Application not found');
  const history = await queryMany(
    `SELECT from_status, to_status, note, created_at FROM application_status_history
      WHERE application_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  const postUtme = await queryOne('SELECT * FROM post_utme WHERE application_id = $1', [id]);
  return { ...shape(a), history, postUtme: postUtme ? shapePostUtme(postUtme) : null };
}

async function getStatus(userId, id) {
  const a = await findById(id);
  if (!a || a.applicant_id !== userId) throw ApiError.notFound('Application not found');
  return {
    reference: a.reference,
    status: a.status,
    paymentStatus: a.payment_status,
    institution: a.institution_name,
    department: a.department_name,
    jambScore: a.jamb_score != null ? Number(a.jamb_score) : null,
    postUtmeScore: a.post_utme_score != null ? Number(a.post_utme_score) : null,
    aggregateScore: a.aggregate_score != null ? Number(a.aggregate_score) : null,
    decisionNote: a.decision_note,
  };
}

function shapePostUtme(p) {
  return {
    id: p.id,
    scheduledAt: p.scheduled_at,
    center: p.center,
    score: p.score != null ? Number(p.score) : null,
    maxScore: p.max_score != null ? Number(p.max_score) : null,
    completed: p.completed,
  };
}

/**
 * Applicant submits Post-UTME details for institutions that require it.
 */
async function submitPostUtme(userId, id, body) {
  const a = await findById(id);
  if (!a || a.applicant_id !== userId) throw ApiError.notFound('Application not found');
  if (a.status !== APPLICATION_STATUS.QUALIFIED_POST_UTME) {
    throw ApiError.badRequest('You are not currently eligible to submit Post-UTME details', {
      code: 'NOT_ELIGIBLE_POST_UTME',
    });
  }
  const existing = await queryOne('SELECT * FROM post_utme WHERE application_id = $1', [id]);
  if (existing) {
    const row = await queryOne(
      `UPDATE post_utme SET center = COALESCE($1,center), responses = COALESCE($2,responses)
         WHERE application_id = $3 RETURNING *`,
      [body.center || null, body.responses ? JSON.stringify(body.responses) : null, id]
    );
    return shapePostUtme(row);
  }
  const row = await queryOne(
    `INSERT INTO post_utme (application_id, center, responses) VALUES ($1,$2,$3) RETURNING *`,
    [id, body.center || null, body.responses ? JSON.stringify(body.responses) : null]
  );
  return shapePostUtme(row);
}

/* -------------------- Institution workflow (officer) ------------------- */

/**
 * Guard: ensure the acting institution user owns this application's institution.
 */
function assertOwnsInstitution(req, application) {
  if ([ROLES.ADMIN, ROLES.JAMB].includes(req.user.role)) return;
  if (String(application.institution_id) !== String(req.user.institutionId)) {
    throw ApiError.forbidden('This application belongs to another institution', {
      code: 'CROSS_INSTITUTION_FORBIDDEN',
    });
  }
}

async function listInstitutionApplications(req, institutionId, q) {
  const { page, limit, offset } = getPagination(q);
  const sort = getSort(q.sort, ['created_at', 'jamb_score', 'aggregate_score', 'rank'], 'a.created_at DESC');
  const filters = ['a.institution_id = $1', "a.status <> 'pending_payment'"];
  const params = [institutionId];
  let i = 2;
  if (q.status) { filters.push(`a.status = $${i++}`); params.push(q.status); }
  if (q.departmentId) { filters.push(`a.department_id = $${i++}`); params.push(q.departmentId); }
  if (q.state) { filters.push(`p.state_of_origin = $${i++}`); params.push(q.state); }
  if (q.search) { filters.push(`(u.full_name ILIKE $${i} OR a.reference ILIKE $${i})`); params.push(`%${q.search}%`); i++; }
  const where = `WHERE ${filters.join(' AND ')}`;

  const rows = await queryMany(
    `${SELECT_JOINED} ${where} ORDER BY ${sort} LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const total = (
    await queryOne(
      `SELECT COUNT(*)::int AS t FROM applications a
         JOIN users u ON u.id = a.applicant_id
         LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id ${where}`,
      params
    )
  ).t;
  return { data: rows.map(shape), total, page, limit };
}

async function getInstitutionApplication(req, id) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  const history = await queryMany(
    `SELECT from_status, to_status, note, created_at FROM application_status_history
       WHERE application_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  const postUtme = await queryOne('SELECT * FROM post_utme WHERE application_id = $1', [id]);
  return { ...shape(a), history, postUtme: postUtme ? shapePostUtme(postUtme) : null };
}

/**
 * Officer marks an applicant qualified (or not) for Post-UTME.
 */
async function considerPostUtme(req, id, qualified, note) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);

  const toStatus = qualified
    ? APPLICATION_STATUS.QUALIFIED_POST_UTME
    : APPLICATION_STATUS.NOT_QUALIFIED_POST_UTME;

  await transaction(async (client) => {
    await transitionStatus(client, a, toStatus, { note, changedBy: req.user.id });
    if (qualified) {
      await client.query(
        `INSERT INTO post_utme (application_id) VALUES ($1) ON CONFLICT (application_id) DO NOTHING`,
        [id]
      );
    }
  });
  const updated = await findById(id);
  await notifyStatus(updated);
  return shape(updated);
}

/**
 * Officer records the Post-UTME score. Computes aggregate per institution criteria.
 */
async function recordPostUtmeScore(req, id, { score, maxScore }) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  if (![APPLICATION_STATUS.QUALIFIED_POST_UTME].includes(a.status)) {
    throw ApiError.badRequest('Applicant must be qualified for Post-UTME first', { code: 'NOT_QUALIFIED' });
  }

  const params = await queryOne('SELECT * FROM institution_parameters WHERE institution_id = $1', [a.institution_id]);
  const aggregate = computeAggregate({
    jambScore: a.jamb_score != null ? Number(a.jamb_score) : 0,
    postUtmeScore: Number(score),
    postUtmeMax: maxScore || 100,
    criteria: params ? params.admission_criteria : ADMISSION_CRITERIA.JAMB_POSTUTME_AVERAGE,
    jambWeight: params ? Number(params.jamb_weight) : 0.5,
    postUtmeWeight: params ? Number(params.post_utme_weight) : 0.5,
  });

  await transaction(async (client) => {
    await client.query(
      `UPDATE post_utme SET score = $1, max_score = $2, completed = TRUE WHERE application_id = $3`,
      [score, maxScore || 100, id]
    );
    await client.query(
      `UPDATE applications SET post_utme_score = $1, aggregate_score = $2 WHERE id = $3`,
      [score, aggregate, id]
    );
    await transitionStatus(client, a, APPLICATION_STATUS.POST_UTME_COMPLETED, {
      note: `Post-UTME scored ${score}. Aggregate ${aggregate}.`,
      changedBy: req.user.id,
    });
  });
  const updated = await findById(id);
  return shape(updated);
}

/**
 * Normalise JAMB (out of 400) and Post-UTME to a comparable 100-scale aggregate.
 */
function computeAggregate({ jambScore, postUtmeScore, postUtmeMax, criteria, jambWeight, postUtmeWeight }) {
  const jamb100 = (jambScore / 400) * 100;
  const post100 = (postUtmeScore / (postUtmeMax || 100)) * 100;
  if (criteria === ADMISSION_CRITERIA.JAMB_ONLY) {
    return Number(jamb100.toFixed(2));
  }
  // Weighted average (defaults 0.5/0.5 -> plain average of the two normalised scores).
  const wTotal = (jambWeight || 0.5) + (postUtmeWeight || 0.5);
  const agg = (jamb100 * (jambWeight || 0.5) + post100 * (postUtmeWeight || 0.5)) / wTotal;
  return Number(agg.toFixed(2));
}

/**
 * Officer recommends an application for approval by the registrar.
 */
async function recommend(req, id, note) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  await transaction(async (client) => {
    await transitionStatus(client, a, APPLICATION_STATUS.RECOMMENDED, { note, changedBy: req.user.id });
    await client.query('UPDATE applications SET recommended_by = $1 WHERE id = $2', [req.user.id, id]);
  });
  const updated = await findById(id);
  return shape(updated);
}

/* ------------------- Institution workflow (registrar) ------------------ */

async function approve(req, id, note) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  await transaction(async (client) => {
    await transitionStatus(client, a, APPLICATION_STATUS.APPROVED, { note, changedBy: req.user.id });
    await client.query('UPDATE applications SET approved_by = $1 WHERE id = $2', [req.user.id, id]);
  });
  const updated = await findById(id);
  await notifyStatus(updated);
  return shape(updated);
}

async function reject(req, id, note) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  await transaction(async (client) => {
    await transitionStatus(client, a, APPLICATION_STATUS.REJECTED, {
      note: note || 'Application not successful',
      changedBy: req.user.id,
    });
  });
  const updated = await findById(id);
  await notifyStatus(updated);
  return shape(updated);
}

/**
 * Registrar forwards approved admissions to JAMB.
 */
async function forwardToJamb(req, id, note) {
  const a = await findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  assertOwnsInstitution(req, a);
  await transaction(async (client) => {
    await transitionStatus(client, a, APPLICATION_STATUS.FORWARDED_JAMB, {
      note: note || 'Forwarded to JAMB for final admission',
      changedBy: req.user.id,
    });
  });
  const updated = await findById(id);
  return shape(updated);
}

module.exports = {
  createApplication,
  listMyApplications,
  getMyApplication,
  getStatus,
  submitPostUtme,
  listInstitutionApplications,
  getInstitutionApplication,
  considerPostUtme,
  recordPostUtmeScore,
  recommend,
  approve,
  reject,
  forwardToJamb,
  findById,
  shape,
  computeAggregate,
  transitionStatus,
  notifyStatus,
};
