'use strict';

/**
 * Admissions processing for an institution's admission cycle.
 *
 * Candidates are ranked in descending order by the cycle's stated rule —
 * JAMB score only, or the average of JAMB and Post-UTME — and admitted against
 * each department's allocated seats, honouring the regulatory split
 * (National Merit / Catchment / ELDS) set on the quota.
 */

const { query, queryOne, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const email = require('../../services/email.service');

const CATEGORIES = ['national_merit', 'catchment', 'elds'];

/** Ranking score for a candidate under the cycle's rule. */
function rankingScore(row, rule) {
  const jamb = Number(row.jamb_score || 0);
  if (rule === 'jamb_postutme_average') {
    const post = Number(row.post_utme_score || 0);
    // Post-UTME is out of 100, JAMB out of 400 — normalise before averaging.
    return Math.round(((jamb / 4 + post) / 2) * 100) / 100;
  }
  return jamb;
}

/**
 * Distribute a department's seats across the three regulatory categories,
 * giving any remainder to National Merit.
 */
function seatsByCategory(allocated, quota) {
  const pct = {
    national_merit: Number(quota.national_merit_pct),
    catchment: Number(quota.catchment_pct),
    elds: Number(quota.elds_pct),
  };
  const seats = {};
  let assigned = 0;
  for (const key of ['catchment', 'elds']) {
    seats[key] = Math.floor((allocated * pct[key]) / 100);
    assigned += seats[key];
  }
  seats.national_merit = Math.max(0, allocated - assigned);
  return seats;
}

async function loadQuota(institutionId, quotaId) {
  const quota = await queryOne(
    'SELECT * FROM admission_quotas WHERE id = $1 AND institution_id = $2',
    [quotaId, institutionId]
  );
  if (!quota) throw ApiError.notFound('Admission cycle not found');
  return quota;
}

/** Applicants in a cycle, ranked, with their current decision. */
async function listApplicants(institutionId, quotaId, { page = 1, limit = 20, departmentId, status, search } = {}) {
  const quota = await loadQuota(institutionId, quotaId);
  const offset = (page - 1) * limit;

  const params = [quotaId];
  const where = ['a.quota_id = $1'];
  if (departmentId) { params.push(departmentId); where.push(`a.department_id = $${params.length}`); }
  if (status) { params.push(status); where.push(`a.status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR a.reference ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');

  const { rows } = await query(
    `SELECT a.*, u.full_name, u.email,
            p.state_of_origin, p.gender, p.nin, p.jamb_reg_no, p.date_of_birth,
            p.olevel_data, p.jamb_data,
            d.name AS department_name
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
       JOIN departments d ON d.id = a.department_id
      WHERE ${whereSql}
      ORDER BY a.jamb_score DESC NULLS LAST, a.created_at
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(
    `SELECT COUNT(*)::int AS total
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
      WHERE ${whereSql}`,
    params
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      applicantName: r.full_name,
      applicantEmail: r.email,
      departmentId: r.department_id,
      departmentName: r.department_name,
      stateOfOrigin: r.state_of_origin,
      gender: r.gender,
      nin: r.nin,
      jambRegNo: r.jamb_reg_no,
      jambScore: r.jamb_score != null ? Number(r.jamb_score) : null,
      postUtmeScore: r.post_utme_score != null ? Number(r.post_utme_score) : null,
      aggregateScore: r.aggregate_score != null ? Number(r.aggregate_score) : null,
      rankingScore: rankingScore(r, quota.admission_rule),
      choicePosition: r.choice_position,
      admissionCategory: r.admission_category,
      olevel: r.olevel_data || r.olevel_results || [],
      status: r.status,
      createdAt: r.created_at,
    })),
    total: countRow?.total || 0,
    quota: {
      id: quota.id,
      name: quota.name,
      status: quota.status,
      admissionRule: quota.admission_rule,
      jambCutoff: Number(quota.jamb_cutoff),
    },
  };
}

/**
 * Preview or run the admission exercise for a cycle.
 *
 * @param {boolean} commit  false = dry run (nothing is written)
 */
async function process(institutionId, quotaId, { commit = false, departmentId } = {}) {
  const quota = await loadQuota(institutionId, quotaId);
  if (!['closed', 'processing', 'open'].includes(quota.status)) {
    throw ApiError.badRequest(`An admission cycle cannot be processed while it is ${quota.status}`, {
      code: 'INVALID_STATE',
    });
  }

  const params = [quotaId];
  let deptSql = '';
  if (departmentId) { params.push(departmentId); deptSql = `AND qd.department_id = $${params.length}`; }

  const { rows: departments } = await query(
    `SELECT qd.*, d.name AS department_name
       FROM quota_departments qd
       JOIN departments d ON d.id = qd.department_id
      WHERE qd.quota_id = $1 AND qd.is_selected ${deptSql}
      ORDER BY d.name`,
    params
  );

  const results = [];

  for (const dept of departments) {
    const { rows: candidates } = await query(
      `SELECT a.*, u.full_name, u.email, p.state_of_origin
         FROM applications a
         JOIN users u ON u.id = a.applicant_id
         LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
        WHERE a.quota_id = $1 AND a.department_id = $2
          AND a.status IN ('submitted','under_review','post_utme_completed','recommended','approved')`,
      [quotaId, dept.department_id]
    );

    // Rank descending by the cycle's stated rule.
    const ranked = candidates
      .map((c) => ({ ...c, _score: rankingScore(c, quota.admission_rule) }))
      .sort((a, b) => b._score - a._score);

    const seats = seatsByCategory(dept.allocated, quota);

    // Seats already used by candidates admitted in an earlier run. Without
    // this the counter restarts at zero and a re-run over-admits beyond quota.
    const { rows: existing } = await query(
      `SELECT COALESCE(admission_category,'national_merit') AS category, COUNT(*)::int AS n
         FROM applications
        WHERE quota_id = $1 AND department_id = $2 AND status = 'admitted'
        GROUP BY 1`,
      [quotaId, dept.department_id]
    );
    const taken = { national_merit: 0, catchment: 0, elds: 0 };
    for (const e of existing) {
      if (taken[e.category] !== undefined) taken[e.category] = e.n;
    }
    const alreadyAdmitted = existing.reduce((sum, e) => sum + e.n, 0);
    const selected = [];
    const waitlisted = [];

    for (const c of ranked) {
      // Below the cut-off is never admitted, regardless of remaining seats.
      if (Number(c.jamb_score || 0) < Number(quota.jamb_cutoff || 0)) {
        waitlisted.push({ ...c, _reason: 'Below JAMB cut-off' });
        continue;
      }
      const category = CATEGORIES.includes(c.admission_category) ? c.admission_category : 'national_merit';

      if (taken[category] < seats[category]) {
        taken[category] += 1;
        selected.push({ ...c, _category: category });
      } else if (taken.national_merit < seats.national_merit) {
        // Spill over into unused merit seats rather than wasting them.
        taken.national_merit += 1;
        selected.push({ ...c, _category: 'national_merit' });
      } else {
        waitlisted.push({ ...c, _reason: 'No seat remaining in this category' });
      }
    }

    results.push({
      departmentId: dept.department_id,
      departmentName: dept.department_name,
      allocated: dept.allocated,
      seatsByCategory: seats,
      admittedByCategory: taken,
      alreadyAdmitted,
      selected: selected.map((c, i) => ({
        applicationId: c.id,
        reference: c.reference,
        applicantName: c.full_name,
        stateOfOrigin: c.state_of_origin,
        jambScore: c.jamb_score != null ? Number(c.jamb_score) : null,
        rankingScore: c._score,
        category: c._category,
        rank: alreadyAdmitted + i + 1,
      })),
      waitlisted: waitlisted.map((c) => ({
        applicationId: c.id,
        reference: c.reference,
        applicantName: c.full_name,
        jambScore: c.jamb_score != null ? Number(c.jamb_score) : null,
        rankingScore: c._score,
        reason: c._reason,
      })),
    });
  }

  if (!commit) {
    return { committed: false, quota: { id: quota.id, name: quota.name, admissionRule: quota.admission_rule }, results };
  }

  // ---- Commit: write the decisions ------------------------------------
  const admittedRows = [];
  await transaction(async (client) => {
    await client.query("UPDATE admission_quotas SET status = 'processing' WHERE id = $1 AND status <> 'processing'", [quotaId]);

    for (const dept of results) {
      for (const s of dept.selected) {
        await client.query(
          `UPDATE applications
              SET status = 'admitted', rank = $1, admission_category = $2, decided_at = NOW()
            WHERE id = $3 AND status <> 'admitted'`,
          [s.rank, s.category, s.applicationId]
        );
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, to_status, note)
           VALUES ($1, NULL, 'admitted', $2)`,
          [s.applicationId, `Admitted at rank ${s.rank} (${s.category.replace(/_/g, ' ')})`]
        );
        admittedRows.push(s);
      }
      await client.query(
        'UPDATE quota_departments SET admitted = $1 WHERE quota_id = $2 AND department_id = $3',
        [(dept.alreadyAdmitted || 0) + dept.selected.length, quotaId, dept.departmentId]
      );
    }
  });

  // Notify admitted candidates (never blocks the transaction).
  notifyAdmitted(admittedRows).catch((err) =>
    logger.error('Admission emails failed', { error: err.message })
  );

  logger.info('Admissions processed', { quotaId, admitted: admittedRows.length });
  return { committed: true, admitted: admittedRows.length, results };
}

async function notifyAdmitted(rows) {
  for (const r of rows) {
    try {
      const info = await queryOne(
        `SELECT u.email, u.full_name, i.name AS institution, d.name AS department
           FROM applications a
           JOIN users u ON u.id = a.applicant_id
           JOIN institutions i ON i.id = a.institution_id
           JOIN departments d ON d.id = a.department_id
          WHERE a.id = $1`,
        [r.applicationId]
      );
      if (info) {
        await email.sendApplicationStatus(info.email, info.full_name, {
          institution: info.institution,
          department: info.department,
          status: 'admitted',
          note: 'Congratulations — you have been offered provisional admission.',
        });
      }
    } catch (err) {
      logger.warn('Admission email failed', { applicationId: r.applicationId, error: err.message });
    }
  }
}

/** Admit or reject a single applicant. */
async function decide(institutionId, applicationId, { admit, note }) {
  const app = await queryOne(
    'SELECT * FROM applications WHERE id = $1 AND institution_id = $2',
    [applicationId, institutionId]
  );
  if (!app) throw ApiError.notFound('Application not found');

  const next = admit ? 'admitted' : 'rejected';
  await transaction(async (client) => {
    await client.query(
      'UPDATE applications SET status = $1, decision_note = $2, decided_at = NOW() WHERE id = $3',
      [next, note || null, applicationId]
    );
    await client.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4)`,
      [applicationId, app.status, next, note || (admit ? 'Added to admission list' : 'Rejected')]
    );
  });

  try {
    const info = await queryOne(
      `SELECT u.email, u.full_name, i.name AS institution, d.name AS department
         FROM applications a JOIN users u ON u.id = a.applicant_id
         JOIN institutions i ON i.id = a.institution_id
         JOIN departments d ON d.id = a.department_id
        WHERE a.id = $1`,
      [applicationId]
    );
    if (info) {
      await email.sendApplicationStatus(info.email, info.full_name, {
        institution: info.institution, department: info.department, status: next, note,
      });
    }
  } catch (err) {
    logger.warn('Decision email failed', { applicationId, error: err.message });
  }

  return { id: applicationId, status: next };
}

/** Move an applicant to a different department (e.g. a related course). */
async function switchDepartment(institutionId, applicationId, { departmentId, note }) {
  const app = await queryOne(
    'SELECT * FROM applications WHERE id = $1 AND institution_id = $2',
    [applicationId, institutionId]
  );
  if (!app) throw ApiError.notFound('Application not found');

  const dept = await queryOne(
    'SELECT * FROM departments WHERE id = $1 AND institution_id = $2 AND is_active',
    [departmentId, institutionId]
  );
  if (!dept) throw ApiError.badRequest('That department does not belong to your institution');

  await transaction(async (client) => {
    await client.query('UPDATE applications SET department_id = $1 WHERE id = $2', [departmentId, applicationId]);
    await client.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, note)
       VALUES ($1,$2,$2,$3)`,
      [applicationId, app.status, note || `Moved to ${dept.name}`]
    );
  });

  return { id: applicationId, departmentId, departmentName: dept.name };
}

/** Close the admission exercise. */
async function close(institutionId, quotaId) {
  const quota = await loadQuota(institutionId, quotaId);
  if (!['processing', 'closed'].includes(quota.status)) {
    throw ApiError.badRequest('Only a cycle that has been closed to applications can be finished', {
      code: 'INVALID_STATE',
    });
  }
  const row = await queryOne(
    "UPDATE admission_quotas SET status = 'finished' WHERE id = $1 RETURNING *",
    [quotaId]
  );
  logger.info('Admission cycle finished', { quotaId });
  return { id: row.id, status: row.status };
}

/** Headline numbers for the Admissions screen. */
async function summary(institutionId, quotaId) {
  const quota = await loadQuota(institutionId, quotaId);
  const stats = await queryOne(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'admitted')::int AS admitted,
            COUNT(*) FILTER (WHERE status = 'rejected')::int  AS rejected,
            COUNT(*) FILTER (WHERE status IN ('submitted','under_review','recommended','approved'))::int AS pending
       FROM applications WHERE quota_id = $1`,
    [quotaId]
  );
  const seats = await queryOne(
    'SELECT COALESCE(SUM(allocated),0)::int AS allocated FROM quota_departments WHERE quota_id = $1',
    [quotaId]
  );
  return {
    quota: { id: quota.id, name: quota.name, status: quota.status, admissionRule: quota.admission_rule },
    ...stats,
    allocatedSeats: seats?.allocated || 0,
  };
}

module.exports = { listApplicants, process, decide, switchDepartment, close, summary, rankingScore, seatsByCategory };
