'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config');

/**
 * 404 handler for unmatched routes.
 */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, { code: 'ROUTE_NOT_FOUND' }));
}

/**
 * Map known low-level errors (pg, multer, jwt) to ApiError.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Postgres error codes
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return ApiError.conflict('A record with these details already exists', {
          code: 'DUPLICATE_RECORD',
          details: err.detail,
        });
      case '23503': // foreign_key_violation
        return ApiError.badRequest('Referenced record does not exist', {
          code: 'FK_VIOLATION',
        });
      case '23502': // not_null_violation
        return ApiError.badRequest(`Missing required field: ${err.column}`, {
          code: 'NOT_NULL_VIOLATION',
        });
      case '22P02': // invalid_text_representation (bad uuid etc.)
        return ApiError.badRequest('Invalid input format', { code: 'INVALID_INPUT' });
      case '23514': // check_violation
        return ApiError.badRequest('Value violates a data constraint', {
          code: 'CHECK_VIOLATION',
        });
      default:
        break;
    }
  }

  // Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiError.badRequest('File too large', { code: 'FILE_TOO_LARGE' });
    }
    return ApiError.badRequest(err.message, { code: 'UPLOAD_ERROR' });
  }

  // Body parser JSON error
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body', { code: 'INVALID_JSON' });
  }

  return err;
}

/**
 * Central error middleware. Sends the consistent error envelope.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const normalized = normalizeError(err);
  const isApi = normalized instanceof ApiError;
  const statusCode = isApi ? normalized.statusCode : 500;

  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    userId: req.user ? req.user.id : undefined,
    code: normalized.code,
  };

  if (statusCode >= 500) {
    logger.error(normalized.message, { ...logMeta, stack: normalized.stack });
  } else {
    logger.warn(normalized.message, logMeta);
  }

  const body = {
    success: false,
    message:
      statusCode >= 500 && config.isProd
        ? 'An unexpected error occurred. Please try again later.'
        : normalized.message,
    error: {
      code: normalized.code || 'INTERNAL_ERROR',
      details: normalized.details,
    },
    timestamp: new Date().toISOString(),
  };

  if (!config.isProd && statusCode >= 500) {
    body.error.stack = normalized.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
