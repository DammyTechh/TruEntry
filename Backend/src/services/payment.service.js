'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const client = axios.create({
  baseURL: config.paystack.baseUrl,
  headers: {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

/**
 * Initialize a Paystack transaction.
 * @param {object} opts
 * @param {string} opts.email
 * @param {number} opts.amountKobo - amount already in kobo
 * @param {string} opts.reference
 * @param {object} [opts.metadata]
 * @returns {Promise<{authorizationUrl, accessCode, reference}>}
 */
async function initializeTransaction({ email, amountKobo, reference, metadata }) {
  if (!config.paystack.secretKey) {
    throw ApiError.serviceUnavailable('Payment gateway not configured', { code: 'PAYSTACK_NOT_CONFIGURED' });
  }
  try {
    const { data } = await client.post('/transaction/initialize', {
      email,
      amount: amountKobo,
      reference,
      currency: 'NGN',
      callback_url: config.paystack.callbackUrl,
      metadata,
    });
    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  } catch (err) {
    logger.error('Paystack init failed', { error: err.response?.data || err.message });
    throw ApiError.badGateway('Could not initialize payment', { code: 'PAYSTACK_INIT_FAILED' });
  }
}

/**
 * Verify a transaction by reference.
 * @returns {Promise<{status, gatewayResponse, channel, paidAt, amountKobo, raw}>}
 */
async function verifyTransaction(reference) {
  if (!config.paystack.secretKey) {
    throw ApiError.serviceUnavailable('Payment gateway not configured', { code: 'PAYSTACK_NOT_CONFIGURED' });
  }
  try {
    const { data } = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    const tx = data.data;
    return {
      status: tx.status, // 'success' | 'failed' | 'abandoned'
      gatewayResponse: tx.gateway_response,
      channel: tx.channel,
      paidAt: tx.paid_at,
      amountKobo: tx.amount,
      raw: tx,
    };
  } catch (err) {
    logger.error('Paystack verify failed', { reference, error: err.response?.data || err.message });
    throw ApiError.badGateway('Could not verify payment', { code: 'PAYSTACK_VERIFY_FAILED' });
  }
}

/**
 * Validate a Paystack webhook signature (x-paystack-signature = HMAC SHA512 of body).
 * @param {Buffer|string} rawBody - the raw request body
 * @param {string} signature
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!config.paystack.secretKey || !signature) return false;
  const hash = crypto
    .createHmac('sha512', config.paystack.secretKey)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

const nairaToKobo = (naira) => Math.round(Number(naira) * 100);
const koboToNaira = (kobo) => Number(kobo) / 100;

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  nairaToKobo,
  koboToNaira,
};
