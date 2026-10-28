'use strict';

/**
 * Faculties and their departments.
 *
 * Departments belong to a faculty (e.g. Engineering → Civil Engineering),
 * which is how institutions describe their own structure and how the quota
 * builder groups the seat allocation.
 */

const { query, queryOne, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');

// 1 = best. Mirrors olevel_grade_ranks in the database.
const GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

const shapeFaculty = (r) => ({
  id: r.id,
  name: r.name,
  isActive: r.is_active,
  departmentCount: r.department_count != null ? Number(r.department_count) : undefined,
  createdAt: r.created_at,
});

const shapeDepartment = (r) => ({
  id: r.id,
  name: r.name,
  code: r.code,
  facultyId: r.faculty_id,
  facultyName: r.faculty_name || null,
  admissionQuota: r.admission_quota,
  jambCutoff: r.jamb_cutoff != null ? Number(r.jamb_cutoff) : 0,
  postUtmeCutoff: r.post_utme_cutoff != null ? Number(r.post_utme_cutoff) : 0,
  aggregateCutoff: r.aggregate_cutoff != null ? Number(r.aggregate_cutoff) : 0,
  // O'Level requirements typed in by the institution for THIS course.
  minCredits: r.min_credits != null ? Number(r.min_credits) : 5,
  maxSittings: r.max_sittings != null ? Number(r.max_sittings) : 2,
  olevelNotes: r.olevel_notes || '',
  olevelRequirements: Array.isArray(r.olevel_requirements)
    ? r.olevel_requirements.filter((x) => x && x.subject)
    : [],
  applicationCount: r.application_count != null ? Number(r.application_count) : undefined,
  isActive: r.is_active,
});

/**
 * Replace a department's O'Level subject requirements.
 * Passing undefined leaves them untouched; passing [] clears them.
 */
async function replaceOlevelRequirements(client, departmentId, requirements) {
  if (requirements === undefined) return;

  await client.query('DELETE FROM department_olevel_requirements WHERE department_id = $1', [departmentId]);
  if (!Array.isArray(requirements) || !requirements.length) return;

  const seen = new Set();
  for (const req of requirements) {
    const subject = String(req?.subject || '').trim();
    if (!subject) continue;

    const key = subject.toLowerCase();
    if (seen.has(key)) continue; // the unique index would reject the duplicate
    seen.add(key);

    const grade = String(req.minimumGrade || 'C6').toUpperCase();
    if (!GRADES.includes(grade)) {
      throw ApiError.badRequest(`"${grade}" is not a valid O'Level grade`, { code: 'BAD_GRADE' });
    }

    await client.query(
      `INSERT INTO department_olevel_requirements (department_id, subject, minimum_grade, is_compulsory)
       VALUES ($1,$2,$3,$4)`,
      [departmentId, subject, grade, req.isCompulsory !== false]
    );
  }
}

/** One department with its requirements attached, scoped to the institution. */
async function departmentWithRequirements(institutionId, id) {
  const row = await queryOne(
    `SELECT d.*, f.name AS faculty_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'subject', r.subject,
                       'minimumGrade', r.minimum_grade,
                       'isCompulsory', r.is_compulsory) ORDER BY r.subject)
                FROM department_olevel_requirements r
               WHERE r.department_id = d.id), '[]'::json) AS olevel_requirements
       FROM departments d
       LEFT JOIN faculties f ON f.id = d.faculty_id
      WHERE d.id = $1 AND d.institution_id = $2`,
    [id, institutionId]
  );
  if (!row) throw ApiError.notFound('Department not found');
  return shapeDepartment(row);
}

/* ------------------------------ Faculties ------------------------------- */

async function listFaculties(institutionId) {
  const { rows } = await query(
    `SELECT f.*, (SELECT COUNT(*) FROM departments d WHERE d.faculty_id = f.id) AS department_count
       FROM faculties f
      WHERE f.institution_id = $1
      ORDER BY f.name`,
    [institutionId]
  );
  return rows.map(shapeFaculty);
}

async function createFaculty(institutionId, { name }) {
  try {
    const row = await queryOne(
      'INSERT INTO faculties (institution_id, name) VALUES ($1,$2) RETURNING *',
      [institutionId, name.trim()]
    );
    return shapeFaculty(row);
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A faculty with that name already exists');
    throw err;
  }
}

async function updateFaculty(institutionId, id, { name, isActive }) {
  const sets = [];
  const params = [];
  if (name !== undefined) { params.push(name.trim()); sets.push(`name = $${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); sets.push(`is_active = $${params.length}`); }
  if (!sets.length) throw ApiError.badRequest('Nothing to update');

  params.push(id, institutionId);
  const row = await queryOne(
    `UPDATE faculties SET ${sets.join(', ')}
      WHERE id = $${params.length - 1} AND institution_id = $${params.length}
      RETURNING *`,
    params
  );
  if (!row) throw ApiError.notFound('Faculty not found');
  return shapeFaculty(row);
}

async function deleteFaculty(institutionId, id) {
  const inUse = await queryOne('SELECT COUNT(*)::int AS n FROM departments WHERE faculty_id = $1', [id]);
  if (inUse?.n > 0) {
    throw ApiError.badRequest(
      `This faculty still has ${inUse.n} department(s). Move or delete them first.`,
      { code: 'FACULTY_IN_USE' }
    );
  }
  const row = await queryOne(
    'DELETE FROM faculties WHERE id = $1 AND institution_id = $2 RETURNING id',
    [id, institutionId]
  );
  if (!row) throw ApiError.notFound('Faculty not found');
  return { deleted: true };
}

/* ----------------------------- Departments ------------------------------ */

async function listDepartments(institutionId, { facultyId } = {}) {
  const params = [institutionId];
  let facultySql = '';
  if (facultyId) {
    params.push(facultyId);
    facultySql = `AND d.faculty_id = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT d.*, f.name AS faculty_name,
            (SELECT COUNT(*) FROM applications a WHERE a.department_id = d.id) AS application_count,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'subject', r.subject,
                       'minimumGrade', r.minimum_grade,
                       'isCompulsory', r.is_compulsory) ORDER BY r.subject)
                FROM department_olevel_requirements r
               WHERE r.department_id = d.id), '[]'::json) AS olevel_requirements
       FROM departments d
       LEFT JOIN faculties f ON f.id = d.faculty_id
      WHERE d.institution_id = $1 ${facultySql}
      ORDER BY f.name NULLS LAST, d.name`,
    params
  );
  return rows.map(shapeDepartment);
}

async function createDepartment(institutionId, body) {
  if (body.facultyId) {
    const f = await queryOne(
      'SELECT id FROM faculties WHERE id = $1 AND institution_id = $2',
      [body.facultyId, institutionId]
    );
    if (!f) throw ApiError.badRequest('That faculty does not belong to your institution');
  }
  try {
    // The department and the O'Level requirements typed in beside it are
    // written together, so a half-configured course never exists.
    const id = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO departments
           (institution_id, faculty_id, name, code, admission_quota,
            jamb_cutoff, post_utme_cutoff, aggregate_cutoff,
            min_credits, max_sittings, olevel_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          institutionId,
          body.facultyId || null,
          body.name.trim(),
          body.code || null,
          body.admissionQuota || 0,
          body.jambCutoff || 0,
          body.postUtmeCutoff || 0,
          body.aggregateCutoff || 0,
          body.minCredits ?? 5,
          body.maxSittings ?? 2,
          body.olevelNotes || null,
        ]
      );
      await replaceOlevelRequirements(client, rows[0].id, body.olevelRequirements);
      return rows[0].id;
    });
    return departmentWithRequirements(institutionId, id);
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A department with that name already exists');
    throw err;
  }
}

async function updateDepartment(institutionId, id, body) {
  const sets = [];
  const params = [];
  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (body.name !== undefined) put('name', body.name.trim());
  if (body.code !== undefined) put('code', body.code);
  if (body.facultyId !== undefined) put('faculty_id', body.facultyId || null);
  if (body.admissionQuota !== undefined) put('admission_quota', body.admissionQuota);
  if (body.jambCutoff !== undefined) put('jamb_cutoff', body.jambCutoff);
  if (body.postUtmeCutoff !== undefined) put('post_utme_cutoff', body.postUtmeCutoff);
  if (body.aggregateCutoff !== undefined) put('aggregate_cutoff', body.aggregateCutoff);
  if (body.minCredits !== undefined) put('min_credits', body.minCredits);
  if (body.maxSittings !== undefined) put('max_sittings', body.maxSittings);
  if (body.olevelNotes !== undefined) put('olevel_notes', body.olevelNotes || null);
  if (body.isActive !== undefined) put('is_active', body.isActive);

  if (!sets.length && body.olevelRequirements === undefined) {
    throw ApiError.badRequest('Nothing to update');
  }

  try {
    await transaction(async (client) => {
      if (sets.length) {
        params.push(id, institutionId);
        const { rows } = await client.query(
          `UPDATE departments SET ${sets.join(', ')}
            WHERE id = $${params.length - 1} AND institution_id = $${params.length}
            RETURNING id`,
          params
        );
        if (!rows.length) throw ApiError.notFound('Department not found');
      } else {
        const { rows } = await client.query(
          'SELECT id FROM departments WHERE id = $1 AND institution_id = $2',
          [id, institutionId]
        );
        if (!rows.length) throw ApiError.notFound('Department not found');
      }
      await replaceOlevelRequirements(client, id, body.olevelRequirements);
    });
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A department with that name already exists');
    throw err;
  }

  return departmentWithRequirements(institutionId, id);
}

async function deleteDepartment(institutionId, id) {
  const used = await queryOne('SELECT COUNT(*)::int AS n FROM applications WHERE department_id = $1', [id]);
  if (used?.n > 0) {
    throw ApiError.badRequest(
      `This department has ${used.n} application(s) and cannot be deleted. Deactivate it instead.`,
      { code: 'DEPARTMENT_IN_USE' }
    );
  }
  const row = await queryOne(
    'DELETE FROM departments WHERE id = $1 AND institution_id = $2 RETURNING id',
    [id, institutionId]
  );
  if (!row) throw ApiError.notFound('Department not found');
  return { deleted: true };
}

module.exports = {
  listFaculties, createFaculty, updateFaculty, deleteFaculty,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  departmentWithRequirements,
  shapeFaculty, shapeDepartment, GRADES,
};
