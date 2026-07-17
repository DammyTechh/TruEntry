'use strict';

const { query, queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { reference: makeRef } = require('../../utils/security');
const { getPagination } = require('../../utils/pagination');
const paystack = require('../../services/payment.service');
const emailService = require('../../services/email.service');
const config = require('../../config');
const logger = require('../../config/logger');
const { APPLICATION_STATUS, PAYMENT_STATUS, PAYMENT_PURPOSE } = require('../../utils/constants');
const applicationService = require('../applications/application.service');

const APPLICATION_FEE_NAIRA = config.paystack.applicationFeeNgn || 2500;

function shape(p) {
  return {
    id: p.id,
    reference: p.reference,
    applicationId: p.application_id,
    userId: p.user_id,
    purpose: p.purpose,
    amountNaira: paystack.koboToNaira(p.amount_kobo),
    status: p.status,
    channel: p.channel,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  };
}

/**
 * Initialize a Paystack transaction for an application's admission fee.
 */
async function initialize(userId, applicationId) {
  const app = await queryOne(
    `SELECT a.*, u.email, u.full_name FROM applications a JOIN users u ON u.id = a.applicant_id
      WHERE a.id = $1 AND a.applicant_id = $2`,
    [applicationId, userId]
  );
  if (!app) throw ApiError.notFound('Application not found');
  if (app.payment_status === PAYMENT_STATUS.SUCCESS) {
    throw ApiError.badRequest('This application has already been paid for', { code: 'ALREADY_PAID' });
  }

  // Reuse a pending payment if one exists, else create a fresh reference.
  let payment = await queryOne(
    `SELECT * FROM payments WHERE application_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1`,
    [applicationId, PAYMENT_STATUS.PENDING]
  );
  const ref = payment ? payment.reference : makeRef('TRU-PAY');
  const amountKobo = paystack.nairaToKobo(APPLICATION_FEE_NAIRA);

  if (!payment) {
    payment = await queryOne(
      `INSERT INTO payments (reference, application_id, user_id, purpose, amount_kobo, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ref, applicationId, userId, PAYMENT_PURPOSE.APPLICATION, amountKobo, PAYMENT_STATUS.PENDING]
    );
  }

  const init = await paystack.initializeTransaction({
    email: app.email,
    amountKobo,
    reference: ref,
    metadata: {
      applicationId,
      userId,
      purpose: PAYMENT_PURPOSE.APPLICATION,
      applicationRef: app.reference,
    },
  });

  return {
    payment: shape(payment),
    authorizationUrl: init.authorizationUrl,
    accessCode: init.accessCode,
    reference: ref,
  };
}

/**
 * Verify a transaction against Paystack and, on success, submit the application.
 * Idempotent: a second verify of an already-successful payment is a no-op.
 */
async function verify(reference) {
  const payment = await queryOne('SELECT * FROM payments WHERE reference = $1', [reference]);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === PAYMENT_STATUS.SUCCESS) {
    return { alreadyProcessed: true, payment: shape(payment) };
  }

  const result = await paystack.verifyTransaction(reference);
  if (result.status !== 'success') {
    await query('UPDATE payments SET status = $1, raw = $2 WHERE id = $3', [
      PAYMENT_STATUS.FAILED, JSON.stringify(result.raw || {}), payment.id,
    ]);
    throw ApiError.badRequest('Payment was not successful', { code: 'PAYMENT_FAILED', status: result.status });
  }

  await settleSuccess(payment, result);
  const updated = await queryOne('SELECT * FROM payments WHERE id = $1', [payment.id]);
  return { alreadyProcessed: false, payment: shape(updated) };
}

/**
 * Shared success handler used by both verify and webhook.
 */
async function settleSuccess(payment, result) {
  await transaction(async (client) => {
    await client.query(
      `UPDATE payments SET status = $1, channel = $2, paid_at = NOW(), raw = $3 WHERE id = $4`,
      [PAYMENT_STATUS.SUCCESS, result.channel || null, JSON.stringify(result.raw || {}), payment.id]
    );

    if (payment.purpose === PAYMENT_PURPOSE.APPLICATION && payment.application_id) {
      const app = await client.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [payment.application_id]);
      const application = app.rows[0];
      if (application && application.status === APPLICATION_STATUS.PENDING_PAYMENT) {
        await client.query(
          `UPDATE applications SET status = $1, payment_status = $2, submitted_at = NOW() WHERE id = $3`,
          [APPLICATION_STATUS.SUBMITTED, PAYMENT_STATUS.SUCCESS, application.id]
        );
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, to_status, note)
           VALUES ($1,$2,$3,$4)`,
          [application.id, APPLICATION_STATUS.PENDING_PAYMENT, APPLICATION_STATUS.SUBMITTED, 'Payment confirmed; application submitted']
        );
      } else if (application) {
        await client.query('UPDATE applications SET payment_status = $1 WHERE id = $2', [
          PAYMENT_STATUS.SUCCESS, application.id,
        ]);
      }
    }
  });

  // Fire-and-forget receipt email.
  try {
    const info = await queryOne(
      `SELECT p.*, u.email, u.full_name, a.reference AS application_ref
         FROM payments p JOIN users u ON u.id = p.user_id
         LEFT JOIN applications a ON a.id = p.application_id
        WHERE p.id = $1`,
      [payment.id]
    );
    if (info) {
      await emailService.sendPaymentReceipt(info.email, info.full_name, {
        reference: info.reference,
        amount: paystack.koboToNaira(info.amount_kobo),
        purpose: info.purpose,
        applicationRef: info.application_ref,
      });
    }
  } catch (err) {
    logger.warn('Failed to send payment receipt', { error: err.message });
  }
}

/**
 * Handle a verified Paystack webhook event.
 */
async function handleWebhook(event) {
  if (!event || event.event !== 'charge.success') {
    return { ignored: true };
  }
  const reference = event.data && event.data.reference;
  if (!reference) return { ignored: true };
  const payment = await queryOne('SELECT * FROM payments WHERE reference = $1', [reference]);
  if (!payment) {
    logger.warn('Webhook for unknown payment reference', { reference });
    return { ignored: true };
  }
  if (payment.status === PAYMENT_STATUS.SUCCESS) return { alreadyProcessed: true };

  await settleSuccess(payment, {
    status: 'success',
    channel: event.data.channel,
    raw: event.data,
  });
  return { processed: true };
}

async function listMine(userId, q) {
  const { page, limit, offset } = getPagination(q);
  const rows = await queryMany(
    'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  const total = (await queryOne('SELECT COUNT(*)::int AS t FROM payments WHERE user_id = $1', [userId])).t;
  return { data: rows.map(shape), total, page, limit };
}

async function getOne(userId, id, isAdmin) {
  const row = isAdmin
    ? await queryOne('SELECT * FROM payments WHERE id = $1', [id])
    : await queryOne('SELECT * FROM payments WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!row) throw ApiError.notFound('Payment not found');
  return shape(row);
}

module.exports = { initialize, verify, handleWebhook, listMine, getOne, shape, APPLICATION_FEE_NAIRA };
