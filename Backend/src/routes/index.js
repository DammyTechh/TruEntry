'use strict';

const express = require('express');

const router = express.Router();

// Health first (no versioned prefix dependency for probes, but also mounted here).
router.use('/health', require('../modules/health/health.routes'));

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/profile', require('../modules/profile/profile.routes'));
router.use('/institutions', require('../modules/institutions/institution.routes'));
router.use('/policies', require('../modules/policies/policy.routes'));
router.use('/applications', require('../modules/applications/application.routes'));
router.use('/sessions', require('../modules/sessions/session.routes'));
router.use('/workspace', require('../modules/institutions/workspace.routes'));
router.use('/quotas', require('../modules/quotas/quota.routes'));
router.use('/decisioning', require('../modules/decisioning/decisioning.routes'));
router.use('/payments', require('../modules/payments/payment.routes'));
router.use('/admission-letters', require('../modules/admission-letters/admissionLetter.routes'));
router.use('/reports', require('../modules/reports/report.routes'));
router.use('/jamb', require('../modules/jamb/jamb.routes'));
router.use('/chatbot', require('../modules/chatbot/chatbot.routes'));
router.use('/notifications', require('../modules/notifications/notification.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
