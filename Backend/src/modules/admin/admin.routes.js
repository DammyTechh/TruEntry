'use strict';

const express = require('express');
const { z } = require('zod');
const c = require('./admin.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../utils/constants');

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN));

/* ------------------------------ Schemas -------------------------------- */
const createStaffSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  role: z.enum([ROLES.OFFICER, ROLES.REGISTRAR, ROLES.JAMB, ROLES.ADMIN]),
  institutionId: z.string().uuid().optional(),
  password: z.string().min(8).max(72).optional(),
});
const createApplicantSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8).max(72).optional(),
});
const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  institutionId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
const setActiveSchema = z.object({ isActive: z.boolean() });
const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: z.string().optional(),
  institutionId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});
const mockJambSchema = z.object({
  regNo: z.string().trim().min(6).max(30),
  fullName: z.string().trim().min(2),
  jambScore: z.coerce.number().min(0).max(400),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  stateOfOrigin: z.string().optional(),
  subjects: z.array(z.object({ subject: z.string(), score: z.coerce.number() })).optional(),
  examYear: z.coerce.number().optional(),
});
const mockOlevelSchema = z.object({
  examType: z.enum(['waec', 'neco', 'nabteb']),
  regNo: z.string().trim().min(6).max(30),
  fullName: z.string().trim().min(2),
  results: z.array(z.object({ subject: z.string(), grade: z.string() })),
  examYear: z.coerce.number().optional(),
});
const mockNinSchema = z.object({
  nin: z.string().trim().regex(/^\d{11}$/),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  stateOfOrigin: z.string().optional(),
  phone: z.string().optional(),
});

function mockSchemaFor(kind) {
  return { jamb: mockJambSchema, olevel: mockOlevelSchema, nin: mockNinSchema }[kind];
}


/* ------------------ Institution onboarding & fee schemas ------------------ */
const onboardInstitutionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(20),
  email: z.string().email(),
  phone: z.string().trim().max(20).optional(),
  state: z.string().trim().max(60).optional(),
  region: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  address: z.string().trim().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  logoUrl: z.string().url().max(500).optional(),
  hasPostUtme: z.boolean().optional(),
});
const listInstitutionsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  type: z.enum(['university', 'polytechnic', 'college_of_education']).optional(),
});
const updateFeeSchema = z.object({
  applicationFeeNaira: z.coerce.number().min(0).max(1000000).optional(),
  secondSittingFeeNaira: z.coerce.number().min(0).max(1000000).optional(),
  isActive: z.boolean().optional(),
});

/* ----------------------------- Dashboard ------------------------------- */
router.get('/dashboard', c.dashboard);
router.get('/institution-status', c.institutionStatus);


/* ------------------------ Institution onboarding ----------------------- */
// Admin registers a school, the system creates its single login and emails
// the generated credentials (password must be changed on first sign-in).
router.post('/institutions', validate({ body: onboardInstitutionSchema }), c.onboardInstitution);
router.get('/institutions', validate({ query: listInstitutionsQuery }), c.listOnboardedInstitutions);
router.post('/institutions/:id/resend-credentials', c.resendInstitutionCredentials);

/* ---------------------------- Fee settings ----------------------------- */
// Application fee per institution type + second-sitting O'Level surcharge.
router.get('/fee-settings', c.listFeeSettings);
router.patch('/fee-settings/:type', validate({ body: updateFeeSchema }), c.updateFeeSettings);

/* ------------------------------- Users --------------------------------- */
router.get('/users', validate({ query: listUsersQuery }), c.listUsers);
router.get('/users/:id', c.getUser);
router.post('/users/staff', validate({ body: createStaffSchema }), c.createStaff);
router.post('/users/applicant', validate({ body: createApplicantSchema }), c.createApplicant);
router.put('/users/:id', validate({ body: updateUserSchema }), c.updateUser);
router.patch('/users/:id/active', validate({ body: setActiveSchema }), c.setActive);
router.post('/users/:id/reset-password', c.resetUserPassword);

/* ----------------------------- Finances -------------------------------- */
router.get('/finances', c.finances);

/* ---------------------------- Audit logs ------------------------------- */
router.get('/audit-logs', c.auditLogs);

/* --------------------------- Mock data mgmt ---------------------------- */
router.get('/mock/:kind', c.listMock);
router.post(
  '/mock/:kind',
  (req, res, next) => {
    const schema = mockSchemaFor(req.params.kind);
    if (!schema) return next();
    return validate({ body: schema })(req, res, next);
  },
  c.createMock
);

module.exports = router;
