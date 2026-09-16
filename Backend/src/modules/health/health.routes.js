'use strict';

const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/ApiResponse');
const db = require('../../config/database');
const config = require('../../config');

const router = express.Router();
const startedAt = Date.now();

/**
 * Liveness + dependency health. Reports DB connectivity and configured integrations.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const database = await db.healthCheck().catch(() => ({ ok: false }));
    return success(res, {
      message: 'TruEntry API is healthy',
      data: {
        status: database.ok ? 'ok' : 'degraded',
        service: config.appName,
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        database,
        // Explicit live/mock reporting so a misconfigured key is obvious
        // rather than silently falling back to demo data.
        integrations: {
          paystack: !config.paystack.secretKey
            ? 'not-configured'
            : config.paystack.isLive
              ? 'live'
              : 'test',
          paystackCallbackUrl: config.paystack.callbackUrl,
          resend: config.mail.resendApiKey ? 'configured' : 'not-configured',
          nin: config.dojah.mock
            ? 'mock'
            : config.dojah.secretKey && config.dojah.appId
              ? 'live (dojah)'
              : 'not-configured',
          openai: config.openai.mock ? 'mock' : config.openai.apiKey ? 'live' : 'not-configured',
          jamb: config.regulators.jambMode,
          waec: config.regulators.waecMode,
        },
        timestamp: new Date().toISOString(),
      },
    });
  })
);

module.exports = router;
