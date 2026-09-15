'use strict';

/**
 * @swagger
 * /admin/institutions:
 *   post:
 *     tags: [Institution Onboarding]
 *     summary: Onboard an institution and issue its login
 *     description: >
 *       Registers a tertiary institution and creates the single login for that
 *       school (role `institution`). The system generates a strong temporary
 *       password, flags the account so the password MUST be changed on first
 *       sign-in, and emails the credentials to the institution's official
 *       address. The school then signs in through the normal `/auth/login`
 *       endpoint — there is no separate authentication stack.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code, email]
 *             properties:
 *               name:         { type: string, example: Bowen University }
 *               code:         { type: string, example: BOWEN, description: Unique short code }
 *               email:        { type: string, format: email, description: Official address that receives the credentials }
 *               phone:        { type: string }
 *               state:        { type: string, example: Osun }
 *               region:       { type: string, example: South West }
 *               lga:          { type: string, example: Iwo }
 *               address:      { type: string }
 *               categoryId:   { type: string, format: uuid }
 *               logoUrl:      { type: string, format: uri }
 *               hasPostUtme:  { type: boolean }
 *     responses:
 *       201:
 *         description: Institution onboarded; credentials emailed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     institution: { type: object }
 *                     account:
 *                       type: object
 *                       properties:
 *                         id:    { type: string, format: uuid }
 *                         email: { type: string }
 *                         role:  { type: string, example: institution }
 *                     credentialsEmailed: { type: boolean }
 *       409: { description: Institution code or email already in use }
 *   get:
 *     tags: [Institution Onboarding]
 *     summary: List onboarded institutions with account status
 *     parameters:
 *       - { in: query, name: page,   schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit,  schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [university, polytechnic, college_of_education] }
 *     responses:
 *       200: { description: Institutions with their login account state (mustChangePassword, hasSignedIn) }
 *
 * /admin/institutions/{id}/resend-credentials:
 *   post:
 *     tags: [Institution Onboarding]
 *     summary: Re-issue and email a new temporary password
 *     description: >
 *       Generates a fresh temporary password, re-flags the account for a
 *       mandatory change, revokes all active sessions, and emails the new
 *       details. Use when a school never received or lost the first message.
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Credentials re-issued and emailed }
 *       404: { description: Institution or its login account not found }
 *
 * /admin/fee-settings:
 *   get:
 *     tags: [Fee Settings]
 *     summary: Application fees per institution type
 *     description: >
 *       Fees are configured per regulatory institution type (university,
 *       polytechnic, college_of_education). Each row carries the base
 *       application fee and the surcharge added when an applicant submits two
 *       O'Level sittings. Amounts are stored in kobo; naira values are provided
 *       for display.
 *     responses:
 *       200:
 *         description: Fee settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       institutionType:       { type: string, enum: [university, polytechnic, college_of_education] }
 *                       applicationFeeKobo:    { type: integer, example: 250000 }
 *                       applicationFeeNaira:   { type: number,  example: 2500 }
 *                       secondSittingFeeKobo:  { type: integer, example: 100000 }
 *                       secondSittingFeeNaira: { type: number,  example: 1000 }
 *                       isActive:              { type: boolean }
 *
 * /admin/fee-settings/{type}:
 *   patch:
 *     tags: [Fee Settings]
 *     summary: Update the fee for an institution type
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [university, polytechnic, college_of_education] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationFeeNaira:   { type: number, minimum: 0, example: 2500 }
 *               secondSittingFeeNaira: { type: number, minimum: 0, example: 1000 }
 *               isActive:              { type: boolean }
 *     responses:
 *       200: { description: Updated fee settings }
 *       400: { description: Unknown institution type or empty payload }
 *
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change the signed-in user's password
 *     description: >
 *       Also clears the `mustChangePassword` flag. Accounts created with a
 *       system-generated password (institutions onboarded by an admin) are
 *       restricted to `/auth/me`, `/auth/refresh`, `/auth/logout` and this
 *       endpoint until the password is replaced; every other request returns
 *       403 `PASSWORD_CHANGE_REQUIRED`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8, description: 8+ chars with upper, lower and a number }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Current password incorrect }
 */
