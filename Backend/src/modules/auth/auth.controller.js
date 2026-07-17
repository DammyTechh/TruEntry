'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/ApiResponse');
const authService = require('./auth.service');
const config = require('../../config');
const { recordAudit } = require('../../middleware/audit.middleware');

const REFRESH_COOKIE = 'refresh_token';
const cookieOpts = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: config.isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: config.apiPrefix + '/auth',
};

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  await recordAudit({ req, action: 'auth.register', entity: 'user', entityId: result.user.id });
  return created(res, {
    message: 'Account created. Check your email for a verification code.',
    data: result,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  return success(res, { message: 'Email verified successfully. You can now sign in.', data: result });
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.body);
  return success(res, { message: 'If the account exists, a new code has been sent.' });
});

const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.login(req.body, req);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
  req.user = user;
  await recordAudit({ req, action: 'auth.login', entity: 'user', entityId: user.id });
  return success(res, { message: 'Signed in successfully', data: { user, tokens } });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies[REFRESH_COOKIE];
  const { tokens } = await authService.refresh({ refreshToken }, req);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
  return success(res, { message: 'Token refreshed', data: { tokens } });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies[REFRESH_COOKIE];
  await authService.logout({ refreshToken }, req.user?.id);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  return success(res, { message: 'Signed out successfully' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  return success(res, { message: 'If the account exists, a password reset code has been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  return success(res, { message: 'Password reset successfully. Please sign in.' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  await recordAudit({ req, action: 'auth.password_changed', entity: 'user', entityId: req.user.id });
  return success(res, { message: 'Password changed successfully' });
});

const me = asyncHandler(async (req, res) => {
  const result = await authService.me(req.user.id);
  return success(res, { message: 'Current user', data: result });
});

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
};
