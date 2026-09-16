'use strict';

const express = require('express');
const { z } = require('zod');
const c = require('./payment.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../utils/constants');

const router = express.Router();

const initSchema = z.object({ applicationId: z.string().uuid() });

/* ---------------------------- Paystack webhook ---------------------------
 * Mounted BEFORE authenticate: Paystack cannot present a JWT. The request is
 * authenticated instead by its HMAC-SHA512 signature over the RAW body, so
 * express.raw is used here rather than the global JSON parser.
 *
 * This is what makes payment capture reliable: if the applicant closes the
 * browser before being redirected back, the webhook still settles the payment.
 * ------------------------------------------------------------------------ */
router.post('/webhook', express.raw({ type: '*/*' }), c.webhook);

router.use(authenticate);
router.post('/initialize', authorize(ROLES.APPLICANT), validate({ body: initSchema }), c.initialize);
// Pay the exam-processing fee for an application session (unlocks verification).
router.post(
  '/session/initialize',
  authorize(ROLES.APPLICANT),
  validate({ body: z.object({ sessionId: z.string().uuid() }) }),
  c.initializeSession
);
router.get('/verify/:reference', c.verify);
router.get('/mine', authorize(ROLES.APPLICANT), c.listMine);
router.get('/:id', c.getOne);

module.exports = router;
