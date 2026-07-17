'use strict';

const express = require('express');
const controller = require('./profile.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate, requireVerified } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { uploadImage } = require('../../middleware/upload.middleware');
const { ROLES } = require('../../utils/constants');
const v = require('./profile.validator');

const router = express.Router();

// All profile routes are for applicants and require a verified account.
router.use(authenticate, authorize(ROLES.APPLICANT), requireVerified);

router.get('/', controller.getProfile);
router.put('/', validate({ body: v.updateProfileSchema }), controller.updateProfile);
router.get('/completion', controller.completion);
router.post('/verify-nin', validate({ body: v.verifyNinSchema }), controller.verifyNin);
router.post('/verify-jamb', validate({ body: v.verifyJambSchema }), controller.verifyJamb);
router.post('/verify-olevel', validate({ body: v.verifyOlevelSchema }), controller.verifyOlevel);
router.post('/image', uploadImage.single('image'), controller.uploadImage);

module.exports = router;
