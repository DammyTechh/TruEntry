'use strict';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new applicant account
 *     description: Creates an applicant account and emails a 6-digit verification code.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8, description: "Min 8 chars incl. upper, lower, number" }
 *               fullName: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Account created
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } }
 *       409: { description: Email already registered, content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } } }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with the OTP code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456", description: "6-digit verification code" }
 *     responses:
 *       200: { description: Email verified, content: { application/json: { schema: { $ref: '#/components/schemas/ApiSuccess' } } } }
 *
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the email verification code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200: { description: Sent if the account exists }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in and receive access and refresh tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Signed in
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *                         tokens: { $ref: '#/components/schemas/AuthTokens' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and issue a new access token
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { refreshToken: { type: string, description: "Optional if sent as httpOnly cookie" } }
 *     responses:
 *       200: { description: New tokens issued }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current refresh session
 *     responses:
 *       200: { description: Signed out }
 *
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200: { description: Sent if the account exists }
 *
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using the emailed code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, password]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, description: "6-digit reset code" }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset }
 *
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/User' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */