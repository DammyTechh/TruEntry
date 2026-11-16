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

/**
 * The same subject goes by several names. An institution types "Maths" into a
 * department's requirements; WAEC returns "Mathematics". Comparing the raw
 * strings marked the requirement unmet, so candidates who plainly qualified
 * were refused and admissions processing found nobody to admit.
 *
 * Every name on a row below is the same subject. The first entry is the
 * canonical form used for comparison.
 */
const SUBJECT_ALIASES = [
  ['mathematics', 'maths', 'math', 'general mathematics', 'core mathematics', 'gen maths'],
  ['english language', 'english', 'eng', 'eng language', 'use of english', 'english lang'],
  ['further mathematics', 'further maths', 'f maths', 'add maths', 'additional mathematics'],
  ['literature in english', 'literature', 'lit in english', 'lit'],
  ['civic education', 'civics', 'civic'],
  ['economics', 'econs', 'economic'],
  ['agricultural science', 'agric science', 'agriculture', 'agric'],
  ['physics', 'phy'],
  ['chemistry', 'chem'],
  ['biology', 'bio'],
  ['geography', 'geo'],
  ['government', 'govt'],
  ['commerce', 'commerce studies'],
  ['financial accounting', 'accounting', 'accounts', 'principles of accounts', 'poa'],
  ['christian religious studies', 'crs', 'christian religious knowledge', 'crk'],
  ['islamic religious studies', 'irs', 'islamic studies', 'islamic religious knowledge', 'irk'],
  ['computer studies', 'computer science', 'computer', 'ict', 'data processing'],
  ['technical drawing', 'tech drawing', 'td'],
  ['food and nutrition', 'food & nutrition', 'foods and nutrition'],
  ['home economics', 'home econs'],
  ['yoruba', 'yoruba language'],
  ['igbo', 'ibo', 'igbo language'],
  ['hausa', 'hausa language'],
  ['fine art', 'fine arts', 'visual art', 'visual arts', 'art'],
  ['history', 'hist'],
  ['marketing'],
  ['book keeping', 'bookkeeping'],
];

const ALIAS_TO_CANONICAL = (() => {
  const map = new Map();
  for (const row of SUBJECT_ALIASES) {
    for (const name of row) map.set(name, row[0]);
  }
  return map;
})();

/** Lower-case, collapse whitespace, drop punctuation that varies by source. */
function normaliseSubject(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[._]/g, ' ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ');
}

/** The agreed name for a subject, whichever of its aliases was supplied. */
function canonicalSubject(s) {
  const n = normaliseSubject(s);
  return ALIAS_TO_CANONICAL.get(n) || n;
}

/**
 * Do these two subject names refer to the same subject?
 *
 * Matching is symmetric on purpose: "Maths" must find "Mathematics" and
 * "Mathematics" must find "Maths". The old one-directional prefix test only
 * worked in one of those directions.
 */
function sameSubject(a, b) {
  const x = canonicalSubject(a);
  const y = canonicalSubject(b);
  if (x === y) return true;
  // Fall back to a prefix match for names not in the table above, e.g. a
  // requirement of "Chemistry" against a result of "Chemistry (Practical)".
  return x.startsWith(y) || y.startsWith(x);
}

function isCore(subject) {
  const s = canonicalSubject(subject);
  return CORE_SUBJECTS.some((c) => s === canonicalSubject(c));
}

/**
 * Merge O'Level sittings, keeping the BEST grade per subject.
 * @param {Array<{examType:string, results:Array<{subject:string,grade:string}>}>} sittings
 */
function mergeSittings(sittings = []) {
  const best = new Map();
  for (const sitting of sittings) {
    for (const r of sitting.results || []) {
      // Key on the canonical name so "Maths" from one sitting and
      // "Mathematics" from another are the same subject, and the better of
      // the two grades wins rather than both being kept.
      const key = canonicalSubject(r.subject);
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
  const quotaMaxSittings = requirements.length
    ? Math.min(...requirements.map((r) => r.max_sittings ?? 2), 2)
    : 2;
  // The department may be stricter than the institution-wide cycle.
  const deptMaxSittings = Number(department?.max_sittings ?? 2);
  const maxSittingsAllowed = Math.min(quotaMaxSittings, deptMaxSittings, 2);

  if (sittings.length > maxSittingsAllowed) {
    reasons.push(
      maxSittingsAllowed === 1
        ? "This course accepts a single O'Level sitting only."
        : `A maximum of ${maxSittingsAllowed} O'Level sitting(s) is accepted here.`
    );
  }

  const merged = mergeSittings(sittings);
  details.olevel = { subjects: merged.length, sittings: sittings.length };

  // ---- 4a. The department's own subject requirements --------------------
  // Typed in by the institution when the course was created, so the check is
  // course-specific rather than one rule for the whole school.
  const deptRequirements = department?.olevel_requirements || [];
  if (deptRequirements.length) {
    const missing = [];
    const belowGrade = [];

    for (const req of deptRequirements) {
      const held = merged.find((m) => sameSubject(m.subject, req.subject));
      const minRank = GRADE_RANK[String(req.minimum_grade || 'C6').toUpperCase()] ?? 6;

      if (!held) {
        if (req.is_compulsory !== false) missing.push(req.subject);
        continue;
      }
      if (held.rank > minRank) {
        belowGrade.push(`${req.subject} — ${held.grade}, needs ${String(req.minimum_grade).toUpperCase()}`);
      }
    }

    if (missing.length) {
      reasons.push(`This course requires: ${missing.join(', ')}.`);
    }
    if (belowGrade.length) {
      reasons.push(`Your grade is below this course's minimum in ${belowGrade.join('; ')}.`);
    }
    details.departmentRequirements = {
      total: deptRequirements.length,
      missing: missing.length,
      belowGrade: belowGrade.length,
    };
  }

  // ---- 4b. The department's own credit count ----------------------------
  const deptMinCredits = Number(department?.min_credits ?? 0);
  if (deptMinCredits) {
    // Credits are passes at C6 or better, the standard Nigerian definition.
    const deptCredits = merged.filter((m) => m.rank <= GRADE_RANK.C6).length;
    details.departmentCredits = deptCredits;
    if (deptCredits < deptMinCredits) {
      reasons.push(
        `This course requires at least ${deptMinCredits} credit(s) at C6 or better (you have ${deptCredits}).`
      );
    }
  }

  for (const req of requirements) {
    const minRank = GRADE_RANK[String(req.minimum_grade || '').toUpperCase()] ?? 9;

    if (req.subject_group === 'core') {
      // Every core subject must be present and meet the minimum grade.
      const coreHeld = merged.filter((m) => isCore(m.subject));
      const missing = ['Mathematics', 'English Language'].filter(
        (needle) => !coreHeld.some((m) => sameSubject(m.subject, needle))
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

/**
 * A department together with the O'Level requirements the institution typed
 * in for it, so evaluate() can judge the applicant against that course.
 */
async function loadDepartment(institutionId, departmentId) {
  return queryOne(
    `SELECT d.*,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'subject', r.subject,
                       'minimum_grade', r.minimum_grade,
                       'is_compulsory', r.is_compulsory))
                FROM department_olevel_requirements r
               WHERE r.department_id = d.id), '[]'::json) AS olevel_requirements
       FROM departments d
      WHERE d.id = $1 AND d.institution_id = $2`,
    [departmentId, institutionId]
  );
}

/** Load a quota plus everything eligibility needs, then evaluate. */
async function checkApplicant({ institutionId, departmentId, applicant }) {
  const quota = await queryOne(
    `SELECT * FROM admission_quotas
      WHERE institution_id = $1 AND status = 'open'
      ORDER BY created_at DESC LIMIT 1`,
    [institutionId]
  );
  if (!quota) {
    // "Not accepting applications" on its own tells nobody what to do about
    // it. Say which institution, and which of the three situations it is in,
    // so the applicant knows whether to wait and the institution knows what
    // it still has to press.
    const state = await queryOne(
      `SELECT i.name,
              COUNT(q.*) FILTER (WHERE q.status = 'draft')::int  AS drafts,
              COUNT(q.*) FILTER (WHERE q.status = 'closed')::int AS closed,
              COUNT(q.*) FILTER (WHERE q.status IN ('processing','finished'))::int AS done
         FROM institutions i
         LEFT JOIN admission_quotas q ON q.institution_id = i.id
        WHERE i.id = $1
        GROUP BY i.name`,
      [institutionId]
    );
    const name = state?.name || 'This institution';
    let reason;
    if (state?.drafts) reason = `${name} has set up an admission cycle but has not opened it yet.`;
    else if (state?.done) reason = `${name} has finished taking applications for this cycle.`;
    else if (state?.closed) reason = `Applications to ${name} have closed.`;
    else reason = `${name} has not opened applications on TruEntry yet.`;
    return { eligible: false, reasons: [reason], details: {}, quota: null };
  }

  const { rows: requirements } = await query(
    'SELECT * FROM quota_olevel_requirements WHERE quota_id = $1',
    [quota.id]
  );
  const { rows: choices } = await query(
    'SELECT choice_position FROM quota_choice_preferences WHERE quota_id = $1',
    [quota.id]
  );
  const department = departmentId ? await loadDepartment(institutionId, departmentId) : null;

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

module.exports = {
  evaluate, mergeSittings, classifyCategory, checkApplicant, loadDepartment, GRADE_RANK,
  canonicalSubject, sameSubject, SUBJECT_ALIASES,
};
