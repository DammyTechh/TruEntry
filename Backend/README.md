# TruEntry — Backend API

**TruEntry** is a Tertiary Education Admissions Quality Assurance Platform for Nigeria. It Digitalizes, secures and automates the admissions pipeline end to end: applicant onboarding with identity/qualification verification (NIN, JAMB, WAEC/NECO/NABTEB), institution decisioning, registrar approval, JAMB regulatory audit and final admission, payments, and audit-ready reporting.

This repository is the **backend**: a Node.js + Express REST API (JavaScript, CommonJS) backed by PostgreSQL, documented with Swagger/OpenAPI.

---

## Tech stack

- **Runtime:** Node.js 18+ (tested on Node 22)
- **Framework:** Express 4
- **Database:** PostgreSQL (raw `pg` Pool, no ORM) — designed for Supabase Postgres
- **Auth:** JWT access/refresh tokens (rotating refresh, httpOnly cookie support)
- **Validation:** Zod
- **Docs:** swagger-jsdoc + swagger-ui-express (annotations live in `src/docs/`)
- **Logging:** Winston with daily-rotate files + Morgan HTTP logs
- **Security:** helmet, cors, hpp, express-rate-limit, bcrypt password hashing
- **Storage:** Supabase Storage (profile images, documents, admission letters, reports)
- **PDF:** pdfkit (pure JS — admission letters and audit reports)
- **Integrations:** Paystack (payments), Resend (email), Dojah (NIN), OpenAI (chatbot). JAMB and WAEC/NECO/NABTEB run as switchable stubs seeded with demo data.

## Architecture

Clean, modular, layered. Each domain is a self-contained module:

```
src/
  app.js                 Express app assembly (middleware, docs, routes, errors)
  config/                central config, logger, database pool, swagger spec
  middleware/            auth, rbac, validation, error handling, rate limit, audit, uploads
  utils/                 ApiError, ApiResponse, asyncHandler, jwt, security, pagination, constants
  services/              cross-cutting integrations: email, nin, regulator, payment, ai, storage, pdf
  modules/
    auth/                register, verify, login, tokens, password
    profile/             applicant onboarding + NIN/JAMB/O-Level verification
    institutions/        institutions, categories, departments, parameters, assets
    policies/            admission policy statements (editor HTML or PDF)
    applications/        full application lifecycle (applicant + officer + registrar)
    decision/            quota-aware ranking and selection
    payments/            Paystack initialize / verify / webhook
    admission-letters/   admission letter PDF generation
    reports/             audit-ready report PDF generation
    jamb/                regulator audit + final admission
    chatbot/             AI assistant + human escalation
    notifications/       in-app notifications
    admin/               dashboard, users, finances, audit logs, mock data
    health/              liveness + dependency status
  docs/                  Swagger JSDoc annotations, one file per area
  routes/index.js        aggregates all module routers under the API prefix
migrations/0001_init.sql Single consolidated, idempotent schema + seed data
scripts/migrate.js       Applies migrations
scripts/seed.js          Bootstraps super admin + demo institutions
server.js                Boot + graceful shutdown
```

Every module follows the same shape: `*.controller.js` (thin, HTTP only), `*.service.js` (business logic + SQL), `*.routes.js`, and `*.validator.js` where needed. Controllers return a consistent response envelope (`ApiResponse`) and throw typed errors (`ApiError`) that a single error handler normalises (including Postgres error codes).

## Roles

- `applicant` — applies, verifies identity/qualifications, pays, tracks status
- `officer` — institution admission officer: reviews, runs Post-UTME, recommends
- `registrar` — institution head: approves/rejects, forwards to JAMB
- `jamb` — regulator: audits applicants, makes final admission decisions
- `admin` — system administrator: onboarding, users, finances, audit, mock data

`officer` and `registrar` are always scoped to their `institution_id`.

## Application status flow

```
draft → pending_payment → submitted → under_review
      → qualified_post_utme → post_utme_completed
      → recommended → approved → forwarded_jamb → admitted
```
with terminal branches `not_qualified_post_utme`, `rejected`, `not_admitted`. Transitions are enforced in the service layer; every change is written to `application_status_history`.

## Decisioning

- Institutions **without** Post-UTME (`jamb_only`) rank purely on JAMB score.
- Institutions **with** Post-UTME (`jamb_postutme_average`) rank on the weighted average of normalised JAMB and Post-UTME scores.
- Selection is **quota-aware** per department, respecting JAMB/aggregate cutoffs and a minimum O-Level credit count. A preview endpoint shows selected/waitlisted/ineligible without writing; a run commits selections to `recommended`.

---

## Getting started

### 1. Prerequisites
- Node.js 18+ and npm
- A PostgreSQL database (e.g. Supabase)

### 2. Install
```bash
npm install
```

### 3. Configure
```bash
cp .env.example .env
# edit .env with your DATABASE_URL, JWT secrets, and integration keys
```
Key variables (see `.env.example` for the full list):
- `DATABASE_URL` — Postgres connection string
- `DATABASE_SSL` — `true` for Supabase/managed Postgres, `false` for local
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `RESEND_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `DOJAH_MOCK=true` and `JAMB_API_MODE=stub` / `WAEC_API_MODE=stub` to use seeded demo data
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`

### 4. Migrate & seed
```bash
npm run migrate   # applies migrations/0001_init.sql (idempotent)
npm run seed      # creates the super admin + demo institutions
```

### 5. Run
```bash
npm run dev       # development (nodemon)
npm start         # production
```

- API base: `http://localhost:5000/api/v1`
- Health: `GET /api/v1/health`
- **Interactive docs: `GET /api/v1/docs`** (OpenAPI JSON at `/api/v1/docs.json`)

---

## Seeded demo data

The migration seeds mock JAMB, O-Level and NIN records with aligned identities so the full flow can be exercised without live integrations:

| NIN | JAMB Reg | O-Level Reg | Name |
|-----|----------|-------------|------|
| 12345678901 | 202512345678AB | (waec) | Chidinma Okafor |
| 12345678902 | … | … | Emeka Balogun |
| 12345678903 | … | … | Aisha Bello |
| 12345678904 | … | … | Tunde Adeyemi |
| 12345678905 | … | … | Grace Etim |

The seed script also creates **University of Lagos** (with Post-UTME) and **Federal Polytechnic Nekede** (without Post-UTME), each with a Computer Science department, plus the super admin from `SEED_ADMIN_*`.

Switching to live integrations is a config change only (`DOJAH_MOCK=false`, `JAMB_API_MODE=live`, etc.) — no code changes.

## Payments

Application fees are collected via Paystack. `POST /payments/initialize` returns an authorization URL; `GET /payments/verify/:reference` confirms and moves the application from `pending_payment` to `submitted`. `POST /payments/webhook` is HMAC-verified against the raw request body and is idempotent.

## Security notes

- Passwords hashed with bcrypt; OTPs stored only as SHA-256 hashes.
- Access tokens are short-lived; refresh tokens are persisted, rotated on use, and revocable (per-session and all-sessions).
- Helmet, CORS allow-list, HPP, and tiered rate limiting on auth vs global.
- Institution-scoped roles cannot act across institutions (enforced in services).
- Every sensitive action is written to `audit_logs`.
- Secrets live in a git-ignored `.env`; only `.env.example` is committed.

## API surface (high level)

`/auth`, `/profile`, `/institutions` (+ categories, departments, parameters, assets), `/policies`, `/applications` (applicant + institution workflow), `/decisioning`, `/payments`, `/admission-letters`, `/reports`, `/jamb`, `/chatbot`, `/notifications`, `/admin`, `/health`.

See the Swagger UI at `/api/v1/docs` for the complete, parameter-level reference (75+ endpoints).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Start the server |
| `npm run dev` | Start with nodemon |
| `npm run migrate` | Apply the SQL migration |
| `npm run seed` | Bootstrap admin + demo data |
