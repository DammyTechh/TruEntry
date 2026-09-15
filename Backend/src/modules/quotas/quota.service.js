'use strict';

/**
 * Admission quotas — the parameters an institution sets before processing a
 * year's admissions.
 *
 * A quota owns:
 *   • the application window and JAMB cut-off
 *   • the ranking rule (JAMB only, or the JAMB/Post-UTME average)
 *   • the regulatory allocation (National Merit / Catchment / ELDS)
 *   • minimum O'Level requirements per subject group
 *   • the per-department seat allocation
 *   • which JAMB choice positions may apply
 */

const { query, queryOne, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');

/* ------------------------------- Shaping -------------------------------- */

function shapeQuota(row) {
  if (!row) return null;
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    sessionLabel: row.session_label,
    totalApplicants: row.total_applicants,
    jambCutoff: Number(row.jamb_cutoff),
    applicationStart: row.application_start,
    applicationEnd: row.application_end,
    admissionRule: row.admission_rule,
    allocation: {
      nationalMerit: Number(row.national_merit_pct),
      catchment: Number(row.catchment_pct),
      elds: Number(row.elds_pct),
    },
    distributionMode: row.distribution_mode,
    status: row.status,
    // Aggregates when selected with the list query.
    departmentCount: row.department_count != null ? Number(row.department_count) : undefined,
    allocatedSeats: row.allocated_seats != null ? Number(row.allocated_seats) : undefined,
    appliedCount: row.applied_count != null ? Number(row.applied_count) : undefined,
    admittedCount: row.admitted_count != null ? Number(row.admitted_count) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const shapeRequirement = (r) => ({
  id: r.id,
  subjectGroup: r.subject_group,
  minimumGrade: r.minimum_grade,
  minCredits: r.min_credits,
  maxSittings: r.max_sittings,
  notes: r.notes,
});

const shapeQuotaDepartment = (r) => ({
  id: r.id,
  departmentId: r.department_id,
  departmentName: r.department_name,
  facultyName: r.faculty_name || null,
  allocated: r.allocated,
  admitted: r.admitted,
  isSelected: r.is_selected,
});

/* ------------------------------ Validation ------------------------------ */

function assertAllocation({ nationalMerit, catchment, elds }) {
  const total = Number(nationalMerit) + Number(catchment) + Number(elds);
  if (Math.round(total * 100) / 100 !== 100) {
    throw ApiError.badRequest(
      `Admission categories must total 100% (got ${total}%)`,
      { code: 'ALLOCATION_INVALID' }
    );
  }
}

/* ------------------------------- Use cases ------------------------------ */

async function list(institutionId, { page = 1, limit = 20, status } = {}) {
  const offset = (page - 1) * limit;
  const params = [institutionId];
  let statusSql = '';
  if (status) {
    params.push(status);
    statusSql = `AND q.status = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT q.*,
            (SELECT COUNT(*) FROM quota_departments qd WHERE qd.quota_id = q.id AND qd.is_selected)      AS department_count,
            (SELECT COALESCE(SUM(qd.allocated),0) FROM quota_departments qd WHERE qd.quota_id = q.id)     AS allocated_seats,
            (SELECT COUNT(*) FROM applications a WHERE a.quota_id = q.id)                                AS applied_count,
            (SELECT COUNT(*) FROM applications a WHERE a.quota_id = q.id AND a.status = 'admitted')      AS admitted_count
       FROM admission_quotas q
      WHERE q.institution_id = $1 ${statusSql}
      ORDER BY q.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countRow = await queryOne(
    `SELECT COUNT(*)::int AS total FROM admission_quotas q WHERE q.institution_id = $1 ${statusSql}`,
    params
  );

  return { items: rows.map(shapeQuota), total: countRow?.total || 0 };
}

async function get(institutionId, quotaId) {
  const row = await queryOne(
    `SELECT q.*,
            (SELECT COUNT(*) FROM applications a WHERE a.quota_id = q.id)                           AS applied_count,
            (SELECT COUNT(*) FROM applications a WHERE a.quota_id = q.id AND a.status='admitted')   AS admitted_count
       FROM admission_quotas q
      WHERE q.id = $1 AND q.institution_id = $2`,
    [quotaId, institutionId]
  );
  if (!row) throw ApiError.notFound('Quota not found');

  const { rows: reqs } = await query(
    'SELECT * FROM quota_olevel_requirements WHERE quota_id = $1 ORDER BY subject_group',
    [quotaId]
  );
  const { rows: depts } = await query(
    `SELECT qd.*, d.name AS department_name, f.name AS faculty_name
       FROM quota_departments qd
       JOIN departments d ON d.id = qd.department_id
       LEFT JOIN faculties f ON f.id = d.faculty_id
      WHERE qd.quota_id = $1
      ORDER BY d.name`,
    [quotaId]
  );
  const { rows: choices } = await query(
    'SELECT choice_position FROM quota_choice_preferences WHERE quota_id = $1 ORDER BY choice_position',
    [quotaId]
  );

  return {
    ...shapeQuota(row),
    olevelRequirements: reqs.map(shapeRequirement),
    departments: depts.map(shapeQuotaDepartment),
    choicePositions: choices.map((c) => c.choice_position),
  };
}

/**
 * Distribute seats evenly across the selected departments, giving the
 * remainder to the first departments so the totals always add up exactly.
 */
function autoDistribute(total, departmentIds) {
  const n = departmentIds.length;
  if (!n || total <= 0) return departmentIds.map((id) => ({ departmentId: id, allocated: 0 }));
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  return departmentIds.map((id) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { departmentId: id, allocated: base + extra };
  });
}

async function create(institutionId, input, userId) {
  const allocation = input.allocation || { nationalMerit: 45, catchment: 35, elds: 20 };
  assertAllocation(allocation);

  const existing = await queryOne(
    'SELECT id FROM admission_quotas WHERE institution_id = $1 AND name = $2',
    [institutionId, input.name]
  );
  if (existing) throw ApiError.conflict('A quota with this name already exists', { code: 'QUOTA_NAME_TAKEN' });

  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO admission_quotas
         (institution_id, name, session_label, total_applicants, jamb_cutoff,
          application_start, application_end, admission_rule,
          national_merit_pct, catchment_pct, elds_pct, distribution_mode, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        institutionId,
        input.name,
        input.sessionLabel || null,
        input.totalApplicants || 0,
        input.jambCutoff || 0,
        input.applicationStart || null,
        input.applicationEnd || null,
        input.admissionRule || 'jamb_only',
        allocation.nationalMerit,
        allocation.catchment,
        allocation.elds,
        input.distributionMode || 'auto',
        input.status || 'draft',
        userId,
      ]
    );
    const quota = rows[0];

    // O'Level requirements
    for (const r of input.olevelRequirements || []) {
      await client.query(
        `INSERT INTO quota_olevel_requirements (quota_id, subject_group, minimum_grade, min_credits, max_sittings, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (quota_id, subject_group) DO UPDATE
           SET minimum_grade = EXCLUDED.minimum_grade,
               min_credits   = EXCLUDED.min_credits,
               max_sittings  = EXCLUDED.max_sittings,
               notes         = EXCLUDED.notes`,
        [quota.id, r.subjectGroup, r.minimumGrade, r.minCredits ?? 5, r.maxSittings ?? 2, r.notes || null]
      );
    }

    // Accepted JAMB choice positions
    for (const pos of input.choicePositions || []) {
      await client.query(
        'INSERT INTO quota_choice_preferences (quota_id, choice_position) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [quota.id, pos]
      );
    }

    // Department allocation
    const selected = (input.departments || []).filter((d) => d.isSelected !== false);
    const rowsToWrite =
      (input.distributionMode || 'auto') === 'auto'
        ? autoDistribute(input.totalApplicants || 0, selected.map((d) => d.departmentId))
        : selected.map((d) => ({ departmentId: d.departmentId, allocated: d.allocated || 0 }));

    for (const d of rowsToWrite) {
      await client.query(
        `INSERT INTO quota_departments (quota_id, department_id, allocated, is_selected)
         VALUES ($1,$2,$3,TRUE)
         ON CONFLICT (quota_id, department_id) DO UPDATE SET allocated = EXCLUDED.allocated, is_selected = TRUE`,
        [quota.id, d.departmentId, d.allocated]
      );
    }

    return shapeQuota(quota);
  });
}

async function update(institutionId, quotaId, input, userId) {
  const quota = await queryOne(
    'SELECT * FROM admission_quotas WHERE id = $1 AND institution_id = $2',
    [quotaId, institutionId]
  );
  if (!quota) throw ApiError.notFound('Quota not found');
  if (['finished'].includes(quota.status)) {
    throw ApiError.badRequest('A finished admission cycle can no longer be edited', { code: 'QUOTA_LOCKED' });
  }
  if (input.allocation) assertAllocation(input.allocation);

  return transaction(async (client) => {
    const sets = [];
    const params = [];
    const put = (sql, value) => { params.push(value); sets.push(`${sql} = $${params.length}`); };

    if (input.name !== undefined) put('name', input.name);
    if (input.sessionLabel !== undefined) put('session_label', input.sessionLabel);
    if (input.totalApplicants !== undefined) put('total_applicants', input.totalApplicants);
    if (input.jambCutoff !== undefined) put('jamb_cutoff', input.jambCutoff);
    if (input.applicationStart !== undefined) put('application_start', input.applicationStart);
    if (input.applicationEnd !== undefined) put('application_end', input.applicationEnd);
    if (input.admissionRule !== undefined) put('admission_rule', input.admissionRule);
    if (input.distributionMode !== undefined) put('distribution_mode', input.distributionMode);
    if (input.status !== undefined) put('status', input.status);
    if (input.allocation) {
      put('national_merit_pct', input.allocation.nationalMerit);
      put('catchment_pct', input.allocation.catchment);
      put('elds_pct', input.allocation.elds);
    }

    let updated = quota;
    if (sets.length) {
      params.push(quotaId);
      const { rows } = await client.query(
        `UPDATE admission_quotas SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      updated = rows[0];
    }

    if (input.olevelRequirements) {
      await client.query('DELETE FROM quota_olevel_requirements WHERE quota_id = $1', [quotaId]);
      for (const r of input.olevelRequirements) {
        await client.query(
          `INSERT INTO quota_olevel_requirements (quota_id, subject_group, minimum_grade, min_credits, max_sittings, notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [quotaId, r.subjectGroup, r.minimumGrade, r.minCredits ?? 5, r.maxSittings ?? 2, r.notes || null]
        );
      }
    }

    if (input.choicePositions) {
      await client.query('DELETE FROM quota_choice_preferences WHERE quota_id = $1', [quotaId]);
      for (const pos of input.choicePositions) {
        await client.query(
          'INSERT INTO quota_choice_preferences (quota_id, choice_position) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [quotaId, pos]
        );
      }
    }

    if (input.departments) {
      const selected = input.departments.filter((d) => d.isSelected !== false);
      const mode = input.distributionMode || updated.distribution_mode;
      const total = input.totalApplicants ?? updated.total_applicants;
      const rowsToWrite =
        mode === 'auto'
          ? autoDistribute(total, selected.map((d) => d.departmentId))
          : selected.map((d) => ({ departmentId: d.departmentId, allocated: d.allocated || 0 }));

      await client.query('DELETE FROM quota_departments WHERE quota_id = $1', [quotaId]);
      for (const d of rowsToWrite) {
        await client.query(
          'INSERT INTO quota_departments (quota_id, department_id, allocated, is_selected) VALUES ($1,$2,$3,TRUE)',
          [quotaId, d.departmentId, d.allocated]
        );
      }
    }

    return shapeQuota(updated);
  });
}

/** Move a cycle between draft → open → closed → processing → finished. */
async function setStatus(institutionId, quotaId, status) {
  const quota = await queryOne(
    'SELECT * FROM admission_quotas WHERE id = $1 AND institution_id = $2',
    [quotaId, institutionId]
  );
  if (!quota) throw ApiError.notFound('Quota not found');

  const allowed = {
    draft: ['open'],
    open: ['closed'],
    closed: ['processing', 'open'],
    processing: ['finished', 'closed'],
    finished: [],
  };
  if (!allowed[quota.status]?.includes(status)) {
    throw ApiError.badRequest(`Cannot move an admission cycle from ${quota.status} to ${status}`, {
      code: 'INVALID_TRANSITION',
    });
  }

  if (status === 'open') {
    const openOne = await queryOne(
      "SELECT id FROM admission_quotas WHERE institution_id = $1 AND status = 'open' AND id <> $2",
      [institutionId, quotaId]
    );
    if (openOne) {
      throw ApiError.conflict('Another admission cycle is already open. Close it first.', {
        code: 'CYCLE_ALREADY_OPEN',
      });
    }
  }

  const row = await queryOne(
    'UPDATE admission_quotas SET status = $1 WHERE id = $2 RETURNING *',
    [status, quotaId]
  );
  return shapeQuota(row);
}

async function remove(institutionId, quotaId) {
  const quota = await queryOne(
    'SELECT * FROM admission_quotas WHERE id = $1 AND institution_id = $2',
    [quotaId, institutionId]
  );
  if (!quota) throw ApiError.notFound('Quota not found');
  if (quota.status !== 'draft') {
    throw ApiError.badRequest('Only a draft cycle can be deleted', { code: 'QUOTA_NOT_DRAFT' });
  }
  await query('DELETE FROM admission_quotas WHERE id = $1', [quotaId]);
  return { deleted: true };
}

/** The currently open cycle for an institution (used by the applicant flow). */
async function openQuotaFor(institutionId) {
  const row = await queryOne(
    `SELECT * FROM admission_quotas
      WHERE institution_id = $1 AND status = 'open'
        AND (application_start IS NULL OR application_start <= CURRENT_DATE)
        AND (application_end   IS NULL OR application_end   >= CURRENT_DATE)
      LIMIT 1`,
    [institutionId]
  );
  return row ? shapeQuota(row) : null;
}

module.exports = {
  list,
  get,
  create,
  update,
  setStatus,
  remove,
  openQuotaFor,
  autoDistribute,
  assertAllocation,
  shapeQuota,
};
