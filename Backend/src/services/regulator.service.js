'use strict';

/**
 * Integration layer for the national regulator APIs (JAMB, WAEC, NECO, NABTEB).
 *
 * Official access is not yet granted, so these run in "stub" mode against the
 * seeded mock_* tables. The public function signatures mirror the expected live
 * contract, so switching JAMB_API_MODE / WAEC_API_MODE to "live" only requires
 * implementing the `fromLive*` branch — no calling code changes.
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');
const { queryOne } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { OLEVEL_EXAM_TYPES } = require('../utils/constants');

/* ------------------------------- JAMB ---------------------------------- */

function normalizeJamb(row) {
  return {
    jambRegNo: row.jamb_reg_no,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    stateOfOrigin: row.state_of_origin,
    jambScore: Number(row.jamb_score),
    subjects: row.subjects || [],
    examYear: row.exam_year,
  };
}

async function jambFromStub(regNo) {
  const row = await queryOne('SELECT * FROM mock_jamb_records WHERE jamb_reg_no = $1', [regNo]);
  if (!row) throw ApiError.notFound('JAMB record not found', { code: 'JAMB_NOT_FOUND' });
  return normalizeJamb(row);
}

async function jambFromLive(regNo) {
  // Placeholder for the official JAMB endpoint once access is granted.
  const { data } = await axios.get(`${config.regulators.jambBaseUrl}/candidate/${regNo}`, {
    headers: { Authorization: `Bearer ${config.regulators.jambApiKey}` },
    timeout: 15000,
  });
  return normalizeJamb({
    jamb_reg_no: regNo,
    full_name: data.full_name,
    date_of_birth: data.date_of_birth,
    gender: data.gender,
    state_of_origin: data.state,
    jamb_score: data.aggregate_score,
    subjects: data.subjects,
    exam_year: data.exam_year,
  });
}

/**
 * Look up a JAMB candidate by registration number.
 */
async function verifyJamb(regNo) {
  if (!regNo || String(regNo).trim().length < 6) {
    throw ApiError.badRequest('Invalid JAMB registration number', { code: 'INVALID_JAMB_REG' });
  }
  const mode = config.regulators.jambMode;
  logger.info('JAMB verification requested', { mode });
  return mode === 'live' ? jambFromLive(regNo) : jambFromStub(regNo);
}

/* ---------------------------- O-LEVEL ---------------------------------- */

function normalizeOlevel(row) {
  return {
    examType: row.exam_type,
    regNo: row.reg_no,
    fullName: row.full_name,
    examYear: row.exam_year,
    results: row.results || [],
  };
}

async function olevelFromStub(examType, regNo) {
  const row = await queryOne(
    'SELECT * FROM mock_olevel_records WHERE exam_type = $1 AND reg_no = $2',
    [examType, regNo]
  );
  if (!row) throw ApiError.notFound('O-Level record not found', { code: 'OLEVEL_NOT_FOUND' });
  return normalizeOlevel(row);
}

async function olevelFromLive(examType, regNo) {
  const { data } = await axios.get(`${config.regulators.waecBaseUrl}/result`, {
    params: { type: examType, reg_no: regNo },
    headers: { Authorization: `Bearer ${config.regulators.waecApiKey}` },
    timeout: 15000,
  });
  return normalizeOlevel({
    exam_type: examType,
    reg_no: regNo,
    full_name: data.candidate_name,
    exam_year: data.exam_year,
    results: data.subjects,
  });
}

/**
 * Look up an O-Level result (WAEC / NECO / NABTEB).
 */
async function verifyOlevel(examType, regNo) {
  const type = String(examType || '').toLowerCase();
  if (!OLEVEL_EXAM_TYPES.includes(type)) {
    throw ApiError.badRequest('Exam type must be one of: waec, neco, nabteb', {
      code: 'INVALID_EXAM_TYPE',
    });
  }
  if (!regNo || String(regNo).trim().length < 6) {
    throw ApiError.badRequest('Invalid O-Level registration number', { code: 'INVALID_OLEVEL_REG' });
  }
  const mode = config.regulators.waecMode;
  logger.info('O-Level verification requested', { mode, type });
  return mode === 'live' ? olevelFromLive(type, regNo) : olevelFromStub(type, regNo);
}

/* --------------------------- Grade helper ------------------------------ */

// WAEC/NECO grade -> point (A1=1 best ... F9=9 worst). Used for aggregate scoring.
const GRADE_POINTS = { A1: 1, B2: 2, B3: 3, C4: 4, C5: 5, C6: 6, D7: 7, E8: 8, F9: 9 };

/**
 * Count credit passes (C6 or better) in an O-Level result set.
 */
function countCredits(results = []) {
  return results.filter((r) => GRADE_POINTS[r.grade] && GRADE_POINTS[r.grade] <= 6).length;
}

module.exports = { verifyJamb, verifyOlevel, countCredits, GRADE_POINTS };
