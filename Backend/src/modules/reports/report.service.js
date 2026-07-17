'use strict';

const { query, queryOne, queryMany } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { reference: makeRef } = require('../../utils/security');
const { getPagination } = require('../../utils/pagination');
const pdfService = require('../../services/pdf.service');
const storageService = require('../../services/storage.service');
const { REPORT_TYPES, ROLES, APPLICATION_STATUS } = require('../../utils/constants');

/**
 * Build the aggregate + row data used in an audit report for an institution
 * (optionally filtered to a department).
 */
async function buildAuditData(institutionId, departmentId) {
  const institution = await queryOne('SELECT * FROM institutions WHERE id = $1', [institutionId]);
  if (!institution) throw ApiError.notFound('Institution not found');

  const filters = ['a.institution_id = $1'];
  const params = [institutionId];
  if (departmentId) { filters.push('a.department_id = $2'); params.push(departmentId); }
  const where = `WHERE ${filters.join(' AND ')}`;

  const summaryRow = await queryOne(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.status = 'submitted')::int AS submitted,
        COUNT(*) FILTER (WHERE a.status = 'recommended')::int AS recommended,
        COUNT(*) FILTER (WHERE a.status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE a.status = 'forwarded_jamb')::int AS forwarded,
        COUNT(*) FILTER (WHERE a.status = 'admitted')::int AS admitted,
        COUNT(*) FILTER (WHERE a.status IN ('rejected','not_admitted','not_qualified_post_utme'))::int AS unsuccessful
       FROM applications a ${where}`,
    params
  );

  const rows = await queryMany(
    `SELECT a.reference, u.full_name, d.name AS department, a.jamb_score,
            a.post_utme_score, a.aggregate_score, a.status, a.rank, p.state_of_origin
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       JOIN departments d ON d.id = a.department_id
       LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
       ${where}
       ORDER BY d.name ASC, a.rank ASC NULLS LAST, a.aggregate_score DESC NULLS LAST`,
    params
  );

  return {
    institution,
    summary: summaryRow,
    applicants: rows.map((r) => ({
      reference: r.reference,
      name: r.full_name,
      department: r.department,
      state: r.state_of_origin,
      jambScore: r.jamb_score != null ? Number(r.jamb_score) : null,
      postUtmeScore: r.post_utme_score != null ? Number(r.post_utme_score) : null,
      aggregateScore: r.aggregate_score != null ? Number(r.aggregate_score) : null,
      status: r.status,
      rank: r.rank,
    })),
  };
}

function shape(r) {
  return {
    id: r.id,
    reference: r.params ? r.params.reference : null,
    type: r.report_type,
    institutionId: r.institution_id,
    departmentId: r.department_id,
    title: r.title,
    pdfUrl: r.file_url,
    summary: r.summary,
    generatedBy: r.generated_by,
    createdAt: r.created_at,
  };
}

/**
 * Generate an audit-ready report PDF, persist metadata, and return it.
 */
async function generate({ institutionId, departmentId, type, actor }) {
  const data = await buildAuditData(institutionId, departmentId);
  const ref = makeRef('TRU-RPT');
  const labels = {
    [REPORT_TYPES.AUDIT_READY]: 'Audit-Ready',
    [REPORT_TYPES.ADMITTED_LIST]: 'Admitted List',
    [REPORT_TYPES.APPLICANTS_LIST]: 'Applicants List',
  };
  const title = `${labels[type] || 'Admission'} Report — ${data.institution.name}`;

  const pdfBuffer = await pdfService.generateAuditReport({
    reference: ref,
    title,
    institutionName: data.institution.name,
    summary: data.summary,
    applicants: data.applicants,
    generatedAt: new Date().toLocaleString('en-GB'),
  });

  let url = null;
  if (storageService.isConfigured()) {
    const uploaded = await storageService.upload({
      bucket: storageService.buckets.reports,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      folder: institutionId,
      filename: `${ref}.pdf`,
    });
    url = uploaded.url;
  }

  const row = await queryOne(
    `INSERT INTO reports (report_type, institution_id, department_id, title, params, file_url, summary, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [type, institutionId, departmentId || null, title,
     JSON.stringify({ reference: ref, departmentId: departmentId || null }),
     url, JSON.stringify(data.summary), actor.id]
  );

  return { report: shape(row), buffer: url ? null : pdfBuffer };
}

async function list({ institutionId } = {}, q = {}) {
  const { page, limit, offset } = getPagination(q);
  const where = institutionId ? 'WHERE institution_id = $1' : '';
  const params = institutionId ? [institutionId] : [];
  const rows = await queryMany(
    `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*)::int AS t FROM reports ${where}`, params)).t;
  return { data: rows.map(shape), total, page, limit };
}

async function getOne(id) {
  const row = await queryOne('SELECT * FROM reports WHERE id = $1', [id]);
  if (!row) throw ApiError.notFound('Report not found');
  return shape(row);
}

module.exports = { generate, list, getOne, buildAuditData };
