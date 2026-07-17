'use strict';

/**
 * Serverless entry point for Vercel.
 *
 * Vercel does NOT run `server.js` / `app.listen()` — it imports this file and
 * invokes the exported Express app as a request handler. All the boot logic that
 * belongs to a long-running process (listen, graceful shutdown, file logging)
 * lives in `server.js` and is intentionally NOT used here.
 *
 * Requirements on Vercel (set these in Project → Settings → Environment Variables):
 *   NODE_ENV=production
 *   DATABASE_URL=...        (use the Supabase POOLED/Supavisor string — see README/notes)
 *   DATABASE_SSL=true
 *   JWT_ACCESS_SECRET=...
 *   JWT_REFRESH_SECRET=...
 *   plus the integration keys you use (RESEND_API_KEY, PAYSTACK_SECRET_KEY, ...)
 */
const app = require('../src/app');

module.exports = app;
