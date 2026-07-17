'use strict';

/**
 * @swagger
 * /payments/initialize:
 *   post:
 *     tags: [Payments]
 *     summary: Initialize a Paystack transaction for an application fee (applicant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [applicationId]
 *             properties: { applicationId: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Returns the Paystack authorization URL
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
 *                         authorizationUrl: { type: string }
 *                         reference: { type: string }
 *
 * /payments/verify/{reference}:
 *   get:
 *     tags: [Payments]
 *     summary: Verify a transaction and submit the application on success
 *     parameters: [{ in: path, name: reference, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Verified }
 *       400: { description: Payment not successful }
 *
 * /payments/mine:
 *   get:
 *     tags: [Payments]
 *     summary: List my payments (applicant)
 *     responses: { 200: { description: Payments } }
 *
 * /payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get a payment by id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Payment } }
 *
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Paystack webhook (HMAC-verified, raw body)
 *     description: >
 *       Public endpoint called by Paystack. Requires a valid x-paystack-signature.
 *       Not for manual use. Mounted with a raw body parser.
 *     security: []
 *     responses:
 *       200: { description: Received }
 *       401: { description: Invalid signature }
 *
 * /decisioning/preview:
 *   post:
 *     tags: [Decisioning]
 *     summary: Preview quota-aware ranking for a department (no writes)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departmentId]
 *             properties:
 *               institutionId: { type: string, format: uuid, description: "Required for admin" }
 *               departmentId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ranked selected / waitlisted / ineligible lists
 *
 * /decisioning/run:
 *   post:
 *     tags: [Decisioning]
 *     summary: Commit a decision run — selected become recommended (officer/admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departmentId]
 *             properties:
 *               institutionId: { type: string, format: uuid }
 *               departmentId: { type: string, format: uuid }
 *     responses: { 200: { description: Committed } }
 *
 * /policies/active:
 *   get:
 *     tags: [Policies]
 *     summary: Get the active policy for an institution (public)
 *     security: []
 *     parameters: [{ in: query, name: institutionId, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Active policy }, 404: { $ref: '#/components/responses/NotFound' } }
 *
 * /policies:
 *   get:
 *     tags: [Policies]
 *     summary: List policies (admin/officer/registrar)
 *     responses: { 200: { description: Policies } }
 *   post:
 *     tags: [Policies]
 *     summary: Create a policy from editor HTML or an uploaded PDF
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               source: { type: string, enum: [editor, pdf] }
 *               contentHtml: { type: string }
 *               institutionId: { type: string, format: uuid }
 *               file: { type: string, format: binary }
 *     responses: { 201: { description: Created } }
 */
