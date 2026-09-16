'use strict';

/**
 * JAMB regulatory audit report.
 *
 * Produces the record JAMB requires to audit an admission exercise: who applied,
 * their verified scores, the regulatory category they were admitted under
 * (National Merit / Catchment / ELDS), the institution's stated criteria, and
 * how the actual admissions compare with the mandated allocation.
 *
 * Available as PDF (for filing) and Excel (for analysis).
 */

const ExcelJS = require('exceljs');
const { query, queryOne } = require('../../config/database');
const pdf = require('../../services/pdf.service');
const ApiError = require('../../utils/ApiError');

const CATEGORY_LABEL = {
  national_merit: 'National Merit',
  catchment: 'Catchment Area',
  elds: 'Educationally Less Developed State',
};

/**
 * Assemble the audit dataset.
 *
 * @param {object} filters
 * @param {string} [filters.institutionId]
 * @param {string} [filters.quotaId]
 * @param {string} [filters.status]      restrict to one application status
 * @param {string} [filters.from]        ISO date
 * @param {string} [filters.to]          ISO date
 */
async function build(filters = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (filters.institutionId) add('a.institution_id = ?', filters.institutionId);
  if (filters.quotaId) add('a.quota_id = ?', filters.quotaId);
  if (filters.status) add('a.status = ?', filters.status);
  if (filters.from) add('a.created_at >= ?', filters.from);
  if (filters.to) add('a.created_at <= ?', filters.to);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { rows: applicants } = await query(
    `SELECT a.reference, a.status, a.jamb_score, a.post_utme_score, a.aggregate_score,
            a.admission_category, a.choice_position, a.created_at, a.decided_at,
            u.full_name, u.email,
            p.nin, p.jamb_reg_no, p.state_of_origin, p.gender, p.date_of_birth,
            p.olevel_verified, p.jamb_verified,
            i.name AS institution_name, i.code AS institution_code, i.state AS institution_state,
            c.type AS institution_type,
            d.name AS department_name,
            q.name AS quota_name, q.jamb_cutoff, q.admission_rule,
            q.national_merit_pct, q.catchment_pct, q.elds_pct
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
       JOIN institutions i ON i.id = a.institution_id
       LEFT JOIN institution_categories c ON c.id = i.category_id
       JOIN departments d ON d.id = a.department_id
       LEFT JOIN admission_quotas q ON q.id = a.quota_id
       ${whereSql}
       ORDER BY i.name, d.name, a.jamb_score DESC NULLS LAST`,
    params
  );

  // --- Summary -----------------------------------------------------------
  const admitted = applicants.filter((r) => r.status === 'admitted');
  const byCategory = { national_merit: 0, catchment: 0, elds: 0, unclassified: 0 };
  for (const r of admitted) {
    const key = r.admission_category || 'unclassified';
    byCategory[key] = (byCategory[key] || 0) + 1;
  }

  const admittedTotal = admitted.length || 0;
  const pct = (n) => (admittedTotal ? Math.round((n / admittedTotal) * 1000) / 10 : 0);

  // The mandated split comes from the quota; fall back to national policy.
  const first = applicants[0] || {};
  const mandated = {
    national_merit: Number(first.national_merit_pct ?? 45),
    catchment: Number(first.catchment_pct ?? 35),
    elds: Number(first.elds_pct ?? 20),
  };

  const compliance = ['national_merit', 'catchment', 'elds'].map((key) => ({
    category: CATEGORY_LABEL[key],
    mandatedPct: mandated[key],
    admitted: byCategory[key] || 0,
    actualPct: pct(byCategory[key] || 0),
    variancePct: Math.round((pct(byCategory[key] || 0) - mandated[key]) * 10) / 10,
  }));

  const statusCounts = applicants.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  let institution = null;
  if (filters.institutionId) {
    institution = await queryOne('SELECT name, code, state FROM institutions WHERE id = $1', [filters.institutionId]);
  }

  return {
    generatedAt: new Date(),
    filters,
    institution,
    summary: {
      totalApplications: applicants.length,
      admitted: admittedTotal,
      verified: applicants.filter((r) => r.jamb_verified && r.olevel_verified).length,
      statusCounts,
      byCategory,
      compliance,
      jambCutoff: first.jamb_cutoff != null ? Number(first.jamb_cutoff) : null,
      admissionRule: first.admission_rule || null,
      quotaName: first.quota_name || null,
    },
    applicants,
  };
}

/* ------------------------------- Excel ---------------------------------- */

const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3538CD' } };

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = HEAD_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 22;
}

async function toExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TruEntry';
  wb.created = report.generatedAt;

  /* --- Sheet 1: Summary --- */
  const s = wb.addWorksheet('Summary');
  s.columns = [{ width: 38 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 14 }];

  s.addRow(['TruEntry — JAMB Admission Audit Report']).font = { bold: true, size: 15 };
  s.addRow([`Generated: ${report.generatedAt.toLocaleString('en-GB')}`]);
  if (report.institution) s.addRow([`Institution: ${report.institution.name} (${report.institution.code})`]);
  if (report.summary.quotaName) s.addRow([`Admission cycle: ${report.summary.quotaName}`]);
  s.addRow([]);

  s.addRow(['Metric', 'Value']).eachCell((c) => { c.font = { bold: true }; });
  s.addRow(['Total applications', report.summary.totalApplications]);
  s.addRow(['Fully verified (JAMB + O\u2019Level)', report.summary.verified]);
  s.addRow(['Admitted', report.summary.admitted]);
  if (report.summary.jambCutoff != null) s.addRow(['JAMB cut-off', report.summary.jambCutoff]);
  if (report.summary.admissionRule) {
    s.addRow(['Admission rule', report.summary.admissionRule === 'jamb_only' ? 'JAMB score only' : 'Average of JAMB & Post-UTME']);
  }
  s.addRow([]);

  s.addRow(['Regulatory allocation compliance']).font = { bold: true, size: 12 };
  styleHeader(s.addRow(['Category', 'Mandated %', 'Admitted', 'Actual %', 'Variance']));
  for (const c of report.summary.compliance) {
    const row = s.addRow([c.category, c.mandatedPct, c.admitted, c.actualPct, c.variancePct]);
    // Flag material deviation from the mandated split.
    if (Math.abs(c.variancePct) > 5) {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  }
  s.addRow([]);

  s.addRow(['Applications by status']).font = { bold: true, size: 12 };
  styleHeader(s.addRow(['Status', 'Count']));
  for (const [k, v] of Object.entries(report.summary.statusCounts)) {
    s.addRow([k.replace(/_/g, ' '), v]);
  }

  /* --- Sheet 2: Applicants --- */
  const a = wb.addWorksheet('Applicants');
  a.columns = [
    { header: 'Reference', key: 'reference', width: 20 },
    { header: 'Full name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'NIN', key: 'nin', width: 16 },
    { header: 'JAMB reg no', key: 'jamb', width: 18 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'State of origin', key: 'state', width: 16 },
    { header: 'Institution', key: 'institution', width: 30 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Department', key: 'department', width: 26 },
    { header: 'Choice', key: 'choice', width: 9 },
    { header: 'JAMB score', key: 'jambScore', width: 12 },
    { header: 'Post-UTME', key: 'postUtme', width: 12 },
    { header: 'Aggregate', key: 'aggregate', width: 12 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Verified', key: 'verified', width: 11 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Applied on', key: 'created', width: 14 },
  ];
  styleHeader(a.getRow(1));
  a.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of report.applicants) {
    a.addRow({
      reference: r.reference,
      name: r.full_name,
      email: r.email,
      nin: r.nin || '',
      jamb: r.jamb_reg_no || '',
      gender: r.gender || '',
      state: r.state_of_origin || '',
      institution: r.institution_name,
      type: r.institution_type || '',
      department: r.department_name,
      choice: r.choice_position || '',
      jambScore: r.jamb_score != null ? Number(r.jamb_score) : '',
      postUtme: r.post_utme_score != null ? Number(r.post_utme_score) : '',
      aggregate: r.aggregate_score != null ? Number(r.aggregate_score) : '',
      category: CATEGORY_LABEL[r.admission_category] || '',
      verified: r.jamb_verified && r.olevel_verified ? 'Yes' : 'No',
      status: String(r.status || '').replace(/_/g, ' '),
      created: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '',
    });
  }
  a.autoFilter = { from: 'A1', to: 'R1' };

  return wb.xlsx.writeBuffer();
}

/* -------------------------------- PDF ----------------------------------- */

async function toPdf(report) {
  return pdf.generateAuditReport({
    reference: `JAMB-AUDIT-${Date.now().toString(36).toUpperCase()}`,
    title: 'JAMB Admission Audit Report',
    institutionName: report.institution?.name || 'All institutions',
    generatedAt: report.generatedAt.toLocaleString('en-GB'),
    summary: {
      'Total applications': report.summary.totalApplications,
      'Fully verified': report.summary.verified,
      Admitted: report.summary.admitted,
      ...(report.summary.jambCutoff != null ? { 'JAMB cut-off': report.summary.jambCutoff } : {}),
      ...Object.fromEntries(
        report.summary.compliance.map((c) => [
          c.category,
          `${c.admitted} (${c.actualPct}% vs ${c.mandatedPct}% mandated)`,
        ])
      ),
    },
    applicants: report.applicants.map((r) => ({
      reference: r.reference,
      name: r.full_name,
      jambRegNo: r.jamb_reg_no,
      institution: r.institution_name,
      department: r.department_name,
      jambScore: r.jamb_score,
      aggregate: r.aggregate_score,
      category: CATEGORY_LABEL[r.admission_category] || '',
      status: r.status,
      state: r.state_of_origin,
    })),
  });
}

async function generate(filters, format) {
  const report = await build(filters);
  if (!report.applicants.length) {
    throw ApiError.notFound('No applications match these filters', { code: 'NO_RECORDS' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = report.institution?.code ? `-${report.institution.code}` : '';

  if (format === 'xlsx') {
    return {
      buffer: Buffer.from(await toExcel(report)),
      filename: `jamb-audit${slug}-${stamp}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  return {
    buffer: await toPdf(report),
    filename: `jamb-audit${slug}-${stamp}.pdf`,
    contentType: 'application/pdf',
  };
}

module.exports = { build, generate, toExcel, toPdf, CATEGORY_LABEL };
