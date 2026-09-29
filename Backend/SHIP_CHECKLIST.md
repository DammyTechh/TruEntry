# TruEntry — Go-live checklist

## 1. Run migrations, in order

```
0001_init.sql
0002_seed_admin.sql
0003_institution_accounts_and_fees.sql
0004_quotas_and_admission_cycles.sql
0005_application_sessions.sql
```

All are idempotent — safe to re-run. Use the Supabase **pooled** connection
(port 6543); the direct host is IPv6-only and fails on Vercel.

## 2. Backend environment (Vercel → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres` (encode `@` in the password as `%40`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 32+ random chars each |
| `FRONTEND_URL` | `https://www.truentry.org` |
| `CORS_ORIGINS` | `https://www.truentry.org,https://truentry.org,https://truentry-frontend.vercel.app` |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_…` |
| `PAYSTACK_CALLBACK_URL` | `https://www.truentry.org/payment/callback` |
| `DOJAH_APP_ID` / `DOJAH_SECRET_KEY` | your live credentials |
| `DOJAH_MOCK` | **leave unset** — setting it to `true` forces demo records |
| `RESEND_API_KEY` | `re_…` |
| `MAIL_FROM_EMAIL` / `MAIL_FROM_NAME` | e.g. `no-reply@truentry.org` / `TruEntry` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | file storage only |

## 3. Register the Paystack webhook

Paystack dashboard → Settings → API Keys & Webhooks → Webhook URL:

```
https://<your-api-domain>/api/v1/payments/webhook
```

**This is not optional.** The browser redirect can be lost (applicant closes the
tab, network drops); the webhook is what guarantees the payment is recorded.
It is authenticated by HMAC-SHA512 over the raw body, and is idempotent.

## 4. Frontend environment

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-api-domain>/api/v1` |
| `VITE_APP_NAME` | `TruEntry` |

Vercel: Framework **Vite**, build `npm run build`, output `dist`.
`vercel.json` already supplies the SPA rewrite and cache headers.

## 5. Verify after deploy

Open `GET /api/v1/health` and confirm:

```json
"paystack": "live",
"nin": "live (dojah)",
"jamb": "stub",
"waec": "stub"
```

If anything reads `mock` or `not-configured`, the key did not reach the running
process — fix that before opening to applicants.

Then change the seeded admin password (`admin@truentry.org` / `TruEntry@2026`).

## 6. What is live vs stubbed

| Service | State | Notes |
|---|---|---|
| Paystack | **live** | initialize, verify, webhook |
| Dojah NIN | **live** | demo NIN records are cleared by migration 0006 |
| Resend email | **live** | 13 templates; a failed send never rolls back the action |
| Supabase storage | **live** | passport photos, documents, generated PDFs |
| JAMB | stubbed | seeded records, awaiting their API (`JAMB_API_MODE=stub`) |
| WAEC / NECO / NABTEB | stubbed | seeded records, awaiting their API (`WAEC_API_MODE=stub`) |
| AI chatbot | **canned replies** | set `OPENAI_API_KEY` to make it live; without it the support chat answers from a small scripted set. Nothing else depends on it. |

Manage the seeded exam records under **Admin → Mock data** (JAMB and O'Level
only; NIN has no demo path because it is live).

## 7. Smoke test on production before announcing

1. Register an applicant, complete onboarding.
2. Start an application → pay with a **real card for a small amount** → confirm
   the redirect lands on `/payment/callback` and the payment shows as settled.
3. Verify credentials with a **real NIN** and a seeded JAMB/O'Level record.
4. Confirm the applicant receives: verification OTP, payment receipt,
   verification result, and the application status email.
