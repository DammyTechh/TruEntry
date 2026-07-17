'use strict';

/**
 * Canonical enums shared across the system.
 * Keep in sync with the CHECK constraints in migrations/0001_init.sql.
 */

const ROLES = Object.freeze({
  APPLICANT: 'applicant',
  OFFICER: 'officer', // institution admission officer
  REGISTRAR: 'registrar', // institution head / approver
  JAMB: 'jamb', // regulator
  ADMIN: 'admin', // system administrator
});

const ROLE_VALUES = Object.values(ROLES);

// Roles that belong to an institution and must carry institution_id.
const INSTITUTION_ROLES = Object.freeze([ROLES.OFFICER, ROLES.REGISTRAR]);

const ENTRY_MODES = Object.freeze({
  UTME: 'utme', // JAMB application
  DIRECT_ENTRY: 'direct_entry',
});

const OLEVEL_EXAM_TYPES = Object.freeze(['waec', 'neco', 'nabteb']);

/**
 * Application lifecycle status.
 * pending -> under_review -> qualified_post_utme / not_qualified_post_utme
 *         -> post_utme_completed -> recommended -> approved / rejected -> forwarded_jamb -> admitted / not_admitted
 */
const APPLICATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_PAYMENT: 'pending_payment',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  QUALIFIED_POST_UTME: 'qualified_post_utme',
  NOT_QUALIFIED_POST_UTME: 'not_qualified_post_utme',
  POST_UTME_COMPLETED: 'post_utme_completed',
  RECOMMENDED: 'recommended',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FORWARDED_JAMB: 'forwarded_jamb',
  ADMITTED: 'admitted',
  NOT_ADMITTED: 'not_admitted',
});

const APPLICATION_STATUS_VALUES = Object.values(APPLICATION_STATUS);

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  ABANDONED: 'abandoned',
  REFUNDED: 'refunded',
});

const PAYMENT_PURPOSE = Object.freeze({
  APPLICATION: 'application',
  POST_UTME: 'post_utme',
});

const ADMISSION_CRITERIA = Object.freeze({
  JAMB_ONLY: 'jamb_only', // schools without Post-UTME
  JAMB_POSTUTME_AVERAGE: 'jamb_postutme_average', // schools with Post-UTME
});

const CHAT_ROLES = Object.freeze({
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
});

const ESCALATION_STATUS = Object.freeze({
  OPEN: 'open',
  RESOLVED: 'resolved',
});

const REPORT_TYPES = Object.freeze({
  AUDIT_READY: 'audit_ready',
  ADMITTED_LIST: 'admitted_list',
  APPLICANTS_LIST: 'applicants_list',
});

const POLICY_SOURCE = Object.freeze({
  EDITOR: 'editor',
  PDF: 'pdf',
});

const NIGERIAN_STATES = Object.freeze([
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]);

module.exports = {
  ROLES,
  ROLE_VALUES,
  INSTITUTION_ROLES,
  ENTRY_MODES,
  OLEVEL_EXAM_TYPES,
  APPLICATION_STATUS,
  APPLICATION_STATUS_VALUES,
  PAYMENT_STATUS,
  PAYMENT_PURPOSE,
  ADMISSION_CRITERIA,
  CHAT_ROLES,
  ESCALATION_STATUS,
  REPORT_TYPES,
  POLICY_SOURCE,
  NIGERIAN_STATES,
};
