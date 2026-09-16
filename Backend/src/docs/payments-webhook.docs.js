'use strict';

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Paystack webhook (server-to-server)
 *     security: []
 *     description: >
 *       Receives Paystack events. This endpoint is NOT authenticated with a JWT
 *       — Paystack cannot present one. It is authenticated by verifying the
 *       `x-paystack-signature` header, an HMAC-SHA512 of the raw request body
 *       keyed with your Paystack secret key. Requests with a missing or invalid
 *       signature are rejected with 401.
 *
 *
 *       This is the reliable half of payment capture: the browser redirect to
 *       `/payment/callback` can be lost (the applicant closes the tab, the
 *       network drops), but the webhook still settles the transaction. Only
 *       `charge.success` is acted upon; everything else is acknowledged and
 *       ignored. Processing is idempotent — a payment already marked successful
 *       is not settled twice.
 *
 *
 *       Configure the URL in your Paystack dashboard as
 *       `https://<your-api-domain>/api/v1/payments/webhook`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event: { type: string, example: charge.success }
 *               data:
 *                 type: object
 *                 properties:
 *                   reference: { type: string }
 *                   channel:   { type: string }
 *                   amount:    { type: integer, description: Amount in kobo }
 *     responses:
 *       200: { description: Event received (always returned quickly, processing continues asynchronously) }
 *       401: { description: Missing or invalid signature }
 */
