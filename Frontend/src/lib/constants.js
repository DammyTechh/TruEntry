export const ROLES = {
  APPLICANT: 'applicant',
  OFFICER: 'officer',
  REGISTRAR: 'registrar',
  JAMB: 'jamb',
  ADMIN: 'admin',
};

// Where each role lands after login.
export const ROLE_HOME = {
  applicant: '/onboarding',
  officer: '/institution',
  registrar: '/institution',
  jamb: '/jamb',
  admin: '/admin',
};

// Application status -> label + badge classes.
export const STATUS_META = {
  draft: { label: 'Draft', cls: 'bg-primary-surface text-muted' },
  pending_payment: { label: 'Awaiting payment', cls: 'bg-amber-50 text-warning' },
  submitted: { label: 'Submitted', cls: 'bg-primary-light text-primary' },
  under_review: { label: 'Under review', cls: 'bg-primary-light text-primary' },
  qualified_post_utme: { label: 'Qualified for Post-UTME', cls: 'bg-primary-light text-primary' },
  not_qualified_post_utme: { label: 'Not qualified', cls: 'bg-red-50 text-danger' },
  post_utme_completed: { label: 'Post-UTME completed', cls: 'bg-primary-light text-primary' },
  recommended: { label: 'Recommended', cls: 'bg-primary-light text-primary' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-success' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-danger' },
  forwarded_jamb: { label: 'Forwarded to JAMB', cls: 'bg-primary-light text-primary' },
  admitted: { label: 'Admitted', cls: 'bg-green-50 text-success' },
  not_admitted: { label: 'Not admitted', cls: 'bg-red-50 text-danger' },
};

export const PAYMENT_STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-warning' },
  success: { label: 'Paid', cls: 'bg-green-50 text-success' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-danger' },
  abandoned: { label: 'Abandoned', cls: 'bg-primary-surface text-muted' },
  refunded: { label: 'Refunded', cls: 'bg-primary-surface text-muted' },
};

// The applicant-visible pipeline, in order, for the timeline component.
export const PIPELINE = [
  'submitted',
  'under_review',
  'qualified_post_utme',
  'post_utme_completed',
  'recommended',
  'approved',
  'forwarded_jamb',
  'admitted',
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
];

export const OLEVEL_TYPES = [
  { value: 'waec', label: 'WAEC' },
  { value: 'neco', label: 'NECO' },
  { value: 'nabteb', label: 'NABTEB' },
];

export function naira(n) {
  if (n == null) return '—';
  return '₦' + Number(n).toLocaleString('en-NG');
}

export function statusMeta(status) {
  return STATUS_META[status] || { label: status, cls: 'bg-primary-surface text-muted' };
}
