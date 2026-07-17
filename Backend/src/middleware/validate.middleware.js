'use strict';

const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

/**
 * Validate request segments against Zod schemas and replace them with the
 * parsed (coerced, stripped) output.
 * @param {{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }} schemas
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) {
        // req.query is read-only in Express 5; assign parsed values individually.
        const parsed = schemas.query.parse(req.query ?? {});
        req.validatedQuery = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.') || '(root)',
          message: e.message,
        }));
        return next(
          ApiError.unprocessable('Validation failed', {
            code: 'VALIDATION_ERROR',
            details,
          })
        );
      }
      next(err);
    }
  };
}

module.exports = validate;
