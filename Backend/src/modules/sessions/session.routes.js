'use strict';

const express = require('express');
const { z } = require('zod');
const service = require('./session.service');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { success, created } = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { ROLES } = require('../../utils/constants');

const router = express.Router();
router.use(authenticate, authorize(ROLES.APPLICANT));

const startSchema = z.object({ sittingType: z.enum(['one', 'two']).optional() });
const sittingSchema = z.object({ sittingType: z.enum(['one', 'two']) });

const verifySchema = z.object({
  jambRegNo: z.string().trim().min(6).max(30),
  olevel: z
    .array(
      z.object({
        examType: z.enum(['waec', 'neco', 'nabteb']),
        regNo: z.string().trim().min(4).max(40),
      })
    )
    .min(1)
    .max(2),
});

const applySchema = z.object({
  institutionId: z.string().uuid(),
  departmentId: z.string().uuid(),
  choicePosition: z.coerce.number().int().min(1).max(4).optional(),
  policyId: z.string().uuid().optional(),
});

/** Fee quote for the one/two sitting dropdown. */
router.get('/quote', asyncHandler(async (req, res) => {
  const data = await service.quote();
  return success(res, { message: 'Application fees', data });
}));

/** The applicant's latest session (used to resume where they left off). */
router.get('/current', asyncHandler(async (req, res) => {
  const data = await service.current(req.user.id);
  return success(res, { message: 'Current application session', data });
}));

/** Begin an admission attempt. Resumes any in-flight session. */
router.post('/', validate({ body: startSchema }), asyncHandler(async (req, res) => {
  const data = await service.start(req.user.id, req.body);
  return created(res, {
    message: data.resumed ? 'Resuming your existing application' : 'Application started',
    data: data.session,
  });
}));

/** Change one/two sittings before payment. */
router.patch('/:id/sitting-type', validate({ body: sittingSchema }), asyncHandler(async (req, res) => {
  const data = await service.setSittingType(req.user.id, req.params.id, req.body.sittingType);
  return success(res, { message: 'Sitting type updated', data });
}));

/** Verify JAMB + O'Level. Only permitted once the session is paid. */
/**
 * Re-check JAMB after a change of course or institution.
 *
 * Verification takes a snapshot of the candidate's JAMB choices. If they then
 * change course or institution at JAMB, this pulls the new choices through so
 * they can apply for what they actually chose. Free — the credentials were
 * already paid for — and it leaves the O'Level results alone.
 */
router.post('/:id/revalidate-jamb', asyncHandler(async (req, res) => {
  const data = await service.revalidateJamb(req.user.id, req.params.id);
  return success(res, {
    message: data.changed
      ? 'Your JAMB record has changed — your choices have been updated'
      : 'Your JAMB record is unchanged',
    data,
  });
}));

router.post('/:id/verify', validate({ body: verifySchema }), asyncHandler(async (req, res) => {
  const data = await service.verify(req.user.id, req.params.id, req.body);
  return success(res, {
    message: data.alreadyVerified ? 'Already verified' : 'Credentials verified',
    data: data.session,
  });
}));

/** The candidate's JAMB choices, each with an eligibility verdict. */
router.get('/:id/choices', asyncHandler(async (req, res) => {
  const data = await service.choices(req.user.id, req.params.id);
  return success(res, { message: 'Your JAMB choices', data });
}));

/** Complete the application against a chosen institution/department. */
router.post('/:id/apply', validate({ body: applySchema }), asyncHandler(async (req, res) => {
  const data = await service.apply(req.user.id, req.params.id, req.body);
  return created(res, { message: 'Application submitted', data });
}));

module.exports = router;
