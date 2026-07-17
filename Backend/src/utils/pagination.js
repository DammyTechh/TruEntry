'use strict';

/**
 * Normalise pagination query params into safe integers.
 * @returns {{ page:number, limit:number, offset:number }}
 */
function getPagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (Number.isNaN(page) || page < 1) page = 1;
  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Build an ORDER BY clause from a whitelist.
 * @param {string} sortParam - e.g. "created_at:desc"
 * @param {string[]} allowed - allowed column names
 * @param {string} fallback - default clause
 */
function getSort(sortParam, allowed, fallback = 'created_at DESC') {
  if (!sortParam) return fallback;
  const [col, dirRaw] = String(sortParam).split(':');
  if (!allowed.includes(col)) return fallback;
  const dir = String(dirRaw).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${col} ${dir}`;
}

module.exports = { getPagination, getSort };
