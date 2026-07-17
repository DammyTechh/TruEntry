'use strict';

const OpenAI = require('openai');
const config = require('../config');
const logger = require('../config/logger');

const openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null;

/**
 * System prompt teaching the assistant about TruEntry so it can guide users
 * through any part of the platform and answer admission FAQs.
 */
const BASE_SYSTEM_PROMPT = `You are TruBot, the official AI assistant for TruEntry — a Tertiary Education
Admissions Quality Assurance Platform for Nigeria. You help applicants, admission
officers, registrars, JAMB regulators and administrators.

You understand the full system:
- Applicants sign up, complete a profile (name, phone, email, NIN validated via
  Dojah, JAMB registration number, O-Level registration number for WAEC/NECO/NABTEB,
  location and a passport photo), then apply to an institution and department.
- Applying requires accepting the institution's policy statement and paying an
  application fee through Paystack.
- Institutions either admit on JAMB score only, or on the average of JAMB and
  Post-UTME scores when they run Post-UTME. Decisions are quota-aware per department.
- Application statuses progress: pending payment -> submitted -> under review ->
  qualified/not qualified for Post-UTME -> Post-UTME completed -> recommended ->
  approved/rejected -> forwarded to JAMB -> admitted/not admitted.
- Admitted applicants can download a provisional admission letter (PDF with
  e-signature and letterhead).
- JAMB can generate audit-ready reports per institution and department.

Guidelines:
- Be concise, friendly and accurate. Use plain language.
- Guide users step by step to the right dashboard action.
- If a question needs a human (payment dispute, a specific admission decision,
  account issues you cannot resolve), suggest escalating to support and mention
  they can use the "Talk to support" option, which emails support@truentry.org.
- Never invent admission decisions, scores, or policies. If you do not know a
  user-specific fact, say so and point them to their dashboard status page.
- Do not provide legal, medical, or unrelated advice.`;

/**
 * Deterministic mock reply for local/dev when OpenAI isn't configured or mocked.
 */
function mockReply(message) {
  const m = String(message).toLowerCase();
  if (m.includes('status')) {
    return 'You can track your application status on your dashboard under "My Applications". Statuses move from Submitted → Under Review → Qualified for Post-UTME (if required) → Recommended → Approved → Admitted.';
  }
  if (m.includes('pay') || m.includes('fee')) {
    return 'Application fees are paid securely via Paystack. After selecting an institution and department and accepting the policy statement, you will be redirected to complete payment. Once payment succeeds, your application is submitted automatically.';
  }
  if (m.includes('nin')) {
    return 'Your NIN is verified during onboarding using our identity partner (Dojah). Enter your 11-digit NIN in your profile and click "Verify".';
  }
  return 'I can help you with onboarding, verifying your NIN/JAMB/O-Level details, applying to an institution, payments, and checking your admission status. What would you like to do?';
}

/**
 * Generate an assistant reply given prior turns.
 * @param {object} opts
 * @param {Array<{role, content}>} opts.messages - conversation turns (user/assistant)
 * @param {string} [opts.institutionContext] - extra institution-specific info
 * @returns {Promise<{content, tokens}>}
 */
async function chat({ messages, institutionContext }) {
  const useMock = config.openai.mock || !openai;
  if (useMock) {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return { content: mockReply(last ? last.content : ''), tokens: 0 };
  }

  const systemPrompt = institutionContext
    ? `${BASE_SYSTEM_PROMPT}\n\nInstitution context:\n${institutionContext}`
    : BASE_SYSTEM_PROMPT;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 500,
    });
    const choice = completion.choices[0];
    return {
      content: choice.message.content.trim(),
      tokens: completion.usage ? completion.usage.total_tokens : null,
    };
  } catch (err) {
    logger.error('OpenAI chat failed', { error: err.message });
    // Graceful fallback so the chatbox never hard-fails for the user.
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return { content: mockReply(last ? last.content : ''), tokens: 0 };
  }
}

module.exports = { chat, BASE_SYSTEM_PROMPT };
