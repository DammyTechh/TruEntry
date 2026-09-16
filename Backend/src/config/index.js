'use strict';

require('dotenv').config();

/**
 * Central, validated configuration object.
 * Reading env vars anywhere else in the codebase is discouraged — import from here.
 */

const toBool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
};

const toInt = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
};

const toList = (v, def = []) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : def;

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  isTest: process.env.NODE_ENV === 'test',
  // True on Vercel / AWS Lambda style hosts (read-only fs, ephemeral, no listen()).
  isServerless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION),
  port: toInt(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  appName: process.env.APP_NAME || 'TruEntry',

  urls: {
    // Frontend app (custom domains truentry.org / www.truentry.org).
    frontend: process.env.FRONTEND_URL || 'https://truentry-frontend.vercel.app',
    admin: process.env.ADMIN_URL || 'https://www.truentry.org/admin',
    // This backend deployment.
    backend: process.env.BACKEND_URL || 'https://tru-entry.vercel.app',
  },

  corsOrigins: toList(process.env.CORS_ORIGINS, [
    // Frontend origins allowed to call this API.
    'https://truentry-frontend.vercel.app',
    'https://truentry.org',
    'https://www.truentry.org',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://truentry.org/api/v1',
  ]),

  db: {
    url: process.env.DATABASE_URL,
    ssl: toBool(process.env.DATABASE_SSL, true),
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    buckets: {
      profiles: process.env.SUPABASE_BUCKET_PROFILES || 'profile-images',
      documents: process.env.SUPABASE_BUCKET_DOCUMENTS || 'documents',
      letters: process.env.SUPABASE_BUCKET_LETTERS || 'admission-letters',
      reports: process.env.SUPABASE_BUCKET_REPORTS || 'reports',
    },
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  security: {
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 12),
    otpExpiryMinutes: toInt(process.env.OTP_EXPIRY_MINUTES, 10),
  },

  mail: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromName: process.env.MAIL_FROM_NAME || 'TruEntry',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'support@truentry.org',
    supportEmail: process.env.MAIL_SUPPORT_EMAIL || 'support@truentry.org',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    applicationFeeNgn: toInt(process.env.APPLICATION_FEE_NGN, 2500),
    // Where Paystack returns the applicant after checkout. Must match a route
    // in the frontend (see /payment/callback).
    callbackUrl:
      process.env.PAYSTACK_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'https://www.truentry.org'}/payment/callback`,
    // Live keys start with sk_live_ / pk_live_.
    isLive: String(process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_live_'),
  },

  dojah: {
    appId: process.env.DOJAH_APP_ID,
    secretKey: process.env.DOJAH_SECRET_KEY,
    baseUrl: process.env.DOJAH_BASE_URL || 'https://api.dojah.io',
    // Default to LIVE whenever credentials are configured, so production can
    // never silently fall back to seeded demo records. Set DOJAH_MOCK=true to
    // force the mock explicitly (useful in local development).
    mock: process.env.DOJAH_MOCK !== undefined
      ? toBool(process.env.DOJAH_MOCK, true)
      : !(process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    mock: toBool(process.env.OPENAI_MOCK, false),
  },

  regulators: {
    jambMode: process.env.JAMB_API_MODE || 'stub',
    waecMode: process.env.WAEC_API_MODE || 'stub',
    jambBaseUrl: process.env.JAMB_API_BASE_URL || '',
    jambApiKey: process.env.JAMB_API_KEY || '',
    waecBaseUrl: process.env.WAEC_API_BASE_URL || '',
    waecApiKey: process.env.WAEC_API_KEY || '',
  },

  rateLimit: {
    windowMinutes: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@truentry.org',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe_Admin123!',
    adminName: process.env.SEED_ADMIN_NAME || 'System Administrator',
  },
};

/**
 * Fail fast on missing critical config in production.
 */
function validate() {
  const missing = [];
  if (!config.db.url) missing.push('DATABASE_URL');

  if (config.isProd) {
    if (!config.jwt.accessSecret || config.jwt.accessSecret === 'dev-access-secret')
      missing.push('JWT_ACCESS_SECRET');
    if (!config.jwt.refreshSecret || config.jwt.refreshSecret === 'dev-refresh-secret')
      missing.push('JWT_REFRESH_SECRET');
  }

  if (missing.length) {
    const msg = `[config] Missing required environment variables: ${missing.join(', ')}`;
    // eslint-disable-next-line no-console
    console.error(`\n${msg}\n`);
    // On serverless we must not process.exit (it crashes the invocation opaquely);
    // throw instead so the platform surfaces a clear error. On a normal server in
    // production we exit so the process manager can restart with correct config.
    if (config.isProd && !config.isServerless) process.exit(1);
    if (config.isServerless && missing.includes('DATABASE_URL')) throw new Error(msg);
  }
}

config.validate = validate;

module.exports = config;
