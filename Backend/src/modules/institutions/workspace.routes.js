'use strict';

/**
 * Institution workspace: faculties, departments and the organisation profile.
 * All routes are scoped to the caller's own institution.
 */

const express = require('express');
const { z } = require('zod');
const service = require('./faculty.service');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { success, created } = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { recordAudit } = require('../../middleware/audit.middleware');
const { ROLES } = require('../../utils/constants');

const router = express.Router();
router.use(authenticate, authorize(ROLES.INSTITUTION, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.ADMIN));

function institutionId(req) {
  if (req.user.role === ROLES.ADMIN) {
    const id = req.query.institutionId || req.body.institutionId;
    if (!id) throw ApiError.badRequest('institutionId is required for admin');
    return id;
  }
  return req.user.institutionId;
}

/* ------------------------------ Schemas -------------------------------- */
const facultySchema = z.object({
  name: z.string().trim().min(2).max(120),
});
const facultyUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});
const departmentSchema = z.object({
  name: z.string().trim().min(2).max(140),
  code: z.string().trim().max(20).optional(),
  facultyId: z.string().uuid().optional(),
  admissionQuota: z.coerce.number().int().min(0).optional(),
  jambCutoff: z.coerce.number().min(0).max(400).optional(),
  postUtmeCutoff: z.coerce.number().min(0).max(400).optional(),
  aggregateCutoff: z.coerce.number().min(0).max(100).optional(),
});
const departmentUpdateSchema = departmentSchema.partial().extend({
  facultyId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

/* ------------------------------ Faculties ------------------------------- */
router.get('/faculties', asyncHandler(async (req, res) => {
  const data = await service.listFaculties(institutionId(req));
  return success(res, { message: 'Faculties', data });
}));

router.post('/faculties', validate({ body: facultySchema }), asyncHandler(async (req, res) => {
  const data = await service.createFaculty(institutionId(req), req.body);
  await recordAudit({ req, action: 'faculty.create', entity: 'faculty', entityId: data.id });
  return created(res, { message: 'Faculty created', data });
}));

router.put('/faculties/:id', validate({ body: facultyUpdateSchema }), asyncHandler(async (req, res) => {
  const data = await service.updateFaculty(institutionId(req), req.params.id, req.body);
  return success(res, { message: 'Faculty updated', data });
}));

router.delete('/faculties/:id', asyncHandler(async (req, res) => {
  const data = await service.deleteFaculty(institutionId(req), req.params.id);
  await recordAudit({ req, action: 'faculty.delete', entity: 'faculty', entityId: req.params.id });
  return success(res, { message: 'Faculty deleted', data });
}));

/* ----------------------------- Departments ------------------------------ */
router.get('/departments', asyncHandler(async (req, res) => {
  const data = await service.listDepartments(institutionId(req), { facultyId: req.query.facultyId });
  return success(res, { message: 'Departments', data });
}));

router.post('/departments', validate({ body: departmentSchema }), asyncHandler(async (req, res) => {
  const data = await service.createDepartment(institutionId(req), req.body);
  await recordAudit({ req, action: 'department.create', entity: 'department', entityId: data.id });
  return created(res, { message: 'Department created', data });
}));

router.put('/departments/:id', validate({ body: departmentUpdateSchema }), asyncHandler(async (req, res) => {
  const data = await service.updateDepartment(institutionId(req), req.params.id, req.body);
  await recordAudit({ req, action: 'department.update', entity: 'department', entityId: req.params.id });
  return success(res, { message: 'Department updated', data });
}));

router.delete('/departments/:id', asyncHandler(async (req, res) => {
  const data = await service.deleteDepartment(institutionId(req), req.params.id);
  await recordAudit({ req, action: 'department.delete', entity: 'department', entityId: req.params.id });
  return success(res, { message: 'Department deleted', data });
}));

module.exports = router;
