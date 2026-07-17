'use strict';

const { query, queryOne, queryMany } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const storageService = require('../../services/storage.service');

function shape(p) {
  return {
    id: p.id,
    institutionId: p.institution_id,
    title: p.title,
    source: p.source,
    contentHtml: p.content_html,
    pdfUrl: p.pdf_url,
    version: p.version,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * Get the active policy for an institution (falls back to global policy).
 */
async function getActivePolicy(institutionId) {
  let p = null;
  if (institutionId) {
    p = await queryOne(
      `SELECT * FROM policies WHERE institution_id = $1 AND is_active = TRUE
         ORDER BY version DESC LIMIT 1`,
      [institutionId]
    );
  }
  if (!p) {
    p = await queryOne(
      `SELECT * FROM policies WHERE institution_id IS NULL AND is_active = TRUE
         ORDER BY version DESC LIMIT 1`
    );
  }
  if (!p) throw ApiError.notFound('No policy statement available', { code: 'NO_POLICY' });
  return shape(p);
}

async function listPolicies({ institutionId } = {}) {
  const rows = institutionId
    ? await queryMany('SELECT * FROM policies WHERE institution_id = $1 ORDER BY version DESC', [institutionId])
    : await queryMany('SELECT * FROM policies ORDER BY created_at DESC');
  return rows.map(shape);
}

/**
 * Create a policy from the editor (HTML) or an uploaded PDF.
 * Deactivates prior active policies for the same scope, and increments version.
 */
async function createPolicy({ institutionId, title, source, contentHtml, file, userId }) {
  if (source === 'editor' && !contentHtml) {
    throw ApiError.badRequest('contentHtml is required when source is "editor"');
  }
  if (source === 'pdf' && !file) {
    throw ApiError.badRequest('A PDF file is required when source is "pdf"');
  }

  let pdfUrl = null;
  if (source === 'pdf') {
    const { url } = await storageService.upload({
      bucket: storageService.buckets.documents,
      buffer: file.buffer,
      contentType: file.mimetype,
      folder: institutionId ? `policies/${institutionId}` : 'policies/global',
    });
    pdfUrl = url;
  }

  const scopeClause = institutionId ? 'institution_id = $1' : 'institution_id IS NULL';
  const scopeParams = institutionId ? [institutionId] : [];
  const last = await queryOne(
    `SELECT COALESCE(MAX(version),0) AS v FROM policies WHERE ${scopeClause}`,
    scopeParams
  );
  const version = Number(last.v) + 1;

  await query(
    `UPDATE policies SET is_active = FALSE WHERE ${scopeClause} AND is_active = TRUE`,
    scopeParams
  );

  const row = await queryOne(
    `INSERT INTO policies (institution_id, title, source, content_html, pdf_url, version, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING *`,
    [institutionId || null, title, source, contentHtml || null, pdfUrl, version, userId || null]
  );
  return shape(row);
}

async function updatePolicy(id, { title, contentHtml, isActive }) {
  const existing = await queryOne('SELECT * FROM policies WHERE id = $1', [id]);
  if (!existing) throw ApiError.notFound('Policy not found');
  const row = await queryOne(
    `UPDATE policies SET title = COALESCE($1,title),
        content_html = COALESCE($2,content_html),
        is_active = COALESCE($3,is_active)
     WHERE id = $4 RETURNING *`,
    [title ?? null, contentHtml ?? null, isActive ?? null, id]
  );
  return shape(row);
}

async function deletePolicy(id) {
  const res = await query('DELETE FROM policies WHERE id = $1', [id]);
  if (!res.rowCount) throw ApiError.notFound('Policy not found');
  return { deleted: true };
}

module.exports = { getActivePolicy, listPolicies, createPolicy, updatePolicy, deletePolicy, shape };
