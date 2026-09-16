'use strict';

const { Resend } = require('resend');
const config = require('../config');
const logger = require('../config/logger');

const resend = config.mail.resendApiKey ? new Resend(config.mail.resendApiKey) : null;
const FROM = `${config.mail.fromName} <${config.mail.fromEmail}>`;

// TruEntry brand system (aligned with the web app).
const BRAND = {
  primary: '#0B4DE0',
  primaryHover: '#0A45C9',
  primaryDark: '#001A66',
  primaryLight: '#EAF0FE',
  gradient: 'linear-gradient(135deg,#0A5CF5 0%,#0B4DE0 45%,#001A66 100%)',
  bg: '#F6F8FE',
  card: '#FFFFFF',
  border: '#E4E9F5',
  text: '#0B1533',
  muted: '#5A6484',
  success: '#15A34A',
  successBg: '#E7F6ED',
  danger: '#DC2626',
  dangerBg: '#FDECEC',
};

// Logo is served by the deployed frontend (public/brand). Falls back to alt text.
const LOGO_URL = `${config.urls.frontend}/brand/truentry-mark.png`;

const SOCIALS = [
  ['X', 'https://twitter.com'],
  ['LinkedIn', 'https://linkedin.com'],
  ['Instagram', 'https://instagram.com'],
];

/**
 * Branded, email-client-safe shell (table-based, inline styles).
 * @param {string} title
 * @param {string} innerHtml
 * @param {object} [opts] - { preheader }
 */
function layout(title, innerHtml, opts = {}) {
  const preheader = opts.preheader || title;
  const social = SOCIALS.map(
    ([label, href]) =>
      `<a href="${href}" style="color:${BRAND.muted};text-decoration:none;font-size:12px;font-weight:600;padding:0 8px;">${label}</a>`
  ).join('<span style="color:#C7CFE2;">·</span>');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:${BRAND.primary};background:${BRAND.gradient};border-radius:20px 20px 0 0;padding:30px 32px;text-align:center;">
        <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <img src="${LOGO_URL}" width="38" height="40" alt="TruEntry"
                 style="display:block;background:#ffffff;border-radius:10px;padding:6px;"/>
          </td>
          <td style="vertical-align:middle;padding-left:10px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.4px;">TruEntry</span>
          </td>
        </tr></table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:${BRAND.card};padding:38px 32px 30px;">
        <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:${BRAND.text};font-weight:800;">${title}</h1>
        <div style="font-size:15px;line-height:1.65;color:${BRAND.text};">${innerHtml}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:${BRAND.card};border-top:1px solid ${BRAND.border};border-radius:0 0 20px 20px;padding:22px 32px 26px;text-align:center;">
        <div style="margin-bottom:8px;">${social}</div>
        <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.6;">
          TruEntry — Admissions Quality Assurance Platform<br/>
          Need help? <a href="mailto:${config.mail.supportEmail}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${config.mail.supportEmail}</a>
        </p>
      </td></tr>

      <tr><td style="padding:18px 8px;text-align:center;">
        <p style="margin:0;color:#9AA3BE;font-size:11px;line-height:1.5;">
          © ${new Date().getFullYear()} TruEntry. All rights reserved.<br/>
          You're receiving this email because you have a TruEntry account.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ------------------------------- Helpers ------------------------------- */

function button(href, label) {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:26px auto;">
    <tr><td style="border-radius:12px;background:${BRAND.primary};background:${BRAND.gradient};">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
        ${label}</a>
    </td></tr></table>`;
}

function otpBlock(code) {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:${BRAND.primaryLight};border:1px solid ${BRAND.border};border-radius:14px;padding:18px 30px;">
      <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:${BRAND.primaryDark};font-family:'Courier New',monospace;">${code}</span>
    </td></tr></table>`;
}

function infoTable(rows) {
  const body = rows
    .map(
      ([label, value], i) =>
        `<tr>
          <td style="padding:12px 16px;color:${BRAND.muted};font-size:14px;${i ? `border-top:1px solid ${BRAND.border};` : ''}">${label}</td>
          <td style="padding:12px 16px;text-align:right;font-weight:700;color:${BRAND.text};font-size:14px;${i ? `border-top:1px solid ${BRAND.border};` : ''}">${value}</td>
        </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">${body}</table>`;
}

function statusPill(prettyStatus, tone = 'primary') {
  const map = {
    primary: [BRAND.primaryLight, BRAND.primaryDark],
    success: [BRAND.successBg, BRAND.success],
    danger: [BRAND.dangerBg, BRAND.danger],
  };
  const [bg, fg] = map[tone] || map.primary;
  return `<div style="text-align:center;margin:18px 0;">
    <span style="display:inline-block;background:${bg};color:${fg};padding:9px 22px;border-radius:999px;font-weight:700;font-size:14px;">${prettyStatus}</span>
  </div>`;
}

function toneForStatus(status) {
  const s = String(status || '').toLowerCase();
  if (['admitted', 'approved', 'recommended', 'qualified_post_utme', 'post_utme_completed'].includes(s)) return 'success';
  if (['rejected', 'not_admitted', 'not_qualified_post_utme'].includes(s)) return 'danger';
  return 'primary';
}

/**
 * Low-level send. Logs but never throws to the caller by default.
 */
async function send({ to, subject, html, replyTo }) {
  if (!resend) {
    logger.warn('Resend not configured — email skipped', { to, subject });
    return { skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo: replyTo || config.mail.supportEmail,
    });
    if (error) {
      logger.error('Email rejected by Resend (NOT delivered)', {
        to,
        subject,
        from: FROM,
        reason: error.message || error.name || String(error),
      });
      return { error: error.message || 'Email provider rejected the message' };
    }
    logger.info('Email sent', { to, subject, id: data?.id });
    return { data };
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    return { error: err.message };
  }
}

/* --------------------------- Templated emails --------------------------- */

async function sendVerificationOtp(to, name, code) {
  const html = layout(
    'Verify your email',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">Welcome to TruEntry! Use the code below to verify your account. It expires in
        ${config.security.otpExpiryMinutes} minutes.</p>
     ${otpBlock(code)}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">If you didn't create this account, you can safely ignore this email.</p>`,
    { preheader: `Your TruEntry verification code is ${code}` }
  );
  return send({ to, subject: 'Verify your TruEntry email', html });
}

async function sendPasswordResetOtp(to, name, code) {
  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">We received a request to reset your password. Enter this code to continue.
        It expires in ${config.security.otpExpiryMinutes} minutes.</p>
     ${otpBlock(code)}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">Didn't request this? Your account is still safe — just ignore this email.</p>`,
    { preheader: 'Your TruEntry password reset code' }
  );
  return send({ to, subject: 'Reset your TruEntry password', html });
}

async function sendWelcome(to, name) {
  const html = layout(
    'Welcome to TruEntry 🎓',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">Your account is verified. You can now complete your profile, verify your
        NIN, JAMB and O-Level records, and apply to your institution of choice.</p>
     ${button(config.urls.frontend + '/login', 'Go to your dashboard')}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">We're glad to have you on board.</p>`,
    { preheader: 'Your TruEntry account is ready.' }
  );
  return send({ to, subject: 'Welcome to TruEntry', html });
}

async function sendApplicationStatus(to, name, { institution, department, status, note }) {
  const pretty = String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const html = layout(
    'Application update',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">The status of your application to <strong>${department}</strong> at
        <strong>${institution}</strong> has changed to:</p>
     ${statusPill(pretty, toneForStatus(status))}
     ${note ? `<p style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;color:${BRAND.text};margin:14px 0;">${note}</p>` : ''}
     ${button(config.urls.frontend + '/login', 'View your application')}`,
    { preheader: `Your application is now: ${pretty}` }
  );
  return send({ to, subject: `TruEntry: Application ${pretty}`, html });
}

const PURPOSE_LABEL = {
  verification: 'exam processing',
  application: 'application',
  post_utme: 'Post-UTME',
};

async function sendPaymentReceipt(to, name, { reference, amount, purpose }) {
  const label = PURPOSE_LABEL[purpose] || String(purpose || 'application').replace(/_/g, ' ');
  const html = layout(
    'Payment received ✅',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">We've received your ${label} payment. Here's your receipt:</p>
     ${infoTable([
       ['Reference', reference],
       ['Amount', '₦' + Number(amount).toLocaleString()],
       ['Purpose', label.charAt(0).toUpperCase() + label.slice(1)],
       ['Status', 'Paid'],
     ])}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">Keep this receipt for your records.</p>`,
    { preheader: `Receipt for your ${label} payment — ₦${Number(amount).toLocaleString()}` }
  );
  return send({ to, subject: 'TruEntry payment receipt', html });
}

async function sendAdmissionLetter(to, name, { institution, department, letterUrl }) {
  const html = layout(
    'Congratulations! 🎉',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">You have been offered <strong>provisional admission</strong> to study
        <strong>${department}</strong> at <strong>${institution}</strong>.</p>
     ${statusPill('Admitted', 'success')}
     ${button(letterUrl, 'Download admission letter')}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">Congratulations once again from all of us at TruEntry.</p>`,
    { preheader: `You've been admitted to ${institution}!` }
  );
  return send({ to, subject: 'TruEntry: Provisional Admission Offer', html });
}

async function sendEscalation({ userEmail, subject, message }) {
  const html = layout(
    'New support escalation',
    `<p style="margin:0 0 6px;">A user escalated a chatbot conversation.</p>
     ${infoTable([
       ['From', userEmail],
       ['Subject', subject || 'General enquiry'],
     ])}
     <p style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;margin:6px 0 0;">${message}</p>`,
    { preheader: 'A user needs human support.' }
  );
  return send({ to: config.mail.supportEmail, subject: `[Escalation] ${subject || 'Support request'}`, html, replyTo: userEmail });
}

async function sendContactMessage(to, { fromName, fromEmail, subject, message }) {
  const html = layout(
    subject || 'New message',
    `<p style="margin:0 0 6px;">You have a new message from <strong>${fromName}</strong> (${fromEmail}):</p>
     <p style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;margin:6px 0 0;">${message}</p>`,
    { preheader: `New message from ${fromName}` }
  );
  return send({ to, subject: `TruEntry: ${subject || 'New message'}`, html, replyTo: fromEmail });
}

async function sendCredentials(to, name, { email, password, role }) {
  const html = layout(
    'Your TruEntry account',
    `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
     <p style="margin:0 0 6px;">An account has been created for you on TruEntry with the role
        <strong>${role}</strong>. Please sign in and change your password immediately.</p>
     ${infoTable([
       ['Email', email],
       ['Temporary password', password],
       ['Role', role],
     ])}
     ${button(config.urls.admin, 'Sign in to TruEntry')}
     <p style="color:${BRAND.danger};font-size:13px;margin:6px 0 0;">For your security, change this password right after your first sign-in.</p>`,
    { preheader: 'Your TruEntry staff account details' }
  );
  return send({ to, subject: 'Your TruEntry account credentials', html });
}

async function sendInstitutionCredentials(to, { institutionName, email: loginEmail, password, reissued = false }) {
  const title = reissued ? 'Your new TruEntry password' : 'Your TruEntry institution account';
  const lead = reissued
    ? `A new temporary password has been issued for <strong>${institutionName}</strong>. Your previous password no longer works.`
    : `An account has been created for <strong>${institutionName}</strong> on TruEntry. Use the credentials below to sign in and manage your admissions.`;

  const html = layout(
    title,
    `<p style="margin:0 0 6px;">${lead}</p>
     ${infoTable([
       ['Institution', institutionName],
       ['Sign-in email', loginEmail],
       ['Temporary password', password],
     ])}
     <div style="background:${BRAND.primaryLight};border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;margin:18px 0;">
       <strong style="color:${BRAND.primaryDark};">You must change this password on first sign-in.</strong>
       <div style="color:${BRAND.muted};font-size:13px;margin-top:4px;">
         For your security, this temporary password only works for setting a new one.
       </div>
     </div>
     ${button(config.urls.frontend + '/login', 'Sign in to TruEntry')}
     <p style="color:${BRAND.muted};font-size:13px;margin:6px 0 0;">
       If you did not expect this email, please contact ${config.mail.supportEmail}.
     </p>`,
    { preheader: `Sign-in details for ${institutionName}` }
  );
  return send({ to, subject: title, html });
}

/**
 * Sent when an applicant's JAMB and O'Level records have been verified, or when
 * verification could not be completed. This is the moment their institution
 * choices become available, so it is worth telling them explicitly.
 */
async function sendVerificationResult(to, name, { success, jambScore, choices = 0, error }) {
  const title = success ? 'Your credentials are verified' : 'We could not verify your credentials';

  const body = success
    ? `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
       <p style="margin:0 0 6px;">Your JAMB and O'Level records have been confirmed.</p>
       ${infoTable([
         ['JAMB score', jambScore ?? '—'],
         ['Institution choices available', choices],
       ])}
       <p style="margin:14px 0 0;">Your JAMB choices are now loaded — sign in to pick a course and complete your application.</p>
       ${button(config.urls.frontend + '/app/apply', 'Choose your course')}`
    : `<p style="margin:0 0 14px;">Hi ${name || 'there'},</p>
       <p style="margin:0 0 6px;">We were unable to verify your credentials with the details you supplied.</p>
       <div style="background:${BRAND.dangerBg};border:1px solid ${BRAND.border};border-radius:12px;padding:14px 16px;margin:14px 0;color:${BRAND.text};">
         ${error || 'The records could not be found.'}
       </div>
       <p style="margin:0 0 6px;">Please check your registration numbers and try again —
          <strong>you will not be charged a second time.</strong></p>
       ${button(config.urls.frontend + '/app/apply', 'Try again')}`;

  const html = layout(title, body, {
    preheader: success ? 'Your JAMB choices are ready.' : 'Verification could not be completed.',
  });
  return send({ to, subject: `TruEntry: ${title}`, html });
}

module.exports = {
  send,
  sendVerificationOtp,
  sendPasswordResetOtp,
  sendWelcome,
  sendApplicationStatus,
  sendPaymentReceipt,
  sendAdmissionLetter,
  sendEscalation,
  sendContactMessage,
  sendCredentials,
  sendInstitutionCredentials,
  sendVerificationResult,
};
