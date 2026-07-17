'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created, paginated, noContent } = require('../../utils/ApiResponse');
const service = require('./institution.service');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../utils/constants');
const { recordAudit } = require('../../middleware/audit.middleware');

/**
 * Resolve the institution id an institution-scoped user may act on.
 * Admin/JAMB can pass any id; officers/registrars are pinned to their own.
 */
function resolveInstitutionId(req) {
  const paramId = req.params.institutionId || req.params.id;
  if ([ROLES.ADMIN, ROLES.JAMB].includes(req.user.role)) {
    return paramId; // may be undefined for list endpoints
  }
  if (paramId && String(paramId) !== String(req.user.institutionId)) {
    throw ApiError.forbidden('You can only manage your own institution', { code: 'CROSS_INSTITUTION_FORBIDDEN' });
  }
  return req.user.institutionId;
}

/* Categories */
const listCategories = asyncHandler(async (req, res) => {
  const activeOnly = !req.user || req.user.role === ROLES.APPLICANT;
  const data = await service.listCategories({ activeOnly });
  return success(res, { message: 'Categories', data });
});
const createCategory = asyncHandler(async (req, res) => {
  const data = await service.createCategory(req.body);
  await recordAudit({ req, action: 'category.created', entity: 'category', entityId: data.id });
  return created(res, { message: 'Category created', data });
});
const updateCategory = asyncHandler(async (req, res) => {
  const data = await service.updateCategory(req.params.id, req.body);
  return success(res, { message: 'Category updated', data });
});
const deleteCategory = asyncHandler(async (req, res) => {
  await service.deleteCategory(req.params.id);
  return noContent(res);
});

/* Institutions */
const listInstitutions = asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listInstitutions(req.validatedQuery || req.query);
  return paginated(res, { message: 'Institutions', data, total, page, limit });
});
const getInstitution = asyncHandler(async (req, res) => {
  const data = await service.getInstitution(req.params.id);
  return success(res, { message: 'Institution', data });
});
const createInstitution = asyncHandler(async (req, res) => {
  const data = await service.createInstitution(req.body);
  await recordAudit({ req, action: 'institution.created', entity: 'institution', entityId: data.id });
  return created(res, { message: 'Institution created', data });
});
const updateInstitution = asyncHandler(async (req, res) => {
  const id = resolveInstitutionId(req);
  const data = await service.updateInstitution(id, req.body);
  await recordAudit({ req, action: 'institution.updated', entity: 'institution', entityId: id });
  return success(res, { message: 'Institution updated', data });
});
const deleteInstitution = asyncHandler(async (req, res) => {
  await service.deleteInstitution(req.params.id);
  await recordAudit({ req, action: 'institution.deleted', entity: 'institution', entityId: req.params.id });
  return noContent(res);
});
const uploadAsset = asyncHandler(async (req, res) => {
  const id = resolveInstitutionId(req);
  const data = await service.uploadAsset(id, req.params.kind, req.file);
  return success(res, { message: 'Asset uploaded', data });
});

/* Parameters */
const getParameters = asyncHandler(async (req, res) => {
  const id = resolveInstitutionId(req);
  if (!id) throw ApiError.badRequest('Institution id required');
  const data = await service.getParameters(id);
  return success(res, { message: 'Admission parameters', data });
});
const updateParameters = asyncHandler(async (req, res) => {
  const id = resolveInstitutionId(req);
  if (!id) throw ApiError.badRequest('Institution id required');
  const data = await service.updateParameters(id, req.body);
  await recordAudit({ req, action: 'institution.parameters_updated', entity: 'institution', entityId: id });
  return success(res, { message: 'Parameters updated', data });
});

/* Departments */
const listDepartments = asyncHandler(async (req, res) => {
  const data = await service.listDepartments(req.params.institutionId || req.params.id);
  return success(res, { message: 'Departments', data });
});
const getDepartment = asyncHandler(async (req, res) => {
  const data = await service.getDepartment(req.params.id);
  return success(res, { message: 'Department', data });
});
const createDepartment = asyncHandler(async (req, res) => {
  const id = resolveInstitutionId(req);
  const data = await service.createDepartment(id, req.body);
  await recordAudit({ req, action: 'department.created', entity: 'department', entityId: data.id });
  return created(res, { message: 'Department created', data });
});
const updateDepartment = asyncHandler(async (req, res) => {
  const data = await service.updateDepartment(req.params.id, req.body);
  return success(res, { message: 'Department updated', data });
});
const deleteDepartment = asyncHandler(async (req, res) => {
  await service.deleteDepartment(req.params.id);
  return noContent(res);
});

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listInstitutions, getInstitution, createInstitution, updateInstitution, deleteInstitution, uploadAsset,
  getParameters, updateParameters,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
};
