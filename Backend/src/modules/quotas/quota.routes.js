'use strict';

const express = require('express');
const { z } = require('zod');
const service = require('./quota.service');
const eligibility = require('./eligibility.service');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { success, created, paginated } = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES } = require('../../utils/constants');

const router = express.Router();
router.use(authenticate, authorize(ROLES.INSTITUTION, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.ADMIN));

/* ------------------------------ Schemas -------------------------------- */
const GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

const allocationSchema = z.object({
  nationalMerit: z.coerce.number().min(0).max(100),
  catchment: z.coerce.number().min(0).max(100),
  elds: z.coerce.number().min(0).max(100),
});

const requirementSchema = z.object({
  subjectGroup: z.enum(['core', 'trade', 'field']),
  minimumGrade: z.enum(GRADES),
  minCredits: z.coerce.number().int().min(0).max(9).optional(),
  maxSittings: z.coerce.number().int().min(1).max(2).optional(),
  notes: z.string().max(500).optional(),
});

const departmentAllocationSchema = z.object({
  departmentId: z.string().uuid(),
  allocated: z.coerce.number().int().min(0).optional(),
  isSelected: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sessionLabel: z.string().trim().max(40).optional(),
  totalApplicants: z.coerce.number().int().min(0).optional(),
  jambCutoff: z.coerce.number().min(0).max(400).optional(),
  applicationStart: z.string().optional(),
  applicationEnd: z.string().optional(),
  admissionRule: z.enum(['jamb_only', 'jamb_postutme_average']).optional(),
  allocation: allocationSchema.optional(),
  distributionMode: z.enum(['auto', 'manual']).optional(),
  status: z.enum(['draft', 'open']).optional(),
  olevelRequirements: z.array(requirementSchema).optional(),
  departments: z.array(departmentAllocationSchema).optional(),
  choicePositions: z.array(z.coerce.number().int().min(1).max(4)).optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['draft', 'open', 'closed', 'processing', 'finished']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'processing', 'finished']),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['draft', 'open', 'closed', 'processing', 'finished']).optional(),
});

const eligibilitySchema = z.object({
  institutionId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  applicant: z.object({
    jambScore: z.coerce.number().min(0).max(400).optional(),
    stateOfOrigin: z.string().optional(),
    choicePosition: z.coerce.number().int().min(1).max(4).optional(),
    olevelSittings: z
      .array(
        z.object({
          examType: z.string(),
          results: z.array(z.object({ subject: z.string(), grade: z.string() })),
        })
      )
      .optional(),
  }),
});

/**
 * Institution-scoped users act on their own institution; an admin must name one.
 */
function institutionId(req) {
  if (req.user.role === ROLES.ADMIN) {
    const id = req.query.institutionId || req.body.institutionId;
    if (!id) throw ApiError.badRequest('institutionId is required for admin');
    return id;
  }
  return req.user.institutionId;
}

/* ------------------------------- Routes -------------------------------- */

router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery || req.query;
    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const { items, total } = await service.list(institutionId(req), { ...q, page, limit });
    return paginated(res, { message: 'Admission cycles', data: items, total, page, limit });
  })
);

router.get(
  '/open',
  asyncHandler(async (req, res) => {
    const data = await service.openQuotaFor(institutionId(req));
    return success(res, { message: 'Open admission cycle', data });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await service.get(institutionId(req), req.params.id);
    return success(res, { message: 'Admission cycle', data });
  })
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.create(institutionId(req), req.body, req.user.id);
    await recordAudit({ req, action: 'quota.create', entity: 'admission_quota', entityId: data.id });
    return created(res, { message: 'Admission cycle created', data });
  })
);

router.put(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.update(institutionId(req), req.params.id, req.body, req.user.id);
    await recordAudit({ req, action: 'quota.update', entity: 'admission_quota', entityId: req.params.id });
    return success(res, { message: 'Admission cycle updated', data });
  })
);

router.patch(
  '/:id/status',
  validate({ body: statusSchema }),
  asyncHandler(async (req, res) => {
    const data = await service.setStatus(institutionId(req), req.params.id, req.body.status);
    await recordAudit({
      req, action: `quota.${req.body.status}`, entity: 'admission_quota', entityId: req.params.id,
    });
    return success(res, { message: `Admission cycle ${req.body.status}`, data });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await service.remove(institutionId(req), req.params.id);
    await recordAudit({ req, action: 'quota.delete', entity: 'admission_quota', entityId: req.params.id });
    return success(res, { message: 'Admission cycle deleted', data });
  })
);

/* --------------------------- Eligibility check -------------------------- */
router.post(
  '/eligibility/check',
  validate({ body: eligibilitySchema }),
  asyncHandler(async (req, res) => {
    const data = await eligibility.checkApplicant(req.body);
    return success(res, { message: data.eligible ? 'Applicant is eligible' : 'Applicant is not eligible', data });
  })
);

module.exports = router;
