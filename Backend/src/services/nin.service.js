'use strict';

const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');
const { queryOne } = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Normalise any NIN source (Dojah live or mock table) into the internal model.
 */
function normalize(raw) {
  return {
    nin: raw.nin,
    firstName: raw.first_name || raw.firstname || null,
    lastName: raw.last_name || raw.lastname || null,
    middleName: raw.middle_name || raw.middlename || null,
    dateOfBirth: raw.date_of_birth || raw.dob || null,
    gender: raw.gender || null,
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
