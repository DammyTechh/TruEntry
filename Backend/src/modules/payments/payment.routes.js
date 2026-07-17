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

router.use(authenticate);
router.post('/initialize', authorize(ROLES.APPLICANT), validate({ body: initSchema }), c.initialize);
router.get('/verify/:reference', c.verify);
router.get('/mine', authorize(ROLES.APPLICANT), c.listMine);
router.get('/:id', c.getOne);

module.exports = router;
