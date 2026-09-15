'use strict';

/**
 * Eligibility — can this applicant apply to this department under the
 * institution's current admission cycle?
 *
 * Applicants are told immediately (before payment where possible, and always
 * before an application is created) when they do not meet a requirement, with
 * the specific reason rather than a generic rejection.
 */

const { query, queryOne } = require('../../config/database');

// 1 = best. Mirrors olevel_grade_ranks in the database.
const GRADE_RANK = { A1: 1, B2: 2, B3: 3, C4: 4, C5: 5, C6: 6, D7: 7, E8: 8, F9: 9 };

// Subjects that every candidate must hold, regardless of course.
const CORE_SUBJECTS = ['mathematics', 'english language', 'english'];

/**
 * Postgres DATE columns arrive as JS Date objects; plain strings may also be
 * supplied. Normalise both to YYYY-MM-DD so they compare correctly.
 */
function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normaliseSubject(s) {
  return String(s || '').trim().toLowerCase();
}

function isCore(subject) {
  const s = normaliseSubject(subject);
  return CORE_SUBJECTS.some((c) => s === c || s.startsWith(c));
}

/**
 * Merge O'Level sittings, keeping the BEST grade per subject.
 * @param {Array<{examType:string, results:Array<{subject:string,grade:string}>}>} sittings
 */
function mergeSittings(sittings = []) {
  const best = new Map();
  for (const sitting of sittings) {
    for (const r of sitting.results || []) {
      const key = normaliseSubject(r.subject);
      const rank = GRADE_RANK[String(r.grade || '').toUpperCase()] ?? 99;
      const current = best.get(key);
      if (!current || rank < current.rank) {
        best.set(key, { subject: r.subject, grade: String(r.grade || '').toUpperCase(), rank });
      }
    }
  }
  return [...best.values()];
}

/**
 * Evaluate an applicant against a quota's requirements.
 *
 * @param {object} args
 * @param {object} args.quota          Quota row (admission_quotas)
 * @param {Array}  args.requirements   quota_olevel_requirements rows
 * @param {Array}  args.choicePositions Accepted JAMB choice positions
 * @param {object} args.applicant      { jambScore, stateOfOrigin, choicePosition, olevelSittings }
 * @param {object} [args.department]   Department row, for its own cut-offs
 * @returns {{eligible:boolean, reasons:string[], details:object}}
 */
function evaluate({ quota, requirements = [], choicePositions = [], applicant, department }) {
  const reasons = [];
  const details = {};

  // ---- 1. Application window -------------------------------------------
  if (quota.status !== 'open') {
    reasons.push('This institution is not currently accepting applications.');
  }
  const today = new Date().toISOString().slice(0, 10);
  const start = toIsoDate(quota.application_start);
  const end = toIsoDate(quota.application_end);
  if (start && today < start) reasons.push('Applications have not opened yet.');
  if (end && today > end) reasons.push('The application window has closed.');

  // ---- 2. JAMB score ----------------------------------------------------
  const jambScore = Number(applicant.jambScore ?? 0);
  const institutionCutoff = Number(quota.jamb_cutoff ?? 0);
  const departmentCutoff = Number(department?.jamb_cutoff ?? 0);
  const requiredJamb = Math.max(institutionCutoff, departmentCutoff);

  details.jamb = { score: jambScore, required: requiredJamb };
  if (requiredJamb && jambScore < requiredJamb) {
    reasons.push(`Your JAMB score (${jambScore}) is below the required ${requiredJamb}.`);
  }

  // ---- 3. JAMB choice position -----------------------------------------
  if (choicePositions.length && applicant.choicePosition) {
    details.choicePosition = { value: applicant.choicePosition, accepted: choicePositions };
    if (!choicePositions.includes(Number(applicant.choicePosition))) {
      const label = choicePositions.map(ordinal).join(' or ');
      reasons.push(`This institution only admits candidates who selected it as ${label} choice.`);
    }
  }

  // ---- 4. O'Level requirements -----------------------------------------
  const sittings = applicant.olevelSittings || [];
  const maxSittingsAllowed = Math.min(...requirements.map((r) => r.max_sittings ?? 2), 2);

  if (sittings.length > maxSittingsAllowed) {
    reasons.push(`This institution accepts a maximum of ${maxSittingsAllowed} O'Level sitting(s).`);
  }

  const merged = mergeSittings(sittings);
  details.olevel = { subjects: merged.length, sittings: sittings.length };

  for (const req of requirements) {
    const minRank = GRADE_RANK[String(req.minimum_grade || '').toUpperCase()] ?? 9;

    if (req.subject_group === 'core') {
      // Every core subject must be present and meet the minimum grade.
      const coreHeld = merged.filter((m) => isCore(m.subject));
      const missing = ['mathematics', 'english'].filter(
        (needle) => !coreHeld.some((m) => normaliseSubject(m.subject).startsWith(needle))
      );
      if (missing.length) {
        reasons.push(`Missing compulsory subject(s): ${missing.join(', ')}.`);
      }
      const weak = coreHeld.filter((m) => m.rank > minRank);
      if (weak.length) {
        reasons.push(
          `Core subjects must be at least ${req.minimum_grade}: ` +
            weak.map((w) => `${w.subject} (${w.grade})`).join(', ') + '.'
        );
      }
    }

    // Credit count across all subjects at or above the minimum grade.
    const credits = merged.filter((m) => m.rank <= minRank).length;
    if (req.min_credits && credits < req.min_credits) {
      reasons.push(
        `You need at least ${req.min_credits} credits at ${req.minimum_grade} or better (you have ${credits}).`
      );
    }
    details[`${req.subject_group}Credits`] = credits;
  }

  return { eligible: reasons.length === 0, reasons, details };
}

function ordinal(n) {
  return { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }[n] || `${n}th`;
}

/**
 * Classify an applicant into a regulatory admission category.
 * Catchment states are institution-specific; ELDS is national policy.
 */
async function classifyCategory(institutionId, stateOfOrigin) {
  if (!stateOfOrigin) return 'national_merit';

  const catchment = await queryOne(
    'SELECT 1 FROM institution_catchment_states WHERE institution_id = $1 AND state = $2',
    [institutionId, stateOfOrigin]
  );
  if (catchment) return 'catchment';

  const elds = await queryOne('SELECT 1 FROM elds_states WHERE state = $1', [stateOfOrigin]);
  if (elds) return 'elds';

  return 'national_merit';
}

/** Load a quota plus everything eligibility needs, then evaluate. */
async function checkApplicant({ institutionId, departmentId, applicant }) {
  const quota = await queryOne(
    "SELECT * FROM admission_quotas WHERE institution_id = $1 AND status = 'open' LIMIT 1",
    [institutionId]
  );
  if (!quota) {
    return {
      eligible: false,
      reasons: ['This institution is not currently accepting applications.'],
      details: {},
      quota: null,
    };
  }

  const { rows: requirements } = await query(
    'SELECT * FROM quota_olevel_requirements WHERE quota_id = $1',
    [quota.id]
  );
  const { rows: choices } = await query(
    'SELECT choice_position FROM quota_choice_preferences WHERE quota_id = $1',
    [quota.id]
  );
  const department = departmentId
    ? await queryOne('SELECT * FROM departments WHERE id = $1 AND institution_id = $2', [departmentId, institutionId])
    : null;

  const result = evaluate({
    quota,
    requirements,
    choicePositions: choices.map((c) => c.choice_position),
    applicant,
    department,
  });

  const category = await classifyCategory(institutionId, applicant.stateOfOrigin);

  return { ...result, admissionCategory: category, quotaId: quota.id };
}

module.exports = { evaluate, mergeSittings, classifyCategory, checkApplicant, GRADE_RANK };
