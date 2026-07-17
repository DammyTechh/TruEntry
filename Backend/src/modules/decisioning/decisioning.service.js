'use strict';

const { queryOne, queryMany, transaction } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { ADMISSION_CRITERIA, APPLICATION_STATUS } = require('../../utils/constants');
const { canTransition } = require('../applications/application.status');
const regulatorService = require('../../services/regulator.service');

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

async function loadCandidates(institutionId, departmentId, criteria) {
  const statuses = eligibleStatuses(criteria);
  const rows = await queryMany(
    `SELECT a.*, u.full_name AS applicant_name, u.email AS applicant_email,
            p.state_of_origin, p.olevel_data
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
function rankAndSelect({ candidates, criteria, department }) {
  const jambCutoff = Number(department.jamb_cutoff) || 0;
  const aggCutoff = Number(department.aggregate_cutoff) || 0;
  const quota = department.admission_quota || 0;

  const scored = candidates
    .map((a) => {
      const olevelResults = a.olevel_data ? a.olevel_data.results : a.olevel_results;
      const credits = regulatorService.countCredits(olevelResults || []);
      const score = rankingScore(a, criteria);
      const meetsJamb = a.jamb_score == null ? true : Number(a.jamb_score) >= jambCutoff;
      const meetsAgg =
        criteria === ADMISSION_CRITERIA.JAMB_ONLY ? true : score >= aggCutoff;
      const meetsCredits = credits >= 5; // 5 O-level credits incl. relevant subjects
      const eligible = meetsJamb && meetsAgg && meetsCredits;
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
              !meetsCredits ? 'Insufficient O-Level credits (min 5)' : null,
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
  return { criteria, department: department.name, ...rankAndSelect({ candidates, criteria, department }) };
}

/**
 * Commit a decision run: selected -> recommended, ineligible -> not_qualified.
 * Waitlisted are left as-is for a later run. Ranks are persisted.
 */
async function run(institutionId, departmentId, userId) {
  const { criteria, department } = await loadContext(institutionId, departmentId);
  const candidates = await loadCandidates(institutionId, departmentId, criteria);
  const result = rankAndSelect({ candidates, criteria, department });

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
