'use strict';

const express = require('express');
const c = require('./institution.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/rbac.middleware');
const { uploadAsset } = require('../../middleware/upload.middleware');
const { ROLES } = require('../../utils/constants');
const v = require('./institution.validator');

const router = express.Router();

/* ---------------------------- Categories ------------------------------- */
router.get('/categories', optionalAuth, c.listCategories);
router.post('/categories', authenticate, authorize(ROLES.ADMIN), validate({ body: v.categorySchema }), c.createCategory);
router.put('/categories/:id', authenticate, authorize(ROLES.ADMIN), validate({ body: v.updateCategorySchema }), c.updateCategory);
router.delete('/categories/:id', authenticate, authorize(ROLES.ADMIN), c.deleteCategory);

/* ------------- Institution-scoped self routes (officer/registrar) ------ */
// "me" resolves to the caller's own institution.
router.get('/me/parameters', authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), c.getParameters);
router.put('/me/parameters', authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), validate({ body: v.parametersSchema }), c.updateParameters);
router.post('/me/departments', authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), validate({ body: v.departmentSchema }), c.createDepartment);
router.put('/me/update', authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), validate({ body: v.updateInstitutionSchema }), c.updateInstitution);
router.post('/me/assets/:kind', authenticate, authorize(ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), uploadAsset.single('file'), c.uploadAsset);

/* ---------------------------- Public list ------------------------------ */
router.get('/', optionalAuth, validate({ query: v.listQuerySchema }), c.listInstitutions);
router.get('/:id', optionalAuth, c.getInstitution);
router.get('/:institutionId/departments', optionalAuth, c.listDepartments);

/* -------------------------- Admin management --------------------------- */
router.post('/', authenticate, authorize(ROLES.ADMIN), validate({ body: v.createInstitutionSchema }), c.createInstitution);
router.put('/:id', authenticate, authorize(ROLES.ADMIN), validate({ body: v.updateInstitutionSchema }), c.updateInstitution);
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), c.deleteInstitution);
router.post('/:id/assets/:kind', authenticate, authorize(ROLES.ADMIN), uploadAsset.single('file'), c.uploadAsset);

router.get('/:institutionId/parameters', authenticate, authorize(ROLES.ADMIN, ROLES.JAMB), c.getParameters);
router.put('/:institutionId/parameters', authenticate, authorize(ROLES.ADMIN), validate({ body: v.parametersSchema }), c.updateParameters);

router.post('/:institutionId/departments', authenticate, authorize(ROLES.ADMIN), validate({ body: v.departmentSchema }), c.createDepartment);
router.get('/departments/:id', optionalAuth, c.getDepartment);
router.put('/departments/:id', authenticate, authorize(ROLES.ADMIN, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), validate({ body: v.updateDepartmentSchema }), c.updateDepartment);
router.delete('/departments/:id', authenticate, authorize(ROLES.ADMIN, ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION), c.deleteDepartment);

module.exports = router;
