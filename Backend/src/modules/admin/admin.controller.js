'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created, paginated } = require('../../utils/ApiResponse');
const service = require('./admin.service');
const { recordAudit } = require('../../middleware/audit.middleware');

const dashboard = asyncHandler(async (req, res) => {
  const data = await service.dashboard();
  return success(res, { message: 'Admin dashboard', data });
});

const institutionStatus = asyncHandler(async (req, res) => {
  const data = await service.institutionStatus();
  return success(res, { message: 'Institution status overview', data });
});

const listUsers = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listUsers(req.validatedQuery || req.query);
  return paginated(res, { message: 'Users', data, total, page, limit });
});

const getUser = asyncHandler(async (req, res) => {
  const data = await service.getUser(req.params.id);
  return success(res, { message: 'User', data });
});

const createStaff = asyncHandler(async (req, res) => {
  const data = await service.createStaff(req.body, req.user);
  await recordAudit({ req, action: 'admin.staff_created', entity: 'user', entityId: data.user.id, metadata: { role: req.body.role } });
  return created(res, { message: 'Staff user created', data });
});

const createApplicant = asyncHandler(async (req, res) => {
  const data = await service.createApplicant(req.body, req.user);
  await recordAudit({ req, action: 'admin.applicant_created', entity: 'user', entityId: data.user.id });
  return created(res, { message: 'Applicant created', data });
});

const updateUser = asyncHandler(async (req, res) => {
  const data = await service.updateUser(req.params.id, req.body);
  await recordAudit({ req, action: 'admin.user_updated', entity: 'user', entityId: req.params.id });
  return success(res, { message: 'User updated', data });
});

const setActive = asyncHandler(async (req, res) => {
  const data = await service.setActive(req.params.id, req.body.isActive);
  await recordAudit({ req, action: 'admin.user_active_toggled', entity: 'user', entityId: req.params.id, metadata: { isActive: req.body.isActive } });
  return success(res, { message: req.body.isActive ? 'User activated' : 'User deactivated', data });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const data = await service.resetUserPassword(req.params.id);
  await recordAudit({ req, action: 'admin.user_password_reset', entity: 'user', entityId: req.params.id });
  return success(res, { message: 'Password reset; new credentials emailed', data });
});

const finances = asyncHandler(async (req, res) => {
  const { data, total, page, limit, revenueNaira } = await service.finances(req.validatedQuery || req.query);
  return success(res, {
    message: 'Finances',
    data,
    meta: { pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }, revenueNaira },
  });
});

const auditLogs = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.auditLogs(req.validatedQuery || req.query);
  return paginated(res, { message: 'Audit logs', data, total, page, limit });
});

const listMock = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listMock(req.params.kind, req.query);
  return paginated(res, { message: `Mock ${req.params.kind} records`, data, total, page, limit });
});

const createMock = asyncHandler(async (req, res) => {
  const data = await service.createMock(req.params.kind, req.body);
  return created(res, { message: `Mock ${req.params.kind} record created`, data });
});

/* ------------------- Institution onboarding & fee settings ------------------- */
const onboarding = require('../institutions/onboarding.service');
const feeSettings = require('./feeSettings.service');

const onboardInstitution = asyncHandler(async (req, res) => {
  const data = await onboarding.onboardInstitution(req.body, req.user.id);
  return created(res, {
    message: data.credentialsEmailed
      ? 'Institution onboarded. Credentials have been emailed.'
      : 'Institution onboarded, but the credentials email could not be sent. Use resend.',
    data,
  });
});

const listOnboardedInstitutions = asyncHandler(async (req, res) => {
  const q = req.validatedQuery || req.query;
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 20;
  const { items, total } = await onboarding.listOnboarded({ ...q, page, limit });
  return paginated(res, { message: 'Institutions', data: items, total, page, limit });
});

const resendInstitutionCredentials = asyncHandler(async (req, res) => {
  const data = await onboarding.resendCredentials(req.params.id);
  return success(res, { message: 'Credentials re-issued and emailed', data });
});

const listFeeSettings = asyncHandler(async (req, res) => {
  const data = await feeSettings.list();
  return success(res, { message: 'Fee settings', data });
});

const updateFeeSettings = asyncHandler(async (req, res) => {
  const data = await feeSettings.update(req.params.type, req.body, req.user.id);
  return success(res, { message: 'Fee settings updated', data });
});

module.exports = {
  dashboard,
  institutionStatus,
  listUsers,
  getUser,
  createStaff,
  createApplicant,
  updateUser,
  setActive,
  resetUserPassword,
  finances,
  auditLogs,
  listMock,
  createMock,
  onboardInstitution,
  listOnboardedInstitutions,
  resendInstitutionCredentials,
  listFeeSettings,
  updateFeeSettings,
};
