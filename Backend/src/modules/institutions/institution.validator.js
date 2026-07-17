'use strict';

const { z } = require('zod');
const { ADMISSION_CRITERIA, NIGERIAN_STATES } = require('../../utils/constants');

const createInstitutionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(2).max(30),
  categoryId: z.string().uuid().optional(),
  hasPostUtme: z.boolean().optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(255).optional(),
  state: z.enum(NIGERIAN_STATES).optional(),
  description: z.string().trim().max(1000).optional(),
});

const updateInstitutionSchema = createInstitutionSchema.partial();

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});
const updateCategorySchema = categorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(30).optional(),
  admissionQuota: z.coerce.number().int().min(0).default(0),
  jambCutoff: z.coerce.number().min(0).max(400).optional(),
  postUtmeCutoff: z.coerce.number().min(0).max(400).optional(),
  aggregateCutoff: z.coerce.number().min(0).max(400).optional(),
});
const updateDepartmentSchema = departmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const parametersSchema = z.object({
  admissionCriteria: z
    .enum([ADMISSION_CRITERIA.JAMB_ONLY, ADMISSION_CRITERIA.JAMB_POSTUTME_AVERAGE])
    .optional(),
  minJambScore: z.coerce.number().min(0).max(400).optional(),
  minPostUtmeScore: z.coerce.number().min(0).max(400).optional(),
  jambWeight: z.coerce.number().min(0).max(1).optional(),
  postUtmeWeight: z.coerce.number().min(0).max(1).optional(),
  totalQuota: z.coerce.number().int().min(0).optional(),
  admissionOpen: z.boolean().optional(),
  sessionLabel: z.string().trim().max(20).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  state: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  hasPostUtme: z.enum(['true', 'false']).optional(),
});

module.exports = {
  createInstitutionSchema,
  updateInstitutionSchema,
  categorySchema,
  updateCategorySchema,
  departmentSchema,
  updateDepartmentSchema,
  parametersSchema,
  listQuerySchema,
};
