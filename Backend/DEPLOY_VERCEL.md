# Deploying the TruEntry backend to Vercel

This backend is an Express app. Vercel runs it as a **serverless function** via `api/index.js` (which exports the app) and `vercel.json` (which routes every request to it). `server.js` is only used for traditional/long-running hosts and is ignored by Vercel.

## 1. Required environment variables (Vercel → Project → Settings → Environment Variables)

```
NODE_ENV=production
DATABASE_URL=<Supabase POOLED connection string>   # see note below
DATABASE_SSL=true
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>

# Integrations (use mock/stub until live access is granted)
RESEND_API_KEY=<your resend key>
PAYSTACK_SECRET_KEY=<your paystack secret>
PAYSTACK_PUBLIC_KEY=<your paystack public>
DOJAH_MOCK=true
JAMB_API_MODE=stub
WAEC_API_MODE=stub
OPENAI_MOCK=true            # or OPENAI_API_KEY=<key>

# Optional
CORS_ORIGINS=https://truentry-frontend.vercel.app,https://www.truentry.org,https://truentry.org
FRONTEND_URL=https://truentry-frontend.vercel.app
```

> After changing env vars you must **redeploy** for them to take effect.

## 2. Use the Supabase POOLED connection string (important!)

Serverless functions open many short-lived connections. A direct Postgres
connection (host `db.<ref>.supabase.co`, port **5432**) will hit the connection
limit and error under load. Use the **pooled** connection string instead:

- In Supabase: **Project Settings → Database → Connection string → "Connection pooling" (Transaction mode)**.
- It looks like: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
- Note the host contains `pooler` and the port is **6543**.

Put that whole string in `DATABASE_URL` and keep `DATABASE_SSL=true`.

## 3. Run migrations & seed (once)

You cannot run `npm run migrate` on Vercel. Do it once from your machine (or the
office laptop) pointing at the Supabase database:

```bash
# locally, in the project folder
export DATABASE_URL="<your Supabase connection string>"   # direct or pooled both work for this one-off
export DATABASE_SSL=true
npm install
npm run migrate     # creates all tables + seeds mock JAMB/O-Level/NIN + categories
npm run seed        # creates the super admin + demo institutions
```

Alternatively, open the Supabase **SQL Editor** and paste the contents of
`migrations/0001_init.sql`, then run `npm run seed` locally for the admin user.

## 4. Verify

- `https://<your-backend>.vercel.app/api/v1/health` → should return `"status": "ok"`.
- `https://<your-backend>.vercel.app/api/v1/docs` → Swagger UI.

## Notes / limitations on serverless

- **Logging** is console-only on Vercel (the platform captures stdout). File-based
  rotating logs are automatically disabled — the read-only filesystem would
  otherwise crash the function. Nothing you need to change.
- **Rate limiting** is in-memory, so on serverless it's per-instance rather than
  global. Fine for now; move to a Redis store if you need strict global limits.
- **PDFs** (admission letters, reports) use pdfkit (pure JS) and work on serverless.
- If you'd rather run it as a normal always-on server (simpler for a stateful
  Express app), **Render**, **Railway**, or **Fly.io** are a great fit — just set
  the same env vars and use the start command `npm start`. No `api/` or
  `vercel.json` needed there.
