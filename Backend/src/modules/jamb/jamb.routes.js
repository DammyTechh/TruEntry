'use strict';

const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/ApiResponse');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES } = require('../../utils/constants');
const service = require('./jamb.service');

const router = express.Router();
router.use(authenticate, authorize(ROLES.JAMB, ROLES.ADMIN));

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  institutionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.string().optional(),
  state: z.string().optional(),
  minJamb: z.coerce.number().optional(),
  maxJamb: z.coerce.number().optional(),
  minPostUtme: z.coerce.number().optional(),
  minAge: z.coerce.number().optional(),
  maxAge: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
});

const decideSchema = z.object({
  admit: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

const contactSchema = z.object({
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(4000),
});

router.get('/stats', asyncHandler(async (req, res) => {
  const data = await service.stats(req.query);
  return success(res, { message: 'JAMB statistics', data });
}));

router.get('/applicants', validate({ query: listQuerySchema }), asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listApplicants(req.validatedQuery || req.query);
  return paginated(res, { message: 'Applicants', data, total, page, limit });
}));

router.get('/forwarded', validate({ query: listQuerySchema }), asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listForwarded(req.validatedQuery || req.query);
  return paginated(res, { message: 'Applications forwarded to JAMB', data, total, page, limit });
}));

router.get('/admitted', validate({ query: listQuerySchema }), asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listAdmitted(req.validatedQuery || req.query);
  return paginated(res, { message: 'Admitted applicants', data, total, page, limit });
}));

router.get('/applicants/:id', asyncHandler(async (req, res) => {
  const data = await service.getApplicant(req.params.id);
  return success(res, { message: 'Applicant', data });
}));

router.post('/applicants/:id/decide', validate({ body: decideSchema }), asyncHandler(async (req, res) => {
  const data = await service.decide(req.params.id, req.body.admit, req.body.note, req.user.id);
  await recordAudit({ req, action: 'jamb.decision', entity: 'application', entityId: req.params.id, metadata: { admit: req.body.admit } });
  return success(res, { message: req.body.admit ? 'Applicant admitted' : 'Applicant not admitted', data });
}));

router.post('/institutions/:institutionId/contact', validate({ body: contactSchema }), asyncHandler(async (req, res) => {
  const data = await service.contactInstitution(req.params.institutionId, req.body, req.user);
  return success(res, { message: 'Message sent to institution', data });
}));

module.exports = router;
