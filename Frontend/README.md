# TruEntry — Frontend

React + Vite + Tailwind SPA for the TruEntry admissions platform. Talks to the
TruEntry backend API and is synced to its current contract.

## Backend it targets
- API base: `https://tru-entry.vercel.app/api/v1`  (note the hyphen in `tru-entry`)
- Response envelope: `{ success, message, data, meta, timestamp }` — read `res.data.data`
- Auth: JWT access + rotating refresh; login returns `data.user` + `data.tokens`
- Paystack returns to the frontend at `/payment/callback?reference=…`

## Setup
```bash
npm install
cp .env.example .env    # then set VITE_API_URL
npm run dev             # http://localhost:3000
npm run build           # production build -> dist/
```

## Environment (.env)
| var | purpose |
|-----|---------|
| `VITE_API_URL` | API base incl. `/api/v1`. Local: `http://localhost:5000/api/v1`. Prod: `https://tru-entry.vercel.app/api/v1` |
| `VITE_APP_NAME` | App name shown in UI |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key (redirect flow; key not strictly required client-side) |

## Deploy (Vercel)
- Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
- Set `VITE_API_URL=https://tru-entry.vercel.app/api/v1` in Project → Settings → Environment Variables.
- Add a SPA rewrite so client routes work on refresh (`vercel.json` below).
- In the backend, `CORS_ORIGINS` already allows `truentry-frontend.vercel.app`, `truentry.org`, `www.truentry.org`.
- In the backend, `PAYSTACK_CALLBACK_URL` must point at `<frontend>/payment/callback`.

## Portals
- **Public**: landing, institutions browse + detail, how-it-works, FAQ
- **Auth**: register, verify email (OTP), login, forgot/reset password
- **Applicant**: dashboard, profile + NIN/JAMB/O-Level verification, apply + pay, applications, payments
- **Institution** (officer/registrar): dashboard, applications + actions, decisioning, departments, reports, approvals
- **JAMB**: dashboard, applicants, awaiting-decision, admitted
- **Admin**: dashboard, users, institutions, finances, audit logs, mock data
