'use strict';

const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');
const { queryOne } = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Normalise any NIN source (Dojah live or mock table) into the internal model.
 */
/**
 * Identity providers report gender inconsistently — Dojah returns "m"/"f",
 * some records use "Male"/"MALE". The database only accepts 'male'|'female',
 * so everything is mapped here rather than at each call site.
 */
function normaliseGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'm' || v.startsWith('male')) return 'male';
  if (v === 'f' || v.startsWith('female')) return 'female';
  return null; // unknown values are dropped rather than breaking the write
}

/**
 * Providers return dates in several formats (YYYY-MM-DD, DD-MM-YYYY,
 * DD/MM/YYYY). Postgres DATE only accepts an unambiguous ISO value, so
 * normalise before it reaches the database.
 */
function normaliseDate(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalize(raw) {
  return {
    nin: raw.nin,
    firstName: raw.first_name || raw.firstname || null,
    lastName: raw.last_name || raw.lastname || null,
    middleName: raw.middle_name || raw.middlename || null,
    dateOfBirth: normaliseDate(raw.date_of_birth || raw.dob),
    gender: normaliseGender(raw.gender),
    phone: raw.phone || raw.phone_number || null,
    stateOfOrigin: raw.state_of_origin || null,
    photo: raw.photo || raw.picture || null,
  };
}

/**
 * Resolve NIN from the seeded mock table (used when DOJAH_MOCK=true or no keys).
 */
async function fromMock(nin) {
  const row = await queryOne('SELECT * FROM mock_nin_records WHERE nin = $1', [nin]);
  if (!row) {
    throw ApiError.notFound('NIN not found in validation service', { code: 'NIN_NOT_FOUND' });
  }
  return normalize(row);
}

/**
 * Call Dojah's NIN lookup endpoint.
 */
async function fromDojah(nin) {
  try {
    const { data } = await axios.get(`${config.dojah.baseUrl}/api/v1/kyc/nin`, {
      params: { nin },
      headers: {
        Authorization: config.dojah.secretKey,
        AppId: config.dojah.appId,
      },
      timeout: 15000,
    });
    const entity = data?.entity || data?.data || data;
    if (!entity) throw ApiError.notFound('NIN not found', { code: 'NIN_NOT_FOUND' });
    return normalize({
      nin,
      first_name: entity.first_name,
      last_name: entity.last_name,
      middle_name: entity.middle_name,
      date_of_birth: entity.date_of_birth,
      gender: entity.gender,
      phone: entity.phone_number || entity.phone_number1,
      photo: entity.photo,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const status = err.response?.status;
    logger.error('Dojah NIN lookup failed', { status, error: err.message });
    if (status === 404) throw ApiError.notFound('NIN not found', { code: 'NIN_NOT_FOUND' });
    throw ApiError.badGateway('NIN validation service is unavailable', { code: 'NIN_SERVICE_ERROR' });
  }
}

/**
 * Validate a NIN. Returns normalised biodata.
 * @param {string} nin - 11-digit NIN.
 */
async function validateNin(nin) {
  if (!/^\d{11}$/.test(String(nin))) {
    throw ApiError.badRequest('NIN must be exactly 11 digits', { code: 'INVALID_NIN' });
  }
  const useMock = config.dojah.mock || !config.dojah.secretKey || !config.dojah.appId;
  logger.info('NIN validation requested', { mode: useMock ? 'mock' : 'dojah' });
  return useMock ? fromMock(nin) : fromDojah(nin);
}

module.exports = { validateNin };
