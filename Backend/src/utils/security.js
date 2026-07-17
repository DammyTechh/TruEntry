'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

/**
 * Hash a plaintext password.
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, config.security.bcryptRounds);
}

/**
 * Compare a plaintext password with a stored hash.
 */
async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Generate a numeric OTP of the given length (default 6).
 */
function generateOtp(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

/**
 * Hash an OTP / token for storage so raw values never sit in the DB.
 */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Random URL-safe token (used for refresh jti, reset links, references).
 */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a human-friendly reference, e.g. TRU-APP-8FH2K9.
 */
function reference(prefix = 'TRU') {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const time = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${time}${rand}`;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateOtp,
  hashToken,
  randomToken,
  reference,
};
