'use strict';

const express = require('express');
const c = require('./application.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate, requireVerified } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../utils/constants');
const v = require('./application.validator');

const router = express.Router();
router.use(authenticate);

/* ------------------------------ Applicant ------------------------------ */
router.post('/', authorize(ROLES.APPLICANT), requireVerified, validate({ body: v.createApplicationSchema }), c.create);
router.get('/mine', authorize(ROLES.APPLICANT), validate({ query: v.listQuerySchema }), c.listMine);
router.get('/mine/:id', authorize(ROLES.APPLICANT), c.getMine);
router.get('/mine/:id/status', authorize(ROLES.APPLICANT), c.status);
router.post('/mine/:id/post-utme', authorize(ROLES.APPLICANT), validate({ body: v.postUtmeSubmitSchema }), c.submitPostUtme);

/* ----------------------------- Institution ----------------------------- */
router.get('/institution', authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.ADMIN, ROLES.JAMB), validate({ query: v.listQuerySchema }), c.listInstitution);
router.get('/institution/:id', authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.ADMIN, ROLES.JAMB), c.getInstitution);

// Officer actions
router.post('/institution/:id/consider-post-utme', authorize(ROLES.OFFICER, ROLES.ADMIN), validate({ body: v.considerSchema }), c.considerPostUtme);
router.post('/institution/:id/post-utme-score', authorize(ROLES.OFFICER, ROLES.ADMIN), validate({ body: v.officerPostUtmeScoreSchema }), c.recordPostUtmeScore);
router.post('/institution/:id/recommend', authorize(ROLES.OFFICER, ROLES.ADMIN), validate({ body: v.decisionSchema }), c.recommend);

// Registrar actions
router.post('/institution/:id/approve', authorize(ROLES.REGISTRAR, ROLES.ADMIN), validate({ body: v.decisionSchema }), c.approve);
router.post('/institution/:id/reject', authorize(ROLES.REGISTRAR, ROLES.ADMIN), validate({ body: v.decisionSchema }), c.reject);
router.post('/institution/:id/forward-jamb', authorize(ROLES.REGISTRAR, ROLES.ADMIN), validate({ body: v.decisionSchema }), c.forwardToJamb);

module.exports = router;
