'use strict';

const { APPLICATION_STATUS: S } = require('../../utils/constants');

/**
 * Allowed status transitions. Enforced in the service so the workflow can't
 * be skipped or reversed illegally.
 */
const TRANSITIONS = {
  [S.DRAFT]: [S.PENDING_PAYMENT],
  [S.PENDING_PAYMENT]: [S.SUBMITTED],
  [S.SUBMITTED]: [S.UNDER_REVIEW, S.QUALIFIED_POST_UTME, S.NOT_QUALIFIED_POST_UTME],
  [S.UNDER_REVIEW]: [S.QUALIFIED_POST_UTME, S.NOT_QUALIFIED_POST_UTME, S.RECOMMENDED],
  [S.QUALIFIED_POST_UTME]: [S.POST_UTME_COMPLETED, S.NOT_QUALIFIED_POST_UTME],
  [S.POST_UTME_COMPLETED]: [S.RECOMMENDED, S.NOT_ADMITTED],
  [S.RECOMMENDED]: [S.APPROVED, S.REJECTED],
  [S.APPROVED]: [S.FORWARDED_JAMB, S.REJECTED],
  [S.FORWARDED_JAMB]: [S.ADMITTED, S.NOT_ADMITTED],
  [S.REJECTED]: [],
  [S.NOT_QUALIFIED_POST_UTME]: [],
  [S.ADMITTED]: [],
  [S.NOT_ADMITTED]: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

module.exports = { TRANSITIONS, canTransition, S };
