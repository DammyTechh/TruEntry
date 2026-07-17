'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created, paginated } = require('../../utils/ApiResponse');
const service = require('./application.service');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/constants');
const { recordAudit } = require('../../middleware/audit.middleware');

/**
 * Institution id the acting user operates on (own institution unless admin/jamb).
 */
function institutionScope(req) {
  if ([ROLES.ADMIN, ROLES.JAMB].includes(req.user.role)) {
    return req.query.institutionId || req.params.institutionId;
  }
  return req.user.institutionId;
}

/* ----------------------------- Applicant ------------------------------- */

const create = asyncHandler(async (req, res) => {
  const data = await service.createApplication(req.user.id, req.body);
  await recordAudit({ req, action: 'application.created', entity: 'application', entityId: data.id });
  return created(res, {
    message: 'Application created. Proceed to payment to submit.',
    data,
  });
});

const listMine = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listMyApplications(req.user.id, req.validatedQuery || req.query);
  return paginated(res, { message: 'My applications', data, total, page, limit });
});

const getMine = asyncHandler(async (req, res) => {
  const data = await service.getMyApplication(req.user.id, req.params.id);
  return success(res, { message: 'Application', data });
});

const status = asyncHandler(async (req, res) => {
  const data = await service.getStatus(req.user.id, req.params.id);
  return success(res, { message: 'Application status', data });
});

const submitPostUtme = asyncHandler(async (req, res) => {
  const data = await service.submitPostUtme(req.user.id, req.params.id, req.body);
  return success(res, { message: 'Post-UTME details submitted', data });
});

/* ----------------------------- Institution ----------------------------- */

const listInstitution = asyncHandler(async (req, res) => {
  const institutionId = institutionScope(req);
  if (!institutionId) throw ApiError.badRequest('Institution context required');
  const { data, total, page, limit } = await service.listInstitutionApplications(
    req, institutionId, req.validatedQuery || req.query
  );
  return paginated(res, { message: 'Institution applications', data, total, page, limit });
});

const getInstitution = asyncHandler(async (req, res) => {
  const data = await service.getInstitutionApplication(req, req.params.id);
  return success(res, { message: 'Application', data });
});

const considerPostUtme = asyncHandler(async (req, res) => {
  const qualified = req.body.qualified !== false;
  const data = await service.considerPostUtme(req, req.params.id, qualified, req.body.note);
  await recordAudit({ req, action: 'application.considered_post_utme', entity: 'application', entityId: req.params.id, metadata: { qualified } });
  return success(res, { message: qualified ? 'Marked qualified for Post-UTME' : 'Marked not qualified', data });
});

const recordPostUtmeScore = asyncHandler(async (req, res) => {
  const data = await service.recordPostUtmeScore(req, req.params.id, req.body);
  await recordAudit({ req, action: 'application.post_utme_scored', entity: 'application', entityId: req.params.id });
  return success(res, { message: 'Post-UTME score recorded', data });
});

const recommend = asyncHandler(async (req, res) => {
  const data = await service.recommend(req, req.params.id, req.body.note);
  await recordAudit({ req, action: 'application.recommended', entity: 'application', entityId: req.params.id });
  return success(res, { message: 'Application recommended for approval', data });
});

const approve = asyncHandler(async (req, res) => {
  const data = await service.approve(req, req.params.id, req.body.note);
  await recordAudit({ req, action: 'application.approved', entity: 'application', entityId: req.params.id });
  return success(res, { message: 'Application approved', data });
});

const reject = asyncHandler(async (req, res) => {
  const data = await service.reject(req, req.params.id, req.body.note);
  await recordAudit({ req, action: 'application.rejected', entity: 'application', entityId: req.params.id });
  return success(res, { message: 'Application rejected', data });
});

const forwardToJamb = asyncHandler(async (req, res) => {
  const data = await service.forwardToJamb(req, req.params.id, req.body.note);
  await recordAudit({ req, action: 'application.forwarded_jamb', entity: 'application', entityId: req.params.id });
  return success(res, { message: 'Application forwarded to JAMB', data });
});

module.exports = {
  create,
  listMine,
  getMine,
  status,
  submitPostUtme,
  listInstitution,
  getInstitution,
  considerPostUtme,
  recordPostUtmeScore,
  recommend,
  approve,
  reject,
  forwardToJamb,
};
