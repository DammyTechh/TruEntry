'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const jsonLimitResponse = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    message,
    error: { code: 'RATE_LIMITED' },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Global API limiter.
 */
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitResponse('Too many requests. Please slow down.'),
});

/**
 * Stricter limiter for auth-sensitive endpoints (login, register, OTP, reset).
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitResponse('Too many attempts. Please try again later.'),
});

module.exports = { globalLimiter, authLimiter };
