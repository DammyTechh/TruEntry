'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('./ApiError');

/**
 * Sign a short-lived access token.
 * @param {object} payload - typically { sub, role, institutionId }
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    issuer: 'truentry',
    audience: 'truentry-client',
  });
}

/**
 * Sign a long-lived refresh token. `jti` ties it to a DB record for revocation.
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: 'truentry',
    audience: 'truentry-client',
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'truentry',
      audience: 'truentry-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid access token', { code: 'TOKEN_INVALID' });
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'truentry',
      audience: 'truentry-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token expired', { code: 'REFRESH_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid refresh token', { code: 'REFRESH_INVALID' });
  }
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
