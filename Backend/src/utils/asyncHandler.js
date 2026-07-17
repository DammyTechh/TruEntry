'use strict';

/**
 * Wrap an async route handler so rejected promises reach the error middleware
 * without try/catch boilerplate in every controller.
 * @param {Function} fn
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
