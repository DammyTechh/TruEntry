'use strict';

const { queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { getPagination, getSort } = require('../../utils/pagination');
const { APPLICATION_STATUS } = require('../../utils/constants');
const { canTransition } = require('../applications/application.status');
const applicationService = require('../applications/application.service');
const emailService = require('../../services/email.service');
const logger = require('../../config/logger');

const SELECT = `
  SELECT a.*, u.full_name AS applicant_name, u.email AS applicant_email,
         i.name AS institution_name, d.name AS department_name,
         p.state_of_origin, p.date_of_birth, p.olevel_data
    FROM applications a
    JOIN users u ON u.id = a.applicant_id
    JOIN institutions i ON i.id = a.institution_id
    JOIN departments d ON d.id = a.department_id
    LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
`;

function age(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function shape(a) {
  return {
    id: a.id,
    reference: a.reference,
    applicantName: a.applicant_name,
    applicantEmail: a.applicant_email,
    institutionId: a.institution_id,
    institutionName: a.institution_name,
    departmentName: a.department_name,
    state: a.state_of_origin,
    age: age(a.date_of_birth),
    jambScore: a.jamb_score != null ? Number(a.jamb_score) : null,
    postUtmeScore: a.post_utme_score != null ? Number(a.post_utme_score) : null,
    aggregateScore: a.aggregate_score != null ? Number(a.aggregate_score) : null,
    olevelCredits: a.olevel_data && a.olevel_data.credits != null ? a.olevel_data.credits : null,
    status: a.status,
    rank: a.rank,
    createdAt: a.created_at,
  };
}

/**
 * Regulator-wide applicant listing with rich filters for audit.
 */
async function listApplicants(q) {
  const { page, limit, offset } = getPagination(q);
  const sort = getSort(q.sort, ['created_at', 'jamb_score', 'aggregate_score', 'rank'], 'a.created_at DESC');
  const filters = [];
  const params = [];
  let i = 1;

  if (q.institutionId) { filters.push(`a.institution_id = $${i++}`); params.push(q.institutionId); }
  if (q.departmentId) { filters.push(`a.department_id = $${i++}`); params.push(q.departmentId); }
  if (q.status) { filters.push(`a.status = $${i++}`); params.push(q.status); }
  if (q.state) { filters.push(`p.state_of_origin = $${i++}`); params.push(q.state); }
  if (q.minJamb) { filters.push(`a.jamb_score >= $${i++}`); params.push(Number(q.minJamb)); }
  if (q.maxJamb) { filters.push(`a.jamb_score <= $${i++}`); params.push(Number(q.maxJamb)); }
  if (q.minPostUtme) { filters.push(`a.post_utme_score >= $${i++}`); params.push(Number(q.minPostUtme)); }
  if (q.minAge) { filters.push(`p.date_of_birth <= (NOW() - ($${i++} || ' years')::interval)`); params.push(Number(q.minAge)); }
  if (q.maxAge) { filters.push(`p.date_of_birth >= (NOW() - ($${i++} || ' years')::interval)`); params.push(Number(q.maxAge)); }
  if (q.search) { filters.push(`(u.full_name ILIKE $${i} OR a.reference ILIKE $${i})`); params.push(`%${q.search}%`); i++; }

  // Regulator only sees applications that have progressed beyond payment.
  filters.push(`a.status <> 'pending_payment'`);
  filters.push(`a.status <> 'draft'`);

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await queryMany(
    `${SELECT} ${where} ORDER BY ${sort} LIMIT $${i++} OFFSET $${i}`,
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

async function listForwarded(q) {
  return listApplicants({ ...q, status: APPLICATION_STATUS.FORWARDED_JAMB });
}

async function listAdmitted(q) {
  return listApplicants({ ...q, status: APPLICATION_STATUS.ADMITTED });
}

async function getApplicant(id) {
  const a = await queryOne(`${SELECT} WHERE a.id = $1`, [id]);
  if (!a) throw ApiError.notFound('Application not found');
  const history = await queryMany(
    `SELECT from_status, to_status, note, created_at FROM application_status_history
       WHERE application_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  return { ...shape(a), history };
}

/**
 * JAMB final admission decision on a forwarded application.
 */
async function decide(id, admit, note, actorId) {
  const a = await applicationService.findById(id);
  if (!a) throw ApiError.notFound('Application not found');
  if (a.status !== APPLICATION_STATUS.FORWARDED_JAMB) {
    throw ApiError.badRequest('Only applications forwarded to JAMB can be decided here', {
      code: 'NOT_FORWARDED',
    });
  }
  const toStatus = admit ? APPLICATION_STATUS.ADMITTED : APPLICATION_STATUS.NOT_ADMITTED;
  if (!canTransition(a.status, toStatus)) {
    throw ApiError.badRequest('Invalid transition');
  }
  await transaction(async (client) => {
    await applicationService.transitionStatus(client, a, toStatus, { note, changedBy: actorId });
  });
  const updated = await applicationService.findById(id);
  await applicationService.notifyStatus(updated);
  return applicationService.shape(updated);
}

/**
 * Regulator statistics for the JAMB dashboard.
 */
async function stats(q = {}) {
  const params = [];
  let where = '';
  if (q.institutionId) { where = 'WHERE institution_id = $1'; params.push(q.institutionId); }
  const row = await queryOne(
    `SELECT
        COUNT(*)::int AS total_applications,
        COUNT(*) FILTER (WHERE status = 'forwarded_jamb')::int AS awaiting_decision,
        COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted,
        COUNT(*) FILTER (WHERE status = 'not_admitted')::int AS not_admitted
       FROM applications ${where}`,
    params
  );
  const byInstitution = await queryMany(
    `SELECT i.name AS institution, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status = 'admitted')::int AS admitted
       FROM applications a JOIN institutions i ON i.id = a.institution_id
       ${q.institutionId ? 'WHERE a.institution_id = $1' : ''}
       GROUP BY i.name ORDER BY total DESC LIMIT 20`,
    params
  );
  return { ...row, byInstitution };
}

/**
 * Contact an institution (emails the institution's registered address).
 */
async function contactInstitution(institutionId, { subject, message }, actor) {
  const inst = await queryOne('SELECT * FROM institutions WHERE id = $1', [institutionId]);
  if (!inst) throw ApiError.notFound('Institution not found');
  if (!inst.email) throw ApiError.badRequest('This institution has no contact email on file');
  try {
    await emailService.sendContactMessage(inst.email, {
      fromName: `JAMB (${actor.fullName || 'Regulator'})`,
      fromEmail: actor.email,
      subject,
      message,
    });
  } catch (err) {
    logger.error('Failed to contact institution', { error: err.message });
    throw ApiError.serviceUnavailable('Unable to send the message right now');
  }
  return { sent: true };
}

module.exports = {
  listApplicants,
  listForwarded,
  listAdmitted,
  getApplicant,
  decide,
  stats,
  contactInstitution,
};
