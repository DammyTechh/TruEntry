'use strict';

const express = require('express');
const controller = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimit.middleware');
const v = require('./auth.validator');

const router = express.Router();

router.post('/register', authLimiter, validate({ body: v.registerSchema }), controller.register);
router.post('/verify-email', authLimiter, validate({ body: v.verifyEmailSchema }), controller.verifyEmail);
router.post('/resend-otp', authLimiter, validate({ body: v.resendOtpSchema }), controller.resendOtp);
router.post('/login', authLimiter, validate({ body: v.loginSchema }), controller.login);
router.post('/refresh', validate({ body: v.refreshSchema }), controller.refresh);
router.post('/logout', controller.logout);
router.post('/forgot-password', authLimiter, validate({ body: v.forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: v.resetPasswordSchema }), controller.resetPassword);
router.post('/change-password', authenticate, validate({ body: v.changePasswordSchema }), controller.changePassword);
router.get('/me', authenticate, controller.me);

module.exports = router;
