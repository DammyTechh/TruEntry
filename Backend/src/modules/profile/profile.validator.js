'use strict';

const { z } = require('zod');
const { ENTRY_MODES, OLEVEL_EXAM_TYPES, NIGERIAN_STATES } = require('../../utils/constants');

const updateProfileSchema = z.object({
  entryMode: z.enum([ENTRY_MODES.UTME, ENTRY_MODES.DIRECT_ENTRY]).optional(),
  jambRegNo: z.string().trim().min(6).max(30).optional(),
  olevelExamType: z.enum(OLEVEL_EXAM_TYPES).optional(),
  olevelRegNo: z.string().trim().min(6).max(30).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female']).optional(),
  stateOfOrigin: z.enum(NIGERIAN_STATES).optional(),
  lga: z.string().trim().max(80).optional(),
  address: z.string().trim().max(255).optional(),
  location: z.string().trim().max(120).optional(),
});

const verifyNinSchema = z.object({
  nin: z.string().trim().regex(/^\d{11}$/, 'NIN must be 11 digits'),
});

const verifyJambSchema = z.object({
  jambRegNo: z.string().trim().min(6).max(30),
});

const verifyOlevelSchema = z.object({
  examType: z.enum(OLEVEL_EXAM_TYPES),
  regNo: z.string().trim().min(6).max(30),
});

module.exports = {
  updateProfileSchema,
  verifyNinSchema,
  verifyJambSchema,
  verifyOlevelSchema,
};
