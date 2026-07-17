'use strict';

/**
 * Operational error carrying an HTTP status and machine-readable code.
 * Anything thrown that is NOT an ApiError is treated as an unexpected 500.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message - human-readable message.
   * @param {object} [options]
   * @param {string} [options.code] - machine code, e.g. 'VALIDATION_ERROR'.
   * @param {Array|object} [options.details] - field-level details.
   */
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || defaultCodeFor(statusCode);
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', opts) {
    return new ApiError(400, message, opts);
  }
  static unauthorized(message = 'Authentication required', opts) {
    return new ApiError(401, message, opts);
  }
  static forbidden(message = 'You do not have permission to perform this action', opts) {
    return new ApiError(403, message, opts);
  }
  static notFound(message = 'Resource not found', opts) {
    return new ApiError(404, message, opts);
  }
  static conflict(message = 'Resource conflict', opts) {
    return new ApiError(409, message, opts);
  }
  static unprocessable(message = 'Unprocessable entity', opts) {
    return new ApiError(422, message, opts);
  }
  static tooMany(message = 'Too many requests', opts) {
    return new ApiError(429, message, opts);
  }
  static internal(message = 'Something went wrong', opts) {
    return new ApiError(500, message, opts);
  }
  static badGateway(message = 'Upstream service error', opts) {
    return new ApiError(502, message, opts);
  }
  static serviceUnavailable(message = 'Service temporarily unavailable', opts) {
    return new ApiError(503, message, opts);
  }
}

function defaultCodeFor(status) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] || 'ERROR';
}

module.exports = ApiError;
