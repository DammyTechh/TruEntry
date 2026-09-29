-- ==========================================================================
-- TruEntry — Admissions Quality Assurance Platform
-- Single consolidated migration for the entire system.
-- Target: PostgreSQL 14+ (Supabase compatible).
-- Idempotent: safe to run multiple times.
-- ==========================================================================

-- ---- Extensions -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- ---- Utility: auto-update updated_at ---------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- 1. INSTITUTION CATEGORIES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS institution_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- 2. INSTITUTIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS institutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE,
  category_id    UUID REFERENCES institution_categories(id) ON DELETE SET NULL,
  has_post_utme  BOOLEAN NOT NULL DEFAULT FALSE,
  email          CITEXT,
  phone          TEXT,
  address        TEXT,
  state          TEXT,
  logo_url       TEXT,
  letterhead_url TEXT,
  signature_url  TEXT,
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_institutions_category ON institutions(category_id);
CREATE INDEX IF NOT EXISTS idx_institutions_state ON institutions(state);

-- ==========================================================================
-- 3. USERS  (all roles)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              CITEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'applicant'
                     CHECK (role IN ('applicant','officer','registrar','jamb','admin')),
  full_name          TEXT NOT NULL,
  phone              TEXT,
  institution_id     UUID REFERENCES institutions(id) ON DELETE CASCADE,
  is_email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at      TIMESTAMPTZ,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Institution-scoped roles must carry an institution.
  CONSTRAINT chk_institution_scope CHECK (
    (role IN ('officer','registrar') AND institution_id IS NOT NULL)
    OR (role NOT IN ('officer','registrar'))
  )
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 4. OTP / EMAIL VERIFICATION / PASSWORD RESET
-- ==========================================================================
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('email_verify','password_reset')),
  token_hash  TEXT NOT NULL,          -- sha256 of OTP / token
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);

-- ---- Refresh tokens (revocable sessions) -----------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip_address  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ==========================================================================
-- 5. APPLICANT PROFILES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS applicant_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  entry_mode         TEXT CHECK (entry_mode IN ('utme','direct_entry')),
  nin                TEXT,
  nin_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  nin_data           JSONB,
  jamb_reg_no        TEXT,
  jamb_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  jamb_data          JSONB,
  olevel_exam_type   TEXT CHECK (olevel_exam_type IN ('waec','neco','nabteb')),
  olevel_reg_no      TEXT,
  olevel_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  olevel_data        JSONB,
  date_of_birth      DATE,
  gender             TEXT CHECK (gender IN ('male','female')),
  state_of_origin    TEXT,
  lga                TEXT,
  address            TEXT,
  location           TEXT,
  profile_image_url  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON applicant_profiles(state_of_origin);
DROP TRIGGER IF EXISTS trg_profiles_updated ON applicant_profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON applicant_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 6. DEPARTMENTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT,
  admission_quota INTEGER NOT NULL DEFAULT 0 CHECK (admission_quota >= 0),
  jamb_cutoff     NUMERIC(6,2) DEFAULT 0,
  post_utme_cutoff NUMERIC(6,2) DEFAULT 0,
  aggregate_cutoff NUMERIC(6,2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, name)
);
CREATE INDEX IF NOT EXISTS idx_departments_institution ON departments(institution_id);
DROP TRIGGER IF EXISTS trg_departments_updated ON departments;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 7. INSTITUTION ADMISSION PARAMETERS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS institution_parameters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
  admission_criteria  TEXT NOT NULL DEFAULT 'jamb_only'
                      CHECK (admission_criteria IN ('jamb_only','jamb_postutme_average')),
  min_jamb_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  min_post_utme_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  jamb_weight         NUMERIC(4,2) NOT NULL DEFAULT 0.5,   -- used when averaging
  post_utme_weight    NUMERIC(4,2) NOT NULL DEFAULT 0.5,
  total_quota         INTEGER NOT NULL DEFAULT 0,
  admission_open      BOOLEAN NOT NULL DEFAULT TRUE,
  session_label       TEXT,                                 -- e.g. "2025/2026"
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_params_updated ON institution_parameters;
CREATE TRIGGER trg_params_updated BEFORE UPDATE ON institution_parameters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 8. POLICIES  (institution or global)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS policies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE, -- NULL = global
  title          TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'editor' CHECK (source IN ('editor','pdf')),
  content_html   TEXT,          -- when composed in the editor
  pdf_url        TEXT,          -- when uploaded as pdf
  version        INTEGER NOT NULL DEFAULT 1,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policies_institution ON policies(institution_id);
DROP TRIGGER IF EXISTS trg_policies_updated ON policies;
CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 9. APPLICATIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         TEXT NOT NULL UNIQUE,
  applicant_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id     UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  entry_mode        TEXT CHECK (entry_mode IN ('utme','direct_entry')),
  jamb_score        NUMERIC(6,2),
  post_utme_score   NUMERIC(6,2),
  aggregate_score   NUMERIC(6,2),
  olevel_results    JSONB,      -- snapshot at application time
  status            TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN (
                      'draft','pending_payment','submitted','under_review',
                      'qualified_post_utme','not_qualified_post_utme',
                      'post_utme_completed','recommended','approved','rejected',
                      'forwarded_jamb','admitted','not_admitted')),
  policy_accepted   BOOLEAN NOT NULL DEFAULT FALSE,
  policy_id         UUID REFERENCES policies(id) ON DELETE SET NULL,
  payment_status    TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','success','failed','abandoned','refunded')),
  rank              INTEGER,
  decision_note     TEXT,
  recommended_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One active application per applicant per department.
  UNIQUE (applicant_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_institution ON applications(institution_id);
CREATE INDEX IF NOT EXISTS idx_applications_department ON applications(department_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
DROP TRIGGER IF EXISTS trg_applications_updated ON applications;
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- Application status history --------------------------------------------
CREATE TABLE IF NOT EXISTS application_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  note           TEXT,
  changed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_history_application ON application_status_history(application_id);

-- ==========================================================================
-- 10. POST-UTME
-- ==========================================================================
CREATE TABLE IF NOT EXISTS post_utme (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ,
  center         TEXT,
  score          NUMERIC(6,2),
  max_score      NUMERIC(6,2) DEFAULT 100,
  completed      BOOLEAN NOT NULL DEFAULT FALSE,
  responses      JSONB,          -- optional CBT payload
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_postutme_updated ON post_utme;
CREATE TRIGGER trg_postutme_updated BEFORE UPDATE ON post_utme
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 11. PAYMENTS  (Paystack)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      TEXT NOT NULL UNIQUE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  purpose        TEXT NOT NULL DEFAULT 'application'
                 CHECK (purpose IN ('application','post_utme')),
  provider       TEXT NOT NULL DEFAULT 'paystack',
  amount_kobo    BIGINT NOT NULL,       -- stored in kobo
  currency       TEXT NOT NULL DEFAULT 'NGN',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','success','failed','abandoned','refunded')),
  channel        TEXT,
  authorization_url TEXT,
  access_code    TEXT,
  gateway_response  TEXT,
  paid_at        TIMESTAMPTZ,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_application ON payments(application_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
DROP TRIGGER IF EXISTS trg_payments_updated ON payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- 12. ADMISSION LETTERS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS admission_letters (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  letter_number  TEXT NOT NULL UNIQUE,
  file_url       TEXT,
  signed_by      TEXT,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- 13. REPORTS  (audit-ready artifacts)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type    TEXT NOT NULL CHECK (report_type IN ('audit_ready','admitted_list','applicants_list')),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  params         JSONB,
  summary        JSONB,       -- aggregated stats
  file_url       TEXT,
  generated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_institution ON reports(institution_id);

-- ==========================================================================
-- 14. CHATBOT (OpenAI FAQ + escalation)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  title          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON chat_conversations(user_id);
DROP TRIGGER IF EXISTS trg_chatconv_updated ON chat_conversations;
CREATE TRIGGER trg_chatconv_updated BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  tokens          INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conversation ON chat_messages(conversation_id);

CREATE TABLE IF NOT EXISTS chat_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  email           CITEXT NOT NULL,
  subject         TEXT,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ==========================================================================
-- 15. NOTIFICATIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT DEFAULT 'info',
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

-- ==========================================================================
-- 16. AUDIT LOGS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  TEXT,
  action      TEXT NOT NULL,          -- e.g. 'application.approved'
  entity      TEXT,                   -- e.g. 'application'
  entity_id   UUID,
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ==========================================================================
-- 17. STUB / MOCK REGULATOR DATA  (JAMB, WAEC/NECO/NABTEB)
-- Serves demo data until official API access is granted. The integration
-- layer reads these tables so switching to live endpoints needs no logic change.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS mock_jamb_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamb_reg_no   TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  date_of_birth DATE,
  gender        TEXT,
  state_of_origin TEXT,
  jamb_score    NUMERIC(6,2) NOT NULL,
  subjects      JSONB,          -- [{subject, score}]
  exam_year     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_olevel_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type     TEXT NOT NULL CHECK (exam_type IN ('waec','neco','nabteb')),
  reg_no        TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  exam_year     INTEGER,
  results       JSONB NOT NULL,   -- [{subject, grade}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_type, reg_no)
);

CREATE TABLE IF NOT EXISTS mock_nin_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nin           TEXT NOT NULL UNIQUE,
  first_name    TEXT,
  last_name     TEXT,
  middle_name   TEXT,
  date_of_birth DATE,
  gender        TEXT,
  phone         TEXT,
  state_of_origin TEXT,
  photo         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- SEED DATA
-- ==========================================================================

-- ---- Institution categories -------------------------------------------------
INSERT INTO institution_categories (name, slug, description) VALUES
  ('Federal University', 'federal-university', 'Federal government owned universities'),
  ('State University', 'state-university', 'State government owned universities'),
  ('Private University', 'private-university', 'Privately owned universities'),
  ('Federal Polytechnic', 'federal-polytechnic', 'Federal polytechnics'),
  ('State Polytechnic', 'state-polytechnic', 'State polytechnics'),
  ('College of Education', 'college-of-education', 'Colleges of Education'),
  ('Monotechnic', 'monotechnic', 'Specialised monotechnic institutions')
ON CONFLICT (slug) DO NOTHING;

-- ---- Mock JAMB records ------------------------------------------------------
INSERT INTO mock_jamb_records (jamb_reg_no, full_name, date_of_birth, gender, state_of_origin, jamb_score, subjects, exam_year) VALUES
  ('202512345678AB', 'Chidinma Okafor', '2005-03-12', 'female', 'Anambra', 289,
   '[{"subject":"Use of English","score":72},{"subject":"Mathematics","score":75},{"subject":"Physics","score":70},{"subject":"Chemistry","score":72}]', 2025),
  ('202598765432CD', 'Emeka Balogun', '2004-11-02', 'male', 'Lagos', 254,
   '[{"subject":"Use of English","score":64},{"subject":"Biology","score":60},{"subject":"Chemistry","score":65},{"subject":"Physics","score":65}]', 2025),
  ('202511223344EF', 'Aisha Bello', '2006-06-21', 'female', 'Kano', 312,
   '[{"subject":"Use of English","score":78},{"subject":"Mathematics","score":80},{"subject":"Economics","score":77},{"subject":"Government","score":77}]', 2025),
  ('202555667788GH', 'Tunde Adeyemi', '2005-01-30', 'male', 'Oyo', 198,
   '[{"subject":"Use of English","score":50},{"subject":"Mathematics","score":48},{"subject":"Physics","score":50},{"subject":"Chemistry","score":50}]', 2025),
  ('202599887766IJ', 'Grace Etim', '2005-09-14', 'female', 'Cross River', 276,
   '[{"subject":"Use of English","score":70},{"subject":"Biology","score":68},{"subject":"Chemistry","score":69},{"subject":"Physics","score":69}]', 2025)
ON CONFLICT (jamb_reg_no) DO NOTHING;

-- ---- Mock O-level (WAEC/NECO/NABTEB) records --------------------------------
INSERT INTO mock_olevel_records (exam_type, reg_no, full_name, exam_year, results) VALUES
  ('waec', '4250101001', 'Chidinma Okafor', 2024,
   '[{"subject":"English Language","grade":"B2"},{"subject":"Mathematics","grade":"A1"},{"subject":"Physics","grade":"B3"},{"subject":"Chemistry","grade":"B2"},{"subject":"Biology","grade":"C4"}]'),
  ('waec', '4250101002', 'Emeka Balogun', 2024,
   '[{"subject":"English Language","grade":"C4"},{"subject":"Mathematics","grade":"C5"},{"subject":"Biology","grade":"B3"},{"subject":"Chemistry","grade":"C4"},{"subject":"Physics","grade":"C6"}]'),
  ('neco', 'N250201003', 'Aisha Bello', 2024,
   '[{"subject":"English Language","grade":"A1"},{"subject":"Mathematics","grade":"A1"},{"subject":"Economics","grade":"B2"},{"subject":"Government","grade":"B3"},{"subject":"Commerce","grade":"B2"}]'),
  ('nabteb', 'NB250301004', 'Tunde Adeyemi', 2024,
   '[{"subject":"English Language","grade":"C6"},{"subject":"Mathematics","grade":"C5"},{"subject":"Physics","grade":"C6"},{"subject":"Chemistry","grade":"C5"},{"subject":"Technical Drawing","grade":"B3"}]'),
  ('waec', '4250101005', 'Grace Etim', 2024,
   '[{"subject":"English Language","grade":"B2"},{"subject":"Mathematics","grade":"B3"},{"subject":"Biology","grade":"B2"},{"subject":"Chemistry","grade":"B3"},{"subject":"Physics","grade":"C4"}]')
ON CONFLICT (exam_type, reg_no) DO NOTHING;

-- ---- Mock NIN records -------------------------------------------------------
INSERT INTO mock_nin_records (nin, first_name, last_name, middle_name, date_of_birth, gender, phone, state_of_origin) VALUES
  ('12345678901', 'Chidinma', 'Okafor', 'Ada', '2005-03-12', 'Female', '08030000001', 'Anambra'),
  ('12345678902', 'Emeka', 'Balogun', 'Chukwu', '2004-11-02', 'Male', '08030000002', 'Lagos'),
  ('12345678903', 'Aisha', 'Bello', 'Zainab', '2006-06-21', 'Female', '08030000003', 'Kano'),
  ('12345678904', 'Tunde', 'Adeyemi', 'Ola', '2005-01-30', 'Male', '08030000004', 'Oyo'),
  ('12345678905', 'Grace', 'Etim', 'Idara', '2005-09-14', 'Female', '08030000005', 'Cross River')
ON CONFLICT (nin) DO NOTHING;

-- ==========================================================================
-- END OF MIGRATION
-- ==========================================================================
