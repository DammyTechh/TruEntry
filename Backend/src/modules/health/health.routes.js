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
        integrations: {
          paystack: !!config.paystack.secretKey,
          resend: !!config.mail.resendApiKey,
          dojah: config.dojah.mock ? 'mock' : !!config.dojah.secretKey,
          openai: config.openai.mock ? 'mock' : !!config.openai.apiKey,
          jamb: config.regulators.jambMode,
          waec: config.regulators.waecMode,
        },
        timestamp: new Date().toISOString(),
      },
    });
  })
);

module.exports = router;
