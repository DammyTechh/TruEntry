'use strict';

/**
 * Consistent success envelope for every endpoint.
 * Shape:
 * {
 *   success: true,
 *   message: string,
 *   data: any,
 *   meta?: { pagination },
 *   timestamp: ISO
 * }
 */
function success(res, { statusCode = 200, message = 'Success', data = null, meta } = {}) {
  const body = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, { message = 'Created successfully', data = null, meta } = {}) {
  return success(res, { statusCode: 201, message, data, meta });
}

function noContent(res) {
  return res.status(204).send();
}

/**
 * Paginated list helper.
 * @param {object} res
 * @param {object} opts
 * @param {Array} opts.data - items
 * @param {number} opts.total - total records
 * @param {number} opts.page
 * @param {number} opts.limit
 */
function paginated(res, { message = 'Success', data = [], total = 0, page = 1, limit = 20, meta = {} }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return success(res, {
    message,
    data,
    meta: {
      // Caller-supplied context (e.g. the quota a list belongs to) is merged
      // alongside pagination rather than discarded.
      ...meta,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
}

module.exports = { success, created, noContent, paginated };
