'use strict';

const { query, queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { getPagination } = require('../../utils/pagination');
const storageService = require('../../services/storage.service');

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ------------------------------ Categories ----------------------------- */

async function listCategories({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = TRUE' : '';
  return queryMany(`SELECT * FROM institution_categories ${where} ORDER BY name ASC`);
}

async function createCategory({ name, description }) {
  const slug = slugify(name);
  try {
    return await queryOne(
      `INSERT INTO institution_categories (name, slug, description) VALUES ($1,$2,$3) RETURNING *`,
      [name, slug, description || null]
    );
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A category with that name already exists');
    throw err;
  }
}

async function updateCategory(id, body) {
  const existing = await queryOne('SELECT * FROM institution_categories WHERE id = $1', [id]);
  if (!existing) throw ApiError.notFound('Category not found');
  const name = body.name ?? existing.name;
  const slug = body.name ? slugify(body.name) : existing.slug;
  return queryOne(
    `UPDATE institution_categories
       SET name = $1, slug = $2, description = $3, is_active = $4
     WHERE id = $5 RETURNING *`,
    [name, slug, body.description ?? existing.description, body.isActive ?? existing.is_active, id]
  );
}

async function deleteCategory(id) {
  const res = await query('DELETE FROM institution_categories WHERE id = $1', [id]);
  if (!res.rowCount) throw ApiError.notFound('Category not found');
  return { deleted: true };
}

/* ----------------------------- Institutions ---------------------------- */

async function listInstitutions(query_) {
  const { page, limit, offset } = getPagination(query_);
  const filters = [];
  const params = [];
  let i = 1;

  if (query_.categoryId) { filters.push(`i.category_id = $${i++}`); params.push(query_.categoryId); }
  if (query_.state) { filters.push(`i.state = $${i++}`); params.push(query_.state); }
  if (query_.hasPostUtme) { filters.push(`i.has_post_utme = $${i++}`); params.push(query_.hasPostUtme === 'true'); }
  if (query_.search) { filters.push(`(i.name ILIKE $${i} OR i.code ILIKE $${i})`); params.push(`%${query_.search}%`); i++; }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const rows = await queryMany(
    `SELECT i.*, c.name AS category_name,
            (SELECT COUNT(*) FROM departments d WHERE d.institution_id = i.id) AS department_count
       FROM institutions i
       LEFT JOIN institution_categories c ON c.id = i.category_id
       ${where}
       ORDER BY i.name ASC
       LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );
  const totalRow = await queryOne(
    `SELECT COUNT(*)::int AS total FROM institutions i ${where}`,
    params
  );
  return { data: rows.map(shapeInstitution), total: totalRow.total, page, limit };
}

async function getInstitution(id) {
  const row = await queryOne(
    `SELECT i.*, c.name AS category_name
       FROM institutions i LEFT JOIN institution_categories c ON c.id = i.category_id
      WHERE i.id = $1`,
    [id]
  );
  if (!row) throw ApiError.notFound('Institution not found');
  const params = await queryOne('SELECT * FROM institution_parameters WHERE institution_id = $1', [id]);
  return { ...shapeInstitution(row), parameters: params ? shapeParams(params) : null };
}

function shapeInstitution(r) {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    categoryId: r.category_id,
    categoryName: r.category_name,
    hasPostUtme: r.has_post_utme,
    email: r.email,
    phone: r.phone,
    address: r.address,
    state: r.state,
    logoUrl: r.logo_url,
    letterheadUrl: r.letterhead_url,
    signatureUrl: r.signature_url,
    description: r.description,
    isActive: r.is_active,
    departmentCount: r.department_count != null ? Number(r.department_count) : undefined,
    createdAt: r.created_at,
  };
}

function shapeParams(p) {
  return {
    admissionCriteria: p.admission_criteria,
    minJambScore: Number(p.min_jamb_score),
    minPostUtmeScore: Number(p.min_post_utme_score),
    jambWeight: Number(p.jamb_weight),
    postUtmeWeight: Number(p.post_utme_weight),
    totalQuota: p.total_quota,
    admissionOpen: p.admission_open,
    sessionLabel: p.session_label,
  };
}

async function createInstitution(body) {
  return transaction(async (client) => {
    let inst;
    try {
      const { rows } = await client.query(
        `INSERT INTO institutions (name, code, category_id, has_post_utme, email, phone, address, state, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          body.name, body.code, body.categoryId || null, body.hasPostUtme || false,
          body.email || null, body.phone || null, body.address || null, body.state || null,
          body.description || null,
        ]
      );
      inst = rows[0];
    } catch (err) {
      if (err.code === '23505') throw ApiError.conflict('An institution with that code already exists');
      throw err;
    }
    // Seed default parameters aligned with hasPostUtme.
    await client.query(
      `INSERT INTO institution_parameters (institution_id, admission_criteria)
       VALUES ($1, $2)`,
      [inst.id, body.hasPostUtme ? 'jamb_postutme_average' : 'jamb_only']
    );
    return shapeInstitution(inst);
  });
}

async function updateInstitution(id, body) {
  const existing = await queryOne('SELECT * FROM institutions WHERE id = $1', [id]);
  if (!existing) throw ApiError.notFound('Institution not found');
  const map = {
    name: 'name', code: 'code', categoryId: 'category_id', hasPostUtme: 'has_post_utme',
    email: 'email', phone: 'phone', address: 'address', state: 'state', description: 'description',
    isActive: 'is_active',
  };
  const sets = []; const values = []; let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = $${i++}`); values.push(body[k]); }
  }
  if (!sets.length) return getInstitution(id);
  values.push(id);
  const row = await queryOne(`UPDATE institutions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return shapeInstitution(row);
}

async function deleteInstitution(id) {
  const res = await query('DELETE FROM institutions WHERE id = $1', [id]);
  if (!res.rowCount) throw ApiError.notFound('Institution not found');
  return { deleted: true };
}

async function uploadAsset(id, kind, file) {
  const map = { logo: 'logo_url', letterhead: 'letterhead_url', signature: 'signature_url' };
  if (!map[kind]) throw ApiError.badRequest('Invalid asset kind');
  if (!file) throw ApiError.badRequest('No file uploaded');
  const { url } = await storageService.upload({
    bucket: storageService.buckets.documents,
    buffer: file.buffer,
    contentType: file.mimetype,
    folder: `institutions/${id}`,
  });
  const row = await queryOne(`UPDATE institutions SET ${map[kind]} = $1 WHERE id = $2 RETURNING *`, [url, id]);
  if (!row) throw ApiError.notFound('Institution not found');
  return { [kind]: url };
}

/* ----------------------------- Parameters ------------------------------ */

async function getParameters(institutionId) {
  let p = await queryOne('SELECT * FROM institution_parameters WHERE institution_id = $1', [institutionId]);
  if (!p) {
    p = await queryOne(
      'INSERT INTO institution_parameters (institution_id) VALUES ($1) RETURNING *',
      [institutionId]
    );
  }
  return shapeParams(p);
}

async function updateParameters(institutionId, body) {
  await getParameters(institutionId); // ensure exists
  const map = {
    admissionCriteria: 'admission_criteria',
    minJambScore: 'min_jamb_score',
    minPostUtmeScore: 'min_post_utme_score',
    jambWeight: 'jamb_weight',
    postUtmeWeight: 'post_utme_weight',
    totalQuota: 'total_quota',
    admissionOpen: 'admission_open',
    sessionLabel: 'session_label',
  };
  const sets = []; const values = []; let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = $${i++}`); values.push(body[k]); }
  }
  if (!sets.length) return getParameters(institutionId);
  values.push(institutionId);
  const row = await queryOne(
    `UPDATE institution_parameters SET ${sets.join(', ')} WHERE institution_id = $${i} RETURNING *`,
    values
  );
  return shapeParams(row);
}

/* ----------------------------- Departments ----------------------------- */

async function listDepartments(institutionId) {
  return (
    await queryMany(
      `SELECT * FROM departments WHERE institution_id = $1 ORDER BY name ASC`,
      [institutionId]
    )
  ).map(shapeDept);
}

function shapeDept(d) {
  return {
    id: d.id,
    institutionId: d.institution_id,
    name: d.name,
    code: d.code,
    admissionQuota: d.admission_quota,
    jambCutoff: Number(d.jamb_cutoff),
    postUtmeCutoff: Number(d.post_utme_cutoff),
    aggregateCutoff: Number(d.aggregate_cutoff),
    isActive: d.is_active,
    createdAt: d.created_at,
  };
}

async function getDepartment(id) {
  const d = await queryOne('SELECT * FROM departments WHERE id = $1', [id]);
  if (!d) throw ApiError.notFound('Department not found');
  return shapeDept(d);
}

async function createDepartment(institutionId, body) {
  const inst = await queryOne('SELECT id FROM institutions WHERE id = $1', [institutionId]);
  if (!inst) throw ApiError.notFound('Institution not found');
  try {
    const row = await queryOne(
      `INSERT INTO departments (institution_id, name, code, admission_quota, jamb_cutoff, post_utme_cutoff, aggregate_cutoff)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        institutionId, body.name, body.code || null, body.admissionQuota || 0,
        body.jambCutoff || 0, body.postUtmeCutoff || 0, body.aggregateCutoff || 0,
      ]
    );
    return shapeDept(row);
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('A department with that name already exists');
    throw err;
  }
}

async function updateDepartment(id, body) {
  const existing = await queryOne('SELECT * FROM departments WHERE id = $1', [id]);
  if (!existing) throw ApiError.notFound('Department not found');
  const map = {
    name: 'name', code: 'code', admissionQuota: 'admission_quota',
    jambCutoff: 'jamb_cutoff', postUtmeCutoff: 'post_utme_cutoff',
    aggregateCutoff: 'aggregate_cutoff', isActive: 'is_active',
  };
  const sets = []; const values = []; let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = $${i++}`); values.push(body[k]); }
  }
  if (!sets.length) return shapeDept(existing);
  values.push(id);
  const row = await queryOne(`UPDATE departments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return shapeDept(row);
}

async function deleteDepartment(id) {
  const res = await query('DELETE FROM departments WHERE id = $1', [id]);
  if (!res.rowCount) throw ApiError.notFound('Department not found');
  return { deleted: true };
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listInstitutions, getInstitution, createInstitution, updateInstitution, deleteInstitution, uploadAsset,
  getParameters, updateParameters,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  shapeInstitution,
};
