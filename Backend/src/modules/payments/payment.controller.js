'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created, paginated } = require('../../utils/ApiResponse');
const service = require('./payment.service');
const paystack = require('../../services/payment.service');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/constants');
const logger = require('../../config/logger');
const { recordAudit } = require('../../middleware/audit.middleware');

const initialize = asyncHandler(async (req, res) => {
  const data = await service.initialize(req.user.id, req.body.applicationId);
  await recordAudit({ req, action: 'payment.initialized', entity: 'application', entityId: req.body.applicationId });
  return created(res, { message: 'Payment initialized', data });
});

const verify = asyncHandler(async (req, res) => {
  const data = await service.verify(req.params.reference);
  return success(res, { message: 'Payment verified', data });
});

const listMine = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listMine(req.user.id, req.validatedQuery || req.query);
  return paginated(res, { message: 'My payments', data, total, page, limit });
});

const getOne = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === ROLES.ADMIN;
  const data = await service.getOne(req.user.id, req.params.id, isAdmin);
  return success(res, { message: 'Payment', data });
});

/**
 * Paystack webhook. Requires the raw body (mounted with express.raw) so the
 * HMAC signature can be verified. Always returns 200 quickly per Paystack spec.
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw on this route
  if (!paystack.verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Rejected Paystack webhook with invalid signature');
    throw ApiError.unauthorized('Invalid webhook signature');
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Invalid webhook payload');
  }
  // Process asynchronously but respond fast.
  service.handleWebhook(event).catch((err) =>
    logger.error('Webhook processing failed', { error: err.message })
  );
  return res.status(200).json({ received: true });
});

const initializeSession = asyncHandler(async (req, res) => {
  const data = await service.initializeSession(req.user.id, req.body.sessionId);
  return success(res, { message: 'Payment initialized', data });
});

module.exports = { initialize, initializeSession, verify, listMine, getOne, webhook };
