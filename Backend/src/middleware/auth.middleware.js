'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { queryOne } = require('../config/database');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Extract a bearer token from the Authorization header or an httpOnly cookie.
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies.access_token) return req.cookies.access_token;
  return null;
}

/**
 * Endpoints that remain usable while `must_change_password` is set, so the user
 * can actually complete the change (and sign out).
 */
const PASSWORD_CHANGE_EXEMPT = ['/auth/change-password', '/auth/logout', '/auth/me', '/auth/refresh'];

function isPasswordChangeExempt(req) {
  const path = `${req.baseUrl || ''}${req.path || ''}`;
  return PASSWORD_CHANGE_EXEMPT.some((p) => path.endsWith(p));
}

/**
 * Require a valid access token. Loads a fresh user row so revoked / deactivated
 * accounts are rejected immediately, then attaches `req.user`.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token missing');

  const payload = verifyAccessToken(token);

  const user = await queryOne(
    `SELECT id, email, role, full_name, phone, institution_id,
            is_email_verified, is_active, must_change_password
       FROM users WHERE id = $1`,
    [payload.sub]
  );

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.is_active) throw ApiError.forbidden('Account is deactivated', { code: 'ACCOUNT_DISABLED' });

  // Accounts created with a system-generated password (e.g. institutions
  // onboarded by an admin) may do nothing until that password is replaced.
  // Only the endpoints needed to complete that change stay reachable.
  if (user.must_change_password && !isPasswordChangeExempt(req)) {
    throw ApiError.forbidden('You must change your password before continuing', {
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
    phone: user.phone,
    institutionId: user.institution_id,
    isEmailVerified: user.is_email_verified,
    mustChangePassword: Boolean(user.must_change_password),
  };
  req.token = token;
  next();
});

/**
 * Optional auth: attaches req.user if a valid token is present, otherwise continues.
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await queryOne(
      `SELECT id, email, role, full_name, institution_id, is_email_verified, is_active
         FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (user && user.is_active) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        institutionId: user.institution_id,
        isEmailVerified: user.is_email_verified,
      };
    }
  } catch (_) {
    // ignore invalid token for optional auth
  }
  next();
});

/**
 * Require that the authenticated user's email is verified.
 */
const requireVerified = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.isEmailVerified) {
    return next(ApiError.forbidden('Please verify your email to continue', { code: 'EMAIL_NOT_VERIFIED' }));
  }
  next();
};

module.exports = { authenticate, optionalAuth, requireVerified, extractToken };
