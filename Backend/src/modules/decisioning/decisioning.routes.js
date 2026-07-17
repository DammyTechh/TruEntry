'use strict';

const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/ApiResponse');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES } = require('../../utils/constants');
const service = require('./decisioning.service');
const ApiError = require('../../utils/ApiError');

const router = express.Router();
router.use(authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.ADMIN));

const bodySchema = z.object({
  institutionId: z.string().uuid().optional(),
  departmentId: z.string().uuid(),
});

/**
 * Institution-scoped users decide only for their own institution.
 */
function institutionId(req) {
  if (req.user.role === ROLES.ADMIN) {
    const id = req.body.institutionId || req.query.institutionId;
    if (!id) throw ApiError.badRequest('institutionId is required for admin');
    return id;
  }
  return req.user.institutionId;
}

router.post(
  '/preview',
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const data = await service.preview(institutionId(req), req.body.departmentId);
    return success(res, { message: 'Decision preview', data });
  })
);

router.post(
  '/run',
  authorize(ROLES.OFFICER, ROLES.ADMIN),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const instId = institutionId(req);
    const data = await service.run(instId, req.body.departmentId, req.user.id);
    await recordAudit({
      req, action: 'decisioning.run', entity: 'department', entityId: req.body.departmentId,
      metadata: { selected: data.selectedCount, ineligible: data.ineligibleCount },
    });
    return success(res, { message: 'Decision run committed', data });
  })
);

module.exports = router;
