'use strict';

const { z } = require('zod');

const createApplicationSchema = z.object({
  institutionId: z.string().uuid(),
  departmentId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  policyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the policy statement to apply' }),
  }),
});

const postUtmeSubmitSchema = z.object({
  // Applicant-submitted post-UTME details (e.g. exam center pref, subjects) for
  // institutions that require it. Score is set later by the officer.
  center: z.string().trim().max(120).optional(),
  responses: z.record(z.any()).optional(),
});

const officerPostUtmeScoreSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(1).max(400).optional(),
});

const decisionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const considerSchema = z.object({
  qualified: z.boolean().default(true),
  note: z.string().trim().max(500).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  state: z.string().optional(),
  sort: z.string().optional(),
});

module.exports = {
  createApplicationSchema,
  postUtmeSubmitSchema,
  officerPostUtmeScoreSchema,
  decisionSchema,
  considerSchema,
  listQuerySchema,
};
