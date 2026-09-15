'use strict';

const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { success, created, paginated } = require('../../utils/ApiResponse');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES, REPORT_TYPES } = require('../../utils/constants');
const service = require('./report.service');
const ApiError = require('../../utils/ApiError');

const router = express.Router();
router.use(authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.JAMB, ROLES.ADMIN, ROLES.INSTITUTION));

const generateSchema = z.object({
  institutionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  type: z.enum([REPORT_TYPES.AUDIT_READY, REPORT_TYPES.ADMITTED_LIST, REPORT_TYPES.APPLICANTS_LIST]).optional(),
});

/**
 * Institution-scoped users are pinned to their own institution; JAMB/admin
 * must specify the institution to report on.
 */
function resolveInstitution(req) {
  if ([ROLES.OFFICER, ROLES.REGISTRAR].includes(req.user.role)) return req.user.institutionId;
  const id = req.body.institutionId || req.query.institutionId;
  if (!id) throw ApiError.badRequest('institutionId is required');
  return id;
}

router.post(
  '/generate',
  validate({ body: generateSchema }),
  asyncHandler(async (req, res) => {
    const institutionId = resolveInstitution(req);
    const type = req.body.type || REPORT_TYPES.AUDIT_READY;
    const { report, buffer } = await service.generate({
      institutionId,
      departmentId: req.body.departmentId,
      type,
      actor: req.user,
    });
    await recordAudit({ req, action: 'report.generated', entity: 'report', entityId: report.id });
    if (buffer && !report.pdfUrl) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.reference}.pdf"`);
      return res.send(buffer);
    }
    return created(res, { message: 'Report generated', data: report });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const institutionId =
      [ROLES.OFFICER, ROLES.REGISTRAR].includes(req.user.role)
        ? req.user.institutionId
        : req.query.institutionId;
    const { data, total, page, limit } = await service.list({ institutionId }, req.query);
    return paginated(res, { message: 'Reports', data, total, page, limit });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await service.getOne(req.params.id);
    if ([ROLES.OFFICER, ROLES.REGISTRAR].includes(req.user.role) &&
        String(data.institutionId) !== String(req.user.institutionId)) {
      throw ApiError.forbidden('This report belongs to another institution');
    }
    return success(res, { message: 'Report', data });
  })
);

module.exports = router;
