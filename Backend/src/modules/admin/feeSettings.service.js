'use strict';

/**
 * Platform fee settings, keyed on institution TYPE
 * (university | polytechnic | college_of_education).
 *
 * Money is stored and handled in KOBO everywhere; naira values are exposed for
 * display only. Never do float arithmetic on money.
 */
const { query, queryOne } = require('../../config/database');
const ApiError = require('../../utils/ApiError');

const TYPES = ['university', 'polytechnic', 'college_of_education'];

function shape(row) {
  return {
    id: row.id,
    institutionType: row.institution_type,
    applicationFeeKobo: row.application_fee_kobo,
    applicationFeeNaira: row.application_fee_kobo / 100,
    secondSittingFeeKobo: row.second_sitting_fee_kobo,
    secondSittingFeeNaira: row.second_sitting_fee_kobo / 100,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

async function list() {
  const { rows } = await query('SELECT * FROM fee_settings ORDER BY institution_type');
  return rows.map(shape);
}

async function update(institutionType, { applicationFeeNaira, secondSittingFeeNaira, isActive }, adminUserId) {
  if (!TYPES.includes(institutionType)) {
    throw ApiError.badRequest('Unknown institution type', { code: 'BAD_TYPE' });
  }
  const sets = [];
  const params = [];

  if (applicationFeeNaira !== undefined) {
    params.push(Math.round(applicationFeeNaira * 100));
    sets.push(`application_fee_kobo = $${params.length}`);
  }
  if (secondSittingFeeNaira !== undefined) {
    params.push(Math.round(secondSittingFeeNaira * 100));
    sets.push(`second_sitting_fee_kobo = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (!sets.length) throw ApiError.badRequest('Nothing to update');

  params.push(adminUserId);
  sets.push(`updated_by = $${params.length}`);
  params.push(institutionType);

  const row = await queryOne(
    `UPDATE fee_settings SET ${sets.join(', ')} WHERE institution_type = $${params.length} RETURNING *`,
    params
  );
  if (!row) throw ApiError.notFound('Fee settings not found for this type');
  return shape(row);
}

/**
 * Resolve the fee an applicant pays for a given institution, including the
 * second-sitting surcharge when they submit two O'Level sittings.
 */
async function resolveFeeForInstitution(institutionId, { sittings = 1 } = {}) {
  const row = await queryOne(
    `SELECT f.*
       FROM institutions i
       LEFT JOIN institution_categories c ON c.id = i.category_id
       LEFT JOIN fee_settings f ON f.institution_type = COALESCE(c.type, 'university')
      WHERE i.id = $1`,
    [institutionId]
  );
  if (!row) throw ApiError.notFound('Fee settings unavailable for this institution');

  const base = row.application_fee_kobo;
  const surcharge = sittings >= 2 ? row.second_sitting_fee_kobo : 0;
  return {
    institutionType: row.institution_type,
    applicationFeeKobo: base,
    secondSittingFeeKobo: surcharge,
    totalKobo: base + surcharge,
    totalNaira: (base + surcharge) / 100,
    sittings,
  };
}

module.exports = { list, update, resolveFeeForInstitution, TYPES };
