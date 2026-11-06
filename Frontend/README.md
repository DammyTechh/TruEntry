# TruEntry — Frontend

React + Vite + Tailwind SPA for the TruEntry admissions platform. Talks to the
TruEntry backend API and is synced to its current contract.

## Backend it targets
- API base: `/api/v1` on the site's own domain. `vercel.json` forwards it to
  `https://tru-entry.vercel.app/api/v1`, so the sign-in cookie is first-party
  (browsers that block third-party cookies were signing applicants out every
  15 minutes when the app called the backend domain directly).
- Response envelope: `{ success, message, data, meta, timestamp }` — read `res.data.data`
- Auth: JWT access + rotating refresh; login returns `data.user` + `data.tokens`
- Paystack returns to the frontend at `/payment/callback?reference=…`

## Setup
```bash
npm install
cp .env.example .env    # optional: set VITE_PROXY_TARGET for a local backend
npm run dev             # http://localhost:3000
npm run build           # production build -> dist/
```

## Environment (.env)
| var | purpose |
|-----|---------|
| `VITE_PROXY_TARGET` | Dev only: where `npm run dev` forwards `/api`. Default `https://tru-entry.vercel.app`; use `http://localhost:5000` for a local backend |
| `VITE_API_URL` | Dev only: absolute API base, if you don't want the proxy. Ignored in production builds |
| `VITE_API_DIRECT` | `true` makes a production build call `VITE_API_URL` directly instead of the `/api` proxy (not recommended) |
| `VITE_APP_NAME` | App name shown in UI |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key (redirect flow; key not strictly required client-side) |

## Deploy (Vercel)
- Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
- No API env var is needed: `vercel.json` proxies `/api/*` to the backend and rewrites everything else to the SPA.
- In the backend, `CORS_ORIGINS` already allows `truentry-frontend.vercel.app`, `truentry.org`, `www.truentry.org`.
- In the backend, `PAYSTACK_CALLBACK_URL` must point at `<frontend>/payment/callback`.

## Portals
- **Public**: landing, institutions browse + detail, how-it-works, FAQ
- **Auth**: register, verify email (OTP), login, forgot/reset password
- **Applicant**: dashboard, profile + NIN/JAMB/O-Level verification, apply + pay, applications, payments
- **Institution** (officer/registrar): dashboard, applications + actions, decisioning, departments, reports, approvals
- **JAMB**: dashboard, applicants, awaiting-decision, admitted
- **Admin**: dashboard, users, institutions, finances, audit logs, mock data
