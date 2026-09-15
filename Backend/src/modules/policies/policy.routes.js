'use strict';

const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { success, created, noContent } = require('../../utils/ApiResponse');
const validate = require('../../middleware/validate.middleware');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { uploadPdf } = require('../../middleware/upload.middleware');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES, POLICY_SOURCE } = require('../../utils/constants');
const service = require('./policy.service');
const ApiError = require('../../utils/ApiError');

const router = express.Router();

const createSchema = z.object({
  institutionId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  source: z.enum([POLICY_SOURCE.EDITOR, POLICY_SOURCE.PDF]).default(POLICY_SOURCE.EDITOR),
  contentHtml: z.string().optional(),
});
const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  contentHtml: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Institution-scoped users may only manage their own institution's policy.
 */
function resolveInstitution(req) {
  if ([ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION].includes(req.user.role)) return req.user.institutionId;
  return req.body.institutionId || req.query.institutionId || null;
}

// Public: fetch the active policy for an institution.
router.get(
  '/active',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const institutionId = req.query.institutionId;
    const data = await service.getActivePolicy(institutionId);
    return success(res, { message: 'Active policy', data });
  })
);

// List policies (admin sees all; institution users see their own).
router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION),
  asyncHandler(async (req, res) => {
    const institutionId =
      req.user.role === ROLES.ADMIN ? req.query.institutionId : req.user.institutionId;
    const data = await service.listPolicies({ institutionId });
    return success(res, { message: 'Policies', data });
  })
);

// Create a policy — editor (JSON) or PDF (multipart). uploadPdf tolerates no file for editor source.
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION),
  uploadPdf.single('file'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const institutionId = resolveInstitution(req);
    // Only admin may create a global policy (no institution id).
    if (!institutionId && req.user.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('Only an administrator can create a global policy');
    }
    const data = await service.createPolicy({
      institutionId,
      title: req.body.title,
      source: req.body.source,
      contentHtml: req.body.contentHtml,
      file: req.file,
      userId: req.user.id,
    });
    await recordAudit({ req, action: 'policy.created', entity: 'policy', entityId: data.id });
    return created(res, { message: 'Policy created', data });
  })
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION),
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.updatePolicy(req.params.id, req.body);
    return success(res, { message: 'Policy updated', data });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    await service.deletePolicy(req.params.id);
    return noContent(res);
  })
);

module.exports = router;
