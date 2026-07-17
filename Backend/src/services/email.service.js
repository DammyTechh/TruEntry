'use strict';

const { Resend } = require('resend');
const config = require('../config');
const logger = require('../config/logger');

const resend = config.mail.resendApiKey ? new Resend(config.mail.resendApiKey) : null;
const FROM = `${config.mail.fromName} <${config.mail.fromEmail}>`;

// TruEntry brand colours: blue & white.
const BRAND = {
  primary: '#0B4DE0',
  primaryDark: '#001A66',
  bg: '#F4F7FE',
  text: '#1A2340',
  muted: '#6B7394',
};

/**
 * Wrap body content in the branded blue/white shell.
 */
function layout(title, innerHtml) {
  return `
  <div style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="text-align:center;padding:24px 0;">
        <span style="font-size:26px;font-weight:800;color:${BRAND.primaryDark};letter-spacing:-.5px;">
          Tru<span style="color:${BRAND.primary};">Entry</span>
        </span>
      </div>
      <div style="background:#ffffff;border-radius:14px;padding:32px;box-shadow:0 4px 20px rgba(11,77,224,.08);">
        <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND.text};">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">${innerHtml}</div>
      </div>
      <p style="text-align:center;color:${BRAND.muted};font-size:12px;margin-top:24px;">
        TruEntry — Admissions Quality Assurance Platform<br/>
        Need help? Contact <a href="mailto:${config.mail.supportEmail}" style="color:${BRAND.primary};">${config.mail.supportEmail}</a>
      </p>
    </div>
  </div>`;
}

function otpBlock(code) {
  return `<div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;background:${BRAND.bg};border:2px dashed ${BRAND.primary};
      border-radius:12px;padding:16px 28px;font-size:30px;font-weight:800;letter-spacing:8px;color:${BRAND.primaryDark};">
      ${code}
    </div></div>`;
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
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo: replyTo || config.mail.supportEmail,
    });
    logger.info('Email sent', { to, subject, id: result?.data?.id });
    return result;
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    return { error: err.message };
  }
}

/* --------------------------- Templated emails --------------------------- */

async function sendVerificationOtp(to, name, code) {
  const html = layout(
    'Verify your email',
    `<p>Hi ${name || 'there'},</p>
     <p>Use the code below to verify your TruEntry account. It expires in
        ${config.security.otpExpiryMinutes} minutes.</p>
     ${otpBlock(code)}
     <p style="color:${BRAND.muted};font-size:13px;">If you didn't create this account, you can ignore this email.</p>`
  );
  return send({ to, subject: 'Verify your TruEntry email', html });
}

async function sendPasswordResetOtp(to, name, code) {
  const html = layout(
    'Reset your password',
    `<p>Hi ${name || 'there'},</p>
     <p>We received a request to reset your password. Enter this code to continue.
        It expires in ${config.security.otpExpiryMinutes} minutes.</p>
     ${otpBlock(code)}
     <p style="color:${BRAND.muted};font-size:13px;">Didn't request this? Your account is still safe — just ignore this email.</p>`
  );
  return send({ to, subject: 'Reset your TruEntry password', html });
}

async function sendWelcome(to, name) {
  const html = layout(
    'Welcome to TruEntry 🎓',
    `<p>Hi ${name || 'there'},</p>
     <p>Your account is verified. You can now complete your profile, verify your
        credentials, and apply to your institution of choice.</p>
     <p style="text-align:center;margin:24px 0;">
       <a href="${config.urls.frontend}" style="background:${BRAND.primary};color:#fff;
          text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
          Go to Dashboard</a></p>`
  );
  return send({ to, subject: 'Welcome to TruEntry', html });
}

async function sendApplicationStatus(to, name, { institution, department, status, note }) {
  const pretty = String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const html = layout(
    'Application update',
    `<p>Hi ${name || 'there'},</p>
     <p>The status of your application to <strong>${department}</strong> at
        <strong>${institution}</strong> has changed to:</p>
     <p style="text-align:center;margin:16px 0;">
       <span style="display:inline-block;background:${BRAND.bg};color:${BRAND.primaryDark};
          padding:10px 20px;border-radius:20px;font-weight:700;">${pretty}</span></p>
     ${note ? `<p style="color:${BRAND.muted};">${note}</p>` : ''}
     <p style="text-align:center;margin-top:20px;">
       <a href="${config.urls.frontend}" style="color:${BRAND.primary};font-weight:600;">Check your dashboard →</a></p>`
  );
  return send({ to, subject: `TruEntry: Application ${pretty}`, html });
}

async function sendPaymentReceipt(to, name, { reference, amount, purpose }) {
  const html = layout(
    'Payment received ✅',
    `<p>Hi ${name || 'there'},</p>
     <p>We've received your ${purpose} payment. Here's your receipt:</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">
       <tr><td style="padding:8px 0;color:${BRAND.muted};">Reference</td>
           <td style="padding:8px 0;text-align:right;font-weight:600;">${reference}</td></tr>
       <tr><td style="padding:8px 0;color:${BRAND.muted};">Amount</td>
           <td style="padding:8px 0;text-align:right;font-weight:600;">₦${Number(amount).toLocaleString()}</td></tr>
     </table>`
  );
  return send({ to, subject: 'TruEntry payment receipt', html });
}

async function sendAdmissionLetter(to, name, { institution, department, letterUrl }) {
  const html = layout(
    'Congratulations! 🎉',
    `<p>Hi ${name || 'there'},</p>
     <p>You have been offered provisional admission to study <strong>${department}</strong>
        at <strong>${institution}</strong>.</p>
     <p style="text-align:center;margin:24px 0;">
       <a href="${letterUrl}" style="background:${BRAND.primary};color:#fff;text-decoration:none;
          padding:12px 28px;border-radius:8px;font-weight:600;">Download Admission Letter</a></p>`
  );
  return send({ to, subject: 'TruEntry: Provisional Admission Offer', html });
}

async function sendEscalation({ userEmail, subject, message }) {
  const html = layout(
    'New support escalation',
    `<p>A user escalated a chatbot conversation.</p>
     <table style="width:100%;border-collapse:collapse;margin:12px 0;">
       <tr><td style="padding:6px 0;color:${BRAND.muted};">From</td>
           <td style="padding:6px 0;font-weight:600;">${userEmail}</td></tr>
       <tr><td style="padding:6px 0;color:${BRAND.muted};">Subject</td>
           <td style="padding:6px 0;font-weight:600;">${subject || 'General enquiry'}</td></tr>
     </table>
     <p style="background:${BRAND.bg};padding:14px;border-radius:8px;">${message}</p>`
  );
  return send({ to: config.mail.supportEmail, subject: `[Escalation] ${subject || 'Support request'}`, html, replyTo: userEmail });
}

async function sendContactMessage(to, { fromName, fromEmail, subject, message }) {
  const html = layout(
    subject || 'New message',
    `<p>You have a new message from <strong>${fromName}</strong> (${fromEmail}):</p>
     <p style="background:${BRAND.bg};padding:14px;border-radius:8px;">${message}</p>`
  );
  return send({ to, subject: `TruEntry: ${subject || 'New message'}`, html, replyTo: fromEmail });
}

async function sendCredentials(to, name, { email, password, role }) {
  const html = layout(
    'Your TruEntry account',
    `<p>Hi ${name || 'there'},</p>
     <p>An account has been created for you on TruEntry with the role
        <strong>${role}</strong>. Sign in and change your password immediately.</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">
       <tr><td style="padding:8px 0;color:${BRAND.muted};">Email</td>
           <td style="padding:8px 0;text-align:right;font-weight:600;">${email}</td></tr>
       <tr><td style="padding:8px 0;color:${BRAND.muted};">Temporary password</td>
           <td style="padding:8px 0;text-align:right;font-weight:600;">${password}</td></tr>
     </table>
     <p style="text-align:center;margin:20px 0;">
       <a href="${config.urls.admin}" style="background:${BRAND.primary};color:#fff;text-decoration:none;
          padding:12px 28px;border-radius:8px;font-weight:600;">Sign in</a></p>`
  );
  return send({ to, subject: 'Your TruEntry account credentials', html });
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
};
