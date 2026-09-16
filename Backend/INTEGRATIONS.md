# TruEntry — Live integrations

How each external service is wired, and exactly what to set in production.

## Status at a glance

`GET /api/v1/health` reports the live/mock state of every integration:

```json
"integrations": {
  "paystack": "live",
  "paystackCallbackUrl": "https://www.truentry.org/payment/callback",
  "resend": "configured",
  "nin": "live (dojah)",
  "jamb": "stub",
  "waec": "stub"
}
```

Check this first after any deploy. If it says `mock` or `not-configured`, the
key did not reach the running process.

---

## 1. Paystack (LIVE)

| Variable | Value |
|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_live_…` |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_…` |
| `PAYSTACK_CALLBACK_URL` | `https://www.truentry.org/payment/callback` |

Defaults to `${FRONTEND_URL}/payment/callback` when unset.

**Payment capture works two ways, and you need both:**

1. **Browser redirect** — after checkout Paystack returns the applicant to
   `PAYSTACK_CALLBACK_URL?reference=…`, and the frontend calls
   `GET /payments/verify/:reference`.
2. **Webhook** — `POST /api/v1/payments/webhook`. Register this in the Paystack
   dashboard (Settings → API Keys & Webhooks). It is what saves you when the
   applicant closes the tab before being redirected back.

The webhook is authenticated by an HMAC-SHA512 signature over the raw body, not
a JWT. Invalid signatures get 401. Processing is idempotent.

> Fees are resolved per institution type from `fee_settings`, plus the
> second-sitting surcharge — not from a single global amount.

## 2. Dojah NIN (LIVE)

| Variable | Value |
|---|---|
| `DOJAH_APP_ID` | your app id |
| `DOJAH_SECRET_KEY` | your secret key |
| `DOJAH_BASE_URL` | `https://api.dojah.io` (default) |
| `DOJAH_MOCK` | leave **unset** in production |

**Important:** NIN goes live automatically once `DOJAH_APP_ID` and
`DOJAH_SECRET_KEY` are both present. Setting `DOJAH_MOCK=true` forces the
seeded mock records even when keys exist — only use that locally.

## 3. Exam results (STUBBED — by design)

JAMB, WAEC, NECO and NABTEB have no live contract yet, so they run against
seeded mock records behind the same interface the live client will implement:

| Variable | Value |
|---|---|
| `JAMB_MODE` | `stub` |
| `WAEC_MODE` | `stub` |

Mock candidates are seeded (JAMB `202512345678AB`, etc.) so the full applicant
journey can be exercised end to end. When the live APIs arrive, implement the
client and flip the mode — nothing else changes.

## 4. Email (Resend)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `MAIL_FROM_EMAIL` | e.g. `no-reply@truentry.org` |
| `MAIL_FROM_NAME` | `TruEntry` |
| `SUPPORT_EMAIL` | `support@truentry.org` |

A failed send never rolls back the action that triggered it; failures are
logged and institution credentials can be re-issued from the admin dashboard.

## 5. Core

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase **pooled** string, port 6543 (the direct 5432 host is IPv6-only and fails on Vercel) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | file storage only |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ chars each |
| `FRONTEND_URL` | `https://www.truentry.org` |
| `CORS_ORIGINS` | comma-separated allow-list |
