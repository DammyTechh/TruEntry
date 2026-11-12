'use strict';

const { queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { ADMISSION_CRITERIA, APPLICATION_STATUS } = require('../../utils/constants');
const { canTransition } = require('../applications/application.status');
const regulatorService = require('../../services/regulator.service');
const eligibility = require('../quotas/eligibility.service');

/**
 * The applicant's O'Level sittings, whatever shape they were stored in.
 *
 * `applicant_profiles.olevel_data` holds an ARRAY of sittings
 * ([{ examType, regNo, results: [...] }]), but this screen used to read
 * `.results` straight off it. On an array that is `undefined`, so every
 * candidate counted zero credits and the whole list came back
 * "Insufficient O-Level credits (min 5)" even with a full, valid result.
 */
function sittingsOf(row) {
  const candidates = [row.olevel_data, row.olevel_results];
  for (const value of candidates) {
    if (!value) continue;
    // Already a list of sittings.
    if (Array.isArray(value) && value.some((v) => v && Array.isArray(v.results))) return value;
    // A single sitting object.
    if (!Array.isArray(value) && Array.isArray(value.results)) {
      return [{ examType: value.examType, results: value.results }];
    }
    // A bare list of subject/grade pairs.
    if (Array.isArray(value) && value.some((v) => v && v.subject && v.grade)) {
      return [{ examType: row.olevel_exam_type || null, results: value }];
    }
  }
  return [];
}

/**
 * How many credits (C6 or better) the candidate holds across their sittings,
 * and whether the department's own O'Level subjects are satisfied.
 *
 * Uses the same matching as admissions processing, so "Maths" in a
 * department's requirements still matches "Mathematics" on a WAEC result.
 */
function assessOlevel(row, department, requirements) {
  const merged = eligibility.mergeSittings(sittingsOf(row));
  const credits = merged.filter((m) => m.rank <= eligibility.GRADE_RANK.C6).length;

  const missing = [];
  const belowGrade = [];
  for (const req of requirements) {
    const held = merged.find((m) => eligibility.sameSubject(m.subject, req.subject));
    const minRank = eligibility.GRADE_RANK[String(req.minimum_grade || 'C6').toUpperCase()] ?? 6;
    if (!held) {
      if (req.is_compulsory !== false) missing.push(req.subject);
    } else if (held.rank > minRank) {
      belowGrade.push(`${req.subject} (${held.grade}, needs ${String(req.minimum_grade).toUpperCase()})`);
    }
  }

  const minCredits = Number(department.min_credits ?? 5);
  return { merged, credits, minCredits, missing, belowGrade };
}

/**
 * Determine the score used to rank an application under the given criteria.
 * - jamb_only: rank on JAMB score (out of 400)
 * - jamb_postutme_average: rank on the stored aggregate (0-100)
 */
function rankingScore(app, criteria) {
  if (criteria === ADMISSION_CRITERIA.JAMB_ONLY) {
    return app.jamb_score != null ? Number(app.jamb_score) : 0;
  }
  return app.aggregate_score != null ? Number(app.aggregate_score) : 0;
}

/**
 * The application statuses eligible to be considered in a decision run,
 * per criteria. jamb_only can decide straight after submission/review;
 * post-UTME institutions decide after post_utme_completed.
 */
function eligibleStatuses(criteria) {
  if (criteria === ADMISSION_CRITERIA.JAMB_ONLY) {
    return [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_REVIEW];
  }
  return [APPLICATION_STATUS.POST_UTME_COMPLETED];
}

async function loadContext(institutionId, departmentId) {
  const params = await queryOne(
    'SELECT * FROM institution_parameters WHERE institution_id = $1',
    [institutionId]
  );
  const criteria = params ? params.admission_criteria : ADMISSION_CRITERIA.JAMB_ONLY;
  const department = await queryOne(
    'SELECT * FROM departments WHERE id = $1 AND institution_id = $2',
    [departmentId, institutionId]
  );
  if (!department) throw ApiError.notFound('Department not found for this institution');
  return { criteria, department, params };
}

/**
 * The O'Level subjects the institution typed in when the department was
 * created. Empty is fine — the credit count still applies.
 */
async function loadRequirements(departmentId) {
  try {
    return await queryMany(
      `SELECT subject, minimum_grade, is_compulsory
         FROM department_olevel_requirements WHERE department_id = $1`,
      [departmentId]
    );
  } catch {
    // The table arrives with migration 0008; decisioning still works without it.
    return [];
  }
}

async function loadCandidates(institutionId, departmentId, criteria) {
  const statuses = eligibleStatuses(criteria);
  const rows = await queryMany(
    `SELECT a.*, u.full_name AS applicant_name, u.email AS applicant_email,
            p.state_of_origin, p.olevel_data, p.olevel_exam_type
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN applicant_profiles p ON p.user_id = a.applicant_id
      WHERE a.institution_id = $1 AND a.department_id = $2
        AND a.status = ANY($3::text[])`,
    [institutionId, departmentId, statuses]
  );
  return rows;
}

/**
 * Rank candidates and split into selected/waitlisted against the department quota
 * and cutoffs. Pure computation — no writes. Used for both preview and commit.
 */
function rankAndSelect({ candidates, criteria, department, requirements = [] }) {
  const jambCutoff = Number(department.jamb_cutoff) || 0;
  const aggCutoff = Number(department.aggregate_cutoff) || 0;
  const quota = department.admission_quota || 0;

  const scored = candidates
    .map((a) => {
      const olevel = assessOlevel(a, department, requirements);
      const credits = olevel.credits;
      const score = rankingScore(a, criteria);
      const meetsJamb = a.jamb_score == null ? true : Number(a.jamb_score) >= jambCutoff;
      const meetsAgg =
        criteria === ADMISSION_CRITERIA.JAMB_ONLY ? true : score >= aggCutoff;
      const meetsCredits = credits >= olevel.minCredits;
      const meetsSubjects = olevel.missing.length === 0 && olevel.belowGrade.length === 0;
      const eligible = meetsJamb && meetsAgg && meetsCredits && meetsSubjects;
      return {
        applicationId: a.id,
        reference: a.reference,
        applicantName: a.applicant_name,
        applicantEmail: a.applicant_email,
        state: a.state_of_origin,
        jambScore: a.jamb_score != null ? Number(a.jamb_score) : null,
        postUtmeScore: a.post_utme_score != null ? Number(a.post_utme_score) : null,
        aggregateScore: a.aggregate_score != null ? Number(a.aggregate_score) : null,
        credits,
        rankingScore: score,
        eligible,
        reasons: eligible
          ? []
          : [
              !meetsJamb ? `JAMB below cutoff (${jambCutoff})` : null,
              !meetsAgg ? `Aggregate below cutoff (${aggCutoff})` : null,
              !meetsCredits
                ? `Insufficient O-Level credits — has ${credits}, needs ${olevel.minCredits}`
                : null,
              olevel.missing.length ? `Missing required subject(s): ${olevel.missing.join(', ')}` : null,
              olevel.belowGrade.length ? `Below the minimum grade in ${olevel.belowGrade.join('; ')}` : null,
            ].filter(Boolean),
      };
    })
    .sort((x, y) => y.rankingScore - x.rankingScore);

  const eligible = scored.filter((s) => s.eligible);
  const ineligible = scored.filter((s) => !s.eligible);

  const selected = [];
  const waitlisted = [];
  eligible.forEach((s, idx) => {
    const rank = idx + 1;
    if (quota === 0 || rank <= quota) selected.push({ ...s, rank });
    else waitlisted.push({ ...s, rank });
  });

  return {
    quota,
    totalCandidates: scored.length,
    selectedCount: selected.length,
    waitlistedCount: waitlisted.length,
    ineligibleCount: ineligible.length,
    selected,
    waitlisted,
    ineligible,
  };
}

/**
 * Preview a decision run without persisting anything.
 */
async function preview(institutionId, departmentId) {
  const { criteria, department } = await loadContext(institutionId, departmentId);
  const candidates = await loadCandidates(institutionId, departmentId, criteria);
  const requirements = await loadRequirements(departmentId);
  return {
    criteria,
    department: department.name,
    ...rankAndSelect({ candidates, criteria, department, requirements }),
  };
}

/**
 * Commit a decision run: selected -> recommended, ineligible -> not_qualified.
 * Waitlisted are left as-is for a later run. Ranks are persisted.
 */
async function run(institutionId, departmentId, userId) {
  const { criteria, department } = await loadContext(institutionId, departmentId);
  const candidates = await loadCandidates(institutionId, departmentId, criteria);
  const requirements = await loadRequirements(departmentId);
  const result = rankAndSelect({ candidates, criteria, department, requirements });

  await transaction(async (client) => {
    for (const s of result.selected) {
      const appRow = candidates.find((c) => c.id === s.applicationId);
      if (canTransition(appRow.status, APPLICATION_STATUS.RECOMMENDED)) {
        await client.query(
          `UPDATE applications SET status = $1, rank = $2, recommended_by = $3, decided_at = NOW()
             WHERE id = $4`,
          [APPLICATION_STATUS.RECOMMENDED, s.rank, userId, s.applicationId]
        );
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, to_status, note, changed_by)
             VALUES ($1,$2,$3,$4,$5)`,
          [s.applicationId, appRow.status, APPLICATION_STATUS.RECOMMENDED,
           `Selected by decision run (rank ${s.rank})`, userId]
        );
      }
    }
    for (const s of result.ineligible) {
      const appRow = candidates.find((c) => c.id === s.applicationId);
      if (canTransition(appRow.status, APPLICATION_STATUS.NOT_QUALIFIED_POST_UTME)) {
        await client.query(
          `UPDATE applications SET status = $1, decided_at = NOW() WHERE id = $2`,
          [APPLICATION_STATUS.NOT_QUALIFIED_POST_UTME, s.applicationId]
        );
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, to_status, note, changed_by)
             VALUES ($1,$2,$3,$4,$5)`,
          [s.applicationId, appRow.status, APPLICATION_STATUS.NOT_QUALIFIED_POST_UTME,
           `Not eligible: ${s.reasons.join('; ')}`, userId]
        );
      }
    }
  });

  return { criteria, department: department.name, committed: true, ...result };
}

module.exports = { preview, run, rankAndSelect };
