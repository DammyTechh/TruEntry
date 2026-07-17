'use strict';

const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('A valid email is required');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const otp = z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits');

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email,
  phone: z.string().trim().min(7).max(20).optional(),
  password,
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const verifyEmailSchema = z.object({ email, otp });
const resendOtpSchema = z.object({ email });
const forgotPasswordSchema = z.object({ email });
const resetPasswordSchema = z.object({ email, otp, password });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});
const refreshSchema = z.object({ refreshToken: z.string().optional() });

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshSchema,
};
