'use strict';

const { query, queryOne } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { reference: makeRef } = require('../../utils/security');
const pdfService = require('../../services/pdf.service');
const storageService = require('../../services/storage.service');
const emailService = require('../../services/email.service');
const config = require('../../config');
const logger = require('../../config/logger');
const { APPLICATION_STATUS, ROLES } = require('../../utils/constants');

async function loadAdmissionContext(applicationId) {
  return queryOne(
    `SELECT a.*, u.full_name AS applicant_name, u.email AS applicant_email,
            i.name AS institution_name, i.letterhead_url, i.signature_url,
            d.name AS department_name
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       JOIN institutions i ON i.id = a.institution_id
       JOIN departments d ON d.id = a.department_id
      WHERE a.id = $1`,
    [applicationId]
  );
}

/**
 * Generate (or fetch cached) admission letter PDF for an admitted application.
 * Only admitted applications may have a letter.
 */
async function generate(applicationId, actor) {
  const app = await loadAdmissionContext(applicationId);
  if (!app) throw ApiError.notFound('Application not found');

  // Access control: applicant owner, institution staff of that institution, jamb, admin.
  if (actor.role === ROLES.APPLICANT && app.applicant_id !== actor.id) {
    throw ApiError.forbidden('Not your application');
  }
  if ([ROLES.OFFICER, ROLES.REGISTRAR].includes(actor.role) &&
      String(app.institution_id) !== String(actor.institutionId)) {
    throw ApiError.forbidden('This application belongs to another institution');
  }

  if (app.status !== APPLICATION_STATUS.ADMITTED) {
    throw ApiError.badRequest('An admission letter is only available once the applicant is admitted', {
      code: 'NOT_ADMITTED',
    });
  }

  const existing = await queryOne('SELECT * FROM admission_letters WHERE application_id = $1', [applicationId]);
  if (existing && existing.file_url) {
    return { url: existing.file_url, reference: existing.letter_number, cached: true };
  }

  const ref = existing ? existing.letter_number : makeRef('TRU-ADM');
  const pdfBuffer = await pdfService.generateAdmissionLetter({
    reference: ref,
    applicantName: app.applicant_name,
    institutionName: app.institution_name,
    departmentName: app.department_name,
    letterheadUrl: app.letterhead_url,
    signatureUrl: app.signature_url,
    session: config.appName,
    issuedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
  });

  let url = null;
  if (storageService.isConfigured()) {
    const uploaded = await storageService.upload({
      bucket: storageService.buckets.admissionLetters,
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      folder: app.institution_id,
      filename: `${ref}.pdf`,
    });
    url = uploaded.url;
  }

  if (existing) {
    await query('UPDATE admission_letters SET file_url = $1, issued_at = NOW() WHERE id = $2', [url, existing.id]);
  } else {
    await query(
      `INSERT INTO admission_letters (application_id, letter_number, file_url, signed_by)
       VALUES ($1,$2,$3,$4)`,
      [applicationId, ref, url, actor.fullName || 'TruEntry']
    );
  }

  // Email the letter to the applicant (best-effort).
  try {
    await emailService.sendAdmissionLetter(app.applicant_email, app.applicant_name, {
      institution: app.institution_name,
      department: app.department_name,
      letterUrl: url,
    });
  } catch (err) {
    logger.warn('Failed to email admission letter', { error: err.message });
  }

  return { url, reference: ref, buffer: url ? null : pdfBuffer, cached: false };
}

module.exports = { generate };
