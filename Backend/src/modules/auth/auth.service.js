'use strict';

const { query, queryOne, transaction } = require('../../config/database');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const {
  hashPassword,
  comparePassword,
  generateOtp,
  hashToken,
  randomToken,
} = require('../../utils/security');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { ROLES } = require('../../utils/constants');
const emailService = require('../../services/email.service');

const OTP_TTL_MS = config.security.otpExpiryMinutes * 60 * 1000;

/**
 * Create and email a fresh OTP for a given purpose. Invalidates prior tokens.
 */
async function issueOtp(userId, purpose) {
  const code = generateOtp(6);
  const tokenHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await transaction(async (client) => {
    await client.query(
      `UPDATE auth_tokens SET consumed_at = NOW()
         WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [userId, purpose]
    );
    await client.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [userId, purpose, tokenHash, expiresAt]
    );
  });
  return code;
}

/**
 * Validate and consume an OTP.
 */
async function consumeOtp(userId, purpose, code) {
  const tokenHash = hashToken(code);
  const row = await queryOne(
    `SELECT id, expires_at FROM auth_tokens
       WHERE user_id = $1 AND purpose = $2 AND token_hash = $3 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose, tokenHash]
  );
  if (!row) throw ApiError.badRequest('Invalid or already used code', { code: 'INVALID_OTP' });
  if (new Date(row.expires_at) < new Date()) {
    throw ApiError.badRequest('Code has expired. Please request a new one.', { code: 'OTP_EXPIRED' });
  }
  await query('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = $1', [row.id]);
}

/**
 * Persist a refresh token record and return the signed JWT.
 */
async function createRefreshToken(user, req) {
  const jti = randomToken(24);
  const token = signRefreshToken({ sub: user.id, role: user.role, jti });
  const decoded = verifyRefreshToken(token); // to read exp
  await query(
    `INSERT INTO refresh_tokens (user_id, jti, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,to_timestamp($5))`,
    [user.id, jti, req?.headers['user-agent'] || null, req?.ip || null, decoded.exp]
  );
  return token;
}

function buildTokens(user, refreshToken) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    institutionId: user.institution_id || null,
  });
  return { accessToken, refreshToken };
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    phone: u.phone,
    role: u.role,
    institutionId: u.institution_id || null,
    isEmailVerified: u.is_email_verified,
    createdAt: u.created_at,
  };
}

/* ------------------------------ Use cases ------------------------------ */

async function register({ fullName, email, phone, password }, req) {
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) throw ApiError.conflict('An account with this email already exists', { code: 'EMAIL_TAKEN' });

  const passwordHash = await hashPassword(password);

  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [email, passwordHash, fullName, phone || null, ROLES.APPLICANT]
    );
    const created = rows[0];
    await client.query(
      `INSERT INTO applicant_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [created.id]
    );
    return created;
  });

  const code = await issueOtp(user.id, 'email_verify');
  await emailService.sendVerificationOtp(user.email, user.full_name, code);
  logger.info('User registered', { userId: user.id });

  return { user: publicUser(user) };
}

async function verifyEmail({ email, otp }) {
  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw ApiError.notFound('Account not found');
  if (user.is_email_verified) return { alreadyVerified: true, user: publicUser(user) };

  await consumeOtp(user.id, 'email_verify', otp);
  const updated = await queryOne(
    'UPDATE users SET is_email_verified = TRUE WHERE id = $1 RETURNING *',
    [user.id]
  );
  await emailService.sendWelcome(updated.email, updated.full_name);
  return { user: publicUser(updated) };
}

async function resendOtp({ email }, purpose = 'email_verify') {
  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
  // Do not reveal whether the account exists.
  if (!user) return { sent: true };
  if (purpose === 'email_verify' && user.is_email_verified) return { sent: true };

  const code = await issueOtp(user.id, purpose);
  if (purpose === 'email_verify') {
    await emailService.sendVerificationOtp(user.email, user.full_name, code);
  } else {
    await emailService.sendPasswordResetOtp(user.email, user.full_name, code);
  }
  return { sent: true };
}

async function login({ email, password }, req) {
  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  if (!user.is_active) throw ApiError.forbidden('Account is deactivated', { code: 'ACCOUNT_DISABLED' });

  if (!user.is_email_verified) {
    // Re-issue OTP to help unverified users complete signup.
    const code = await issueOtp(user.id, 'email_verify');
    await emailService.sendVerificationOtp(user.email, user.full_name, code);
    throw ApiError.forbidden('Email not verified. A new verification code has been sent.', {
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  const refreshToken = await createRefreshToken(user, req);
  const tokens = buildTokens(user, refreshToken);
  logger.info('User logged in', { userId: user.id, role: user.role });

  return { user: publicUser(user), tokens };
}

async function refresh({ refreshToken }, req) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token required', { code: 'REFRESH_MISSING' });
  const payload = verifyRefreshToken(refreshToken);

  const record = await queryOne(
    'SELECT * FROM refresh_tokens WHERE jti = $1 AND user_id = $2',
    [payload.jti, payload.sub]
  );
  if (!record || record.revoked_at) {
    throw ApiError.unauthorized('Session has been revoked. Please sign in again.', { code: 'REFRESH_REVOKED' });
  }
  if (new Date(record.expires_at) < new Date()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.', { code: 'REFRESH_EXPIRED' });
  }

  const user = await queryOne('SELECT * FROM users WHERE id = $1', [payload.sub]);
  if (!user || !user.is_active) throw ApiError.unauthorized('Account unavailable');

  // Rotate: revoke the old token, issue a new one.
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);
  const newRefresh = await createRefreshToken(user, req);
  return { tokens: buildTokens(user, newRefresh) };
}

async function logout({ refreshToken }, userId) {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = $1', [payload.jti]);
    } catch {
      /* ignore */
    }
  } else if (userId) {
    // Revoke all sessions for the user.
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  }
  return { loggedOut: true };
}

async function forgotPassword({ email }) {
  return resendOtp({ email }, 'password_reset');
}

async function resetPassword({ email, otp, password }) {
  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw ApiError.notFound('Account not found');
  await consumeOtp(user.id, 'password_reset', otp);
  const passwordHash = await hashPassword(password);
  await transaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
    // Invalidate all sessions.
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
  });
  return { reset: true };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
  const ok = await comparePassword(currentPassword, user.password_hash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect', { code: 'WRONG_PASSWORD' });
  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  return { changed: true };
}

async function me(userId) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw ApiError.notFound('Account not found');
  return { user: publicUser(user) };
}

module.exports = {
  register,
  verifyEmail,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  me,
  publicUser,
  issueOtp,
  createRefreshToken,
  buildTokens,
};
