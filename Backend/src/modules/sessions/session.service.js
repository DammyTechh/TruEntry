'use strict';

/**
 * Application sessions — the applicant's admission attempt.
 *
 * Flow:
 *   1. start()        applicant picks one or two O'Level sittings; fee is quoted
 *   2. (payment)      Paystack settles the exam-processing fee
 *   3. verify()       JAMB + O'Level credentials are checked (paid for, so only now)
 *   4. choices()      the institution/course choices the candidate gave JAMB
 *   5. apply()        an application is created against a chosen institution,
 *                     after an eligibility check against that school's quota
 */

const { query, queryOne, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const { reference } = require('../../utils/security');
const regulator = require('../../services/regulator.service');
const eligibility = require('../quotas/eligibility.service');
const email = require('../../services/email.service');
const feeSettings = require('../admin/feeSettings.service');
const config = require('../../config');
const testMode = require('../../services/testMode.service');

const ACTIVE_STATUSES = ['pending_payment', 'paid', 'verifying'];

function shape(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    sittingType: row.sitting_type,
    sittings: row.sitting_type === 'two' ? 2 : 1,
    fees: {
      examProcessingKobo: row.exam_processing_fee_kobo,
      examProcessingNaira: row.exam_processing_fee_kobo / 100,
      secondSittingKobo: row.second_sitting_fee_kobo,
      secondSittingNaira: row.second_sitting_fee_kobo / 100,
      totalKobo: row.total_fee_kobo,
      totalNaira: row.total_fee_kobo / 100,
    },
    status: row.status,
    paymentStatus: row.payment_status,
    paymentId: row.payment_id,
    verification: {
      jamb: row.jamb_verified,
      olevel: row.olevel_verified,
      jambScore: row.jamb_score != null ? Number(row.jamb_score) : null,
      error: row.verification_error,
      verifiedAt: row.verified_at,
    },
    jambChoices: row.jamb_choices || null,
    olevelSittings: row.olevel_sittings || null,
    createdAt: row.created_at,
  };
}

async function platformFees() {
  const row = await queryOne('SELECT * FROM platform_fee_settings WHERE id = TRUE');
  return {
    examProcessingKobo: row?.exam_processing_fee_kobo ?? 2000000,
    secondSittingKobo: row?.second_sitting_fee_kobo ?? 1000000,
  };
}

/**
 * Fee quote for the sitting-type choice, before anything is created.
 * Prices come from platform_fee_settings, which the admin edits under
 * Admin → Fees, so whatever the admin sets is what the checkout shows.
 */
async function quote() {
  const f = await platformFees();
  return {
    one: {
      sittingType: 'one',
      sittings: 1,
      examProcessingNaira: f.examProcessingKobo / 100,
      secondSittingNaira: 0,
      totalNaira: f.examProcessingKobo / 100,
    },
    two: {
      sittingType: 'two',
      sittings: 2,
      examProcessingNaira: f.examProcessingKobo / 100,
      secondSittingNaira: f.secondSittingKobo / 100,
      totalNaira: (f.examProcessingKobo + f.secondSittingKobo) / 100,
    },
    // Lets the checkout tell the applicant no money will be taken while the
    // temporary free-onboarding switch is on.
    testMode: await testMode.isFreeOnboarding(),
  };
}

/** The applicant's current in-flight session, if any. */
async function current(applicantId) {
  const row = await queryOne(
    `SELECT * FROM application_sessions
      WHERE applicant_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [applicantId]
  );
  return shape(row);
}

/**
 * Begin an admission attempt. The applicant chooses one or two O'Level
 * sittings; two costs more because it means an extra result to verify.
 */
async function start(applicantId, { sittingType = 'one' } = {}) {
  const active = await queryOne(
    `SELECT * FROM application_sessions
      WHERE applicant_id = $1 AND status = ANY($2::text[])`,
    [applicantId, ACTIVE_STATUSES]
  );
  if (active) {
    // Let the applicant resume rather than blocking them with an error.
    return { resumed: true, session: shape(active) };
  }

  const f = await platformFees();
  const second = sittingType === 'two' ? f.secondSittingKobo : 0;
  const total = f.examProcessingKobo + second;

  const row = await queryOne(
    `INSERT INTO application_sessions
       (reference, applicant_id, sitting_type,
        exam_processing_fee_kobo, second_sitting_fee_kobo, total_fee_kobo)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [reference('SES'), applicantId, sittingType, f.examProcessingKobo, second, total]
  );
  logger.info('Application session started', { applicantId, sittingType, total });
  return { resumed: false, session: shape(row) };
}

/** Change the sitting type before payment (re-prices the session). */
async function setSittingType(applicantId, sessionId, sittingType) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status !== 'pending_payment') {
    throw ApiError.badRequest('The sitting type can no longer be changed for this application', {
      code: 'SESSION_LOCKED',
    });
  }
  const f = await platformFees();
  const second = sittingType === 'two' ? f.secondSittingKobo : 0;
  const row = await queryOne(
    `UPDATE application_sessions
        SET sitting_type = $1, exam_processing_fee_kobo = $2,
            second_sitting_fee_kobo = $3, total_fee_kobo = $4
      WHERE id = $5 RETURNING *`,
    [sittingType, f.examProcessingKobo, second, f.examProcessingKobo + second, sessionId]
  );
  return shape(row);
}

/** Called by the payment module once the exam-processing fee is settled. */
async function markPaid(sessionId, paymentId) {
  const row = await queryOne(
    `UPDATE application_sessions
        SET status = 'paid', payment_status = 'success', payment_id = COALESCE($2, payment_id)
      WHERE id = $1 AND status = 'pending_payment'
      RETURNING *`,
    [sessionId, paymentId || null]
  );
  if (row) logger.info('Application session paid', { sessionId });
  return shape(row);
}

/**
 * Verify the applicant's credentials. Only permitted once the session is paid,
 * because verification is the thing the fee pays for.
 *
 * @param {object} input
 * @param {string} input.jambRegNo
 * @param {Array<{examType:string, regNo:string}>} input.olevel  1 or 2 sittings
 */
async function verify(applicantId, sessionId, input) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');

  if (session.status === 'verified') {
    return { alreadyVerified: true, session: shape(session) };
  }
  if (!['paid', 'verifying', 'verification_failed'].includes(session.status)) {
    throw ApiError.badRequest(
      'Payment is required before your credentials can be verified',
      { code: 'PAYMENT_REQUIRED' }
    );
  }

  const expected = session.sitting_type === 'two' ? 2 : 1;
  const sittings = input.olevel || [];
  if (sittings.length !== expected) {
    throw ApiError.badRequest(
      `You paid for ${expected} O'Level sitting(s) — please supply exactly ${expected}.`,
      { code: 'SITTING_COUNT_MISMATCH' }
    );
  }

  await query("UPDATE application_sessions SET status = 'verifying' WHERE id = $1", [sessionId]);

  try {
    // --- JAMB -----------------------------------------------------------
    const jamb = await regulator.verifyJamb(input.jambRegNo);

    // --- O'Level (each sitting) -----------------------------------------
    const results = [];
    for (const s of sittings) {
      const r = await regulator.verifyOlevel(s.examType, s.regNo);
      results.push({
        examType: s.examType,
        regNo: s.regNo,
        results: r.results || r.subjects || [],
      });
    }

    const row = await queryOne(
      `UPDATE application_sessions
          SET status = 'verified', jamb_verified = TRUE, olevel_verified = TRUE,
              jamb_score = $1, jamb_choices = $2::jsonb, olevel_sittings = $3::jsonb,
              jamb_reg_no = $5,
              verification_error = NULL, verified_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [
        jamb.score ?? jamb.jambScore ?? null,
        JSON.stringify(jamb.choices || []),
        JSON.stringify(results),
        sessionId,
        // Remembered so a later JAMB re-check knows what to look up without
        // asking the applicant to type the number again.
        String(input.jambRegNo).trim(),
      ]
    );

    // Mirror onto the applicant profile so the rest of the system sees the
    // verified state (dashboard, institution views, decisioning).
    await query(
      `UPDATE applicant_profiles
          SET jamb_verified = TRUE,
              jamb_reg_no = $1,
              jamb_data = $2::jsonb,
              olevel_verified = TRUE,
              olevel_exam_type = $3,
              olevel_reg_no = $4,
              olevel_data = $5::jsonb
        WHERE user_id = $6`,
      [
        input.jambRegNo,
        JSON.stringify({ score: jamb.score ?? null, subjects: jamb.subjects || [], choices: jamb.choices || [] }),
        sittings[0]?.examType || null,
        sittings[0]?.regNo || null,
        JSON.stringify(results),
        applicantId,
      ]
    );

    logger.info('Session verification succeeded', { sessionId, choices: (jamb.choices || []).length });

    // Tell the applicant their choices are ready (never blocks the response).
    (async () => {
      try {
        const user = await queryOne('SELECT email, full_name FROM users WHERE id = $1', [applicantId]);
        if (user) {
          await email.sendVerificationResult(user.email, user.full_name, {
            success: true,
            jambScore: jamb.score ?? null,
            choices: (jamb.choices || []).length,
          });
        }
      } catch (e) {
        logger.warn('Verification email failed', { sessionId, error: e.message });
      }
    })();

    return { alreadyVerified: false, session: shape(row) };
  } catch (err) {
    await query(
      `UPDATE application_sessions SET status = 'verification_failed', verification_error = $1 WHERE id = $2`,
      [err.message, sessionId]
    );
    logger.error('Session verification failed', { sessionId, error: err.message });

    (async () => {
      try {
        const user = await queryOne('SELECT email, full_name FROM users WHERE id = $1', [applicantId]);
        if (user) {
          await email.sendVerificationResult(user.email, user.full_name, {
            success: false,
            error: err.message,
          });
        }
      } catch (e) {
        logger.warn('Verification failure email failed', { sessionId, error: e.message });
      }
    })();

    throw err;
  }
}

/**
 * Re-check a candidate's JAMB record after verification.
 *
 * A candidate who changes course or institution at JAMB was stuck: the
 * session kept the snapshot taken at verification and nothing could pull the
 * new choices through, so they could only apply for courses they had already
 * abandoned. This re-reads the JAMB record and refreshes the score and the
 * choices on the session.
 *
 * It is free — the applicant already paid to have these credentials verified
 * — and the O'Level results are left untouched, since a JAMB change does not
 * alter them. Every re-check is logged so a change of course can be explained
 * afterwards.
 */
async function revalidateJamb(applicantId, sessionId) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');

  if (!['verified', 'completed'].includes(session.status)) {
    throw ApiError.badRequest(
      'Your credentials have to be verified before they can be re-checked.',
      { code: 'NOT_VERIFIED' }
    );
  }

  const regNo = session.jamb_reg_no
    || (await queryOne('SELECT jamb_reg_no FROM applicant_profiles WHERE user_id = $1', [applicantId]))?.jamb_reg_no;
  if (!regNo) {
    throw ApiError.badRequest('No JAMB registration number is on file for this application', {
      code: 'NO_JAMB_REG',
    });
  }

  const fresh = await regulator.verifyJamb(regNo);
  const previousChoices = session.jamb_choices || [];
  const newChoices = fresh.choices || [];
  const previousScore = session.jamb_score != null ? Number(session.jamb_score) : null;
  const newScore = fresh.score ?? fresh.jambScore ?? null;

  const key = (list) => JSON.stringify(list.map((c) => [c.institution, c.course]));
  const changed = key(previousChoices) !== key(newChoices) || Number(newScore) !== Number(previousScore);

  const row = await queryOne(
    `UPDATE application_sessions
        SET jamb_score = $1, jamb_choices = $2::jsonb, jamb_reg_no = $3, last_rechecked_at = NOW()
      WHERE id = $4 RETURNING *`,
    [newScore, JSON.stringify(newChoices), regNo, sessionId]
  );

  await query(
    `INSERT INTO jamb_recheck_log
       (session_id, applicant_id, jamb_reg_no, previous_score, new_score,
        previous_choices, new_choices, changed)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
    [sessionId, applicantId, regNo, previousScore, newScore,
     JSON.stringify(previousChoices), JSON.stringify(newChoices), changed]
  );

  // Keep the profile's copy in step with the session.
  await query('UPDATE applicant_profiles SET jamb_data = $1::jsonb WHERE user_id = $2',
    [JSON.stringify(fresh), applicantId]);

  logger.info('JAMB re-checked', { sessionId, changed, choices: newChoices.length });

  return {
    changed,
    checkedAt: row.last_rechecked_at,
    previous: { jambScore: previousScore, choices: previousChoices.length },
    current: { jambScore: newScore, choices: newChoices.length },
    session: shape(row),
  };
}

/**
 * The institution/course choices the candidate already gave JAMB, enriched
 * with whether each one is actually open and whether the applicant qualifies.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * Re-check a candidate's O'Level results after verification.
 *
 * The counterpart to revalidateJamb. Verification takes a snapshot of the
 * results, so a candidate whose result was later corrected, released or
 * upgraded by the examination body was stuck with the old one — and with any
 * refusal that followed from it. This re-reads the sittings on file and
 * replaces the snapshot.
 *
 * Free, since the applicant already paid to have these verified, and the JAMB
 * side is left alone. An applicant may also supply different registration
 * numbers, which is what makes a corrected or newly released result usable.
 */
async function revalidateOlevel(applicantId, sessionId, input = {}) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');

  if (!['verified', 'completed'].includes(session.status)) {
    throw ApiError.badRequest(
      'Your credentials have to be verified before they can be re-checked.',
      { code: 'NOT_VERIFIED' }
    );
  }

  // Either the sittings the applicant just supplied, or the ones already on
  // the session. Never more than the session was paid for.
  const allowed = session.sitting_type === 'two' ? 2 : 1;
  const supplied = Array.isArray(input.olevel) ? input.olevel : null;
  const previous = session.olevel_sittings || [];
  const wanted = (supplied && supplied.length ? supplied : previous)
    .filter((s) => s && (s.examType || s.exam_type) && (s.regNo || s.reg_no))
    .slice(0, allowed)
    .map((s) => ({
      examType: String(s.examType || s.exam_type).toLowerCase(),
      regNo: String(s.regNo || s.reg_no).trim(),
    }));

  if (!wanted.length) {
    throw ApiError.badRequest('No O-Level registration number is on file for this application', {
      code: 'NO_OLEVEL_REG',
    });
  }

  const refreshed = [];
  for (const s of wanted) {
    const r = await regulator.verifyOlevel(s.examType, s.regNo);
    refreshed.push({
      examType: s.examType,
      regNo: s.regNo,
      candidateName: r.candidateName || r.fullName || null,
      results: r.results || [],
    });
  }

  // Compare on the subject/grade pairs, so a re-check that changes nothing
  // can say so plainly instead of implying something moved.
  const key = (list) => JSON.stringify(
    list.flatMap((s) => (s.results || []).map((r) => [String(r.subject).toLowerCase(), r.grade])).sort()
  );
  const changed = key(previous) !== key(refreshed);

  const row = await queryOne(
    `UPDATE application_sessions
        SET olevel_sittings = $1::jsonb, olevel_verified = TRUE, last_rechecked_at = NOW()
      WHERE id = $2 RETURNING *`,
    [JSON.stringify(refreshed), sessionId]
  );

  await query(
    `INSERT INTO olevel_recheck_log
       (session_id, applicant_id, previous_sittings, new_sittings, changed)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)`,
    [sessionId, applicantId, JSON.stringify(previous), JSON.stringify(refreshed), changed]
  );

  // Keep the profile's copy in step, since eligibility reads it.
  await query('UPDATE applicant_profiles SET olevel_data = $1::jsonb, olevel_verified = TRUE WHERE user_id = $2',
    [JSON.stringify(refreshed), applicantId]);

  const subjectCount = refreshed.reduce((n, s) => n + (s.results || []).length, 0);
  logger.info('O-Level re-checked', { sessionId, changed, sittings: refreshed.length, subjectCount });

  return {
    changed,
    checkedAt: row.last_rechecked_at,
    previous: { sittings: previous.length },
    current: { sittings: refreshed.length, subjects: subjectCount },
    session: shape(row),
  };
}

async function choices(applicantId, sessionId) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status !== 'verified' && session.status !== 'completed') {
    throw ApiError.badRequest('Your credentials must be verified first', { code: 'NOT_VERIFIED' });
  }

  const profile = await queryOne('SELECT * FROM applicant_profiles WHERE user_id = $1', [applicantId]);
  const raw = session.jamb_choices || [];
  const out = [];

  for (const [index, choice] of raw.entries()) {
    // Match the JAMB choice to an institution on the platform.
    // Demo records created from Admin → Mock data carry the platform ids;
    // records from JAMB itself only carry names, so fall back to matching on
    // name or code.
    const institution = await queryOne(
      `SELECT i.*, c.type AS institution_type
         FROM institutions i
         LEFT JOIN institution_categories c ON c.id = i.category_id
        WHERE ($3::uuid IS NOT NULL AND i.id = $3::uuid)
           OR ($3::uuid IS NULL AND (i.name ILIKE $1 OR i.code ILIKE $2))
        LIMIT 1`,
      [
        choice.institution || choice.institutionName || '',
        choice.code || choice.institutionCode || '',
        isUuid(choice.institutionId) ? choice.institutionId : null,
      ]
    );

    const entry = {
      choicePosition: choice.position || choice.choice || index + 1,
      institutionName: choice.institution || choice.institutionName || null,
      courseName: choice.course || choice.courseName || null,
      onPlatform: !!institution,
      institutionId: institution?.id || null,
      institutionType: institution?.institution_type || null,
      departmentId: null,
      eligible: null,
      reasons: [],
    };

    if (institution) {
      // Match the JAMB course to one of the institution's departments.
      const department = await queryOne(
        `SELECT * FROM departments
          WHERE institution_id = $1 AND is_active
            AND (($3::uuid IS NOT NULL AND id = $3::uuid)
                 OR ($3::uuid IS NULL AND name ILIKE $2))
          LIMIT 1`,
        [institution.id, entry.courseName || '', isUuid(choice.departmentId) ? choice.departmentId : null]
      );
      entry.departmentId = department?.id || null;
      entry.departmentName = department?.name || null;

      const check = await eligibility.checkApplicant({
        institutionId: institution.id,
        departmentId: department?.id,
        applicant: {
          jambScore: session.jamb_score,
          stateOfOrigin: profile?.state_of_origin,
          choicePosition: entry.choicePosition,
          olevelSittings: session.olevel_sittings || [],
        },
      });
      entry.eligible = check.eligible;
      entry.reasons = check.reasons;
      entry.admissionCategory = check.admissionCategory;

      // What the ADMIN set for this institution's type, so the applicant sees
      // the real application fee before committing to a choice.
      try {
        const fee = await feeSettings.resolveFeeForInstitution(institution.id, {
          sittings: (session.olevel_sittings || []).length || 1,
        });
        entry.applicationFeeNaira = fee.totalNaira;
        entry.applicationFeeBreakdown = {
          baseNaira: fee.applicationFeeKobo / 100,
          secondSittingNaira: fee.secondSittingFeeKobo / 100,
        };
      } catch {
        entry.applicationFeeNaira = null;
      }
    } else {
      entry.reasons = ['This institution is not yet on TruEntry.'];
      entry.eligible = false;
    }

    out.push(entry);
  }

  return out;
}

/**
 * Create the application for a chosen institution/department. Blocked with a
 * clear reason when the applicant does not meet that school's requirements.
 */
async function apply(applicantId, sessionId, { institutionId, departmentId, choicePosition, policyId }) {
  const session = await queryOne(
    'SELECT * FROM application_sessions WHERE id = $1 AND applicant_id = $2',
    [sessionId, applicantId]
  );
  if (!session) throw ApiError.notFound('Session not found');
  if (!['verified', 'completed'].includes(session.status)) {
    throw ApiError.badRequest('Your credentials must be verified before applying', { code: 'NOT_VERIFIED' });
  }

  const duplicate = await queryOne(
    `SELECT id FROM applications
      WHERE applicant_id = $1 AND institution_id = $2 AND department_id = $3
        AND status NOT IN ('rejected','not_admitted')`,
    [applicantId, institutionId, departmentId]
  );
  if (duplicate) throw ApiError.conflict('You have already applied to this course', { code: 'DUPLICATE_APPLICATION' });

  const profile = await queryOne('SELECT * FROM applicant_profiles WHERE user_id = $1', [applicantId]);

  const check = await eligibility.checkApplicant({
    institutionId,
    departmentId,
    applicant: {
      jambScore: session.jamb_score,
      stateOfOrigin: profile?.state_of_origin,
      choicePosition,
      olevelSittings: session.olevel_sittings || [],
    },
  });

  if (!check.eligible) {
    // Told immediately, with the specific reasons.
    throw ApiError.badRequest('You do not meet the requirements for this course', {
      code: 'NOT_ELIGIBLE',
      details: check.reasons,
    });
  }

  const created = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO applications
         (reference, applicant_id, institution_id, department_id, session_id, quota_id,
          entry_mode, jamb_score, olevel_results, status, payment_status,
          choice_position, admission_category, eligibility, policy_id, policy_accepted, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'submitted','success',$10,$11,$12::jsonb,$13,TRUE,NOW())
       RETURNING *`,
      [
        reference('APP'),
        applicantId,
        institutionId,
        departmentId,
        sessionId,
        check.quotaId,
        profile?.entry_mode || 'utme',
        session.jamb_score,
        JSON.stringify(session.olevel_sittings || []),
        choicePosition || null,
        check.admissionCategory,
        JSON.stringify({ eligible: true, details: check.details }),
        policyId || null,
      ]
    );
    const application = rows[0];

    await client.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, note, changed_by)
       VALUES ($1, NULL, 'submitted', 'Application submitted after verification', $2)`,
      [application.id, applicantId]
    );

    await client.query("UPDATE application_sessions SET status = 'completed' WHERE id = $1", [sessionId]);
    return application;
  });

  // Notify the applicant (never blocks the transaction).
  try {
    const user = await queryOne('SELECT email, full_name FROM users WHERE id = $1', [applicantId]);
    const inst = await queryOne('SELECT name FROM institutions WHERE id = $1', [institutionId]);
    const dept = await queryOne('SELECT name FROM departments WHERE id = $1', [departmentId]);
    await email.sendApplicationStatus(user.email, user.full_name, {
      institution: inst?.name,
      department: dept?.name,
      status: 'submitted',
    });
  } catch (err) {
    logger.warn('Application confirmation email failed', { error: err.message });
  }

  logger.info('Application created from session', { applicationId: created.id, sessionId });
  return { id: created.id, reference: created.reference, status: created.status };
}

module.exports = {
  quote, current, start, setSittingType, markPaid, verify, choices, apply, shape, platformFees,
  revalidateJamb,
  revalidateOlevel,
};
