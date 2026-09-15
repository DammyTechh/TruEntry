-- ==========================================================================
-- 0003_institution_accounts_and_fees.sql
--
-- Phase 1 of the v2 workflow:
--   1. A single "institution" login per school (admin-onboarded).
--   2. Forced password change on first login (system-generated password).
--   3. Institution onboarding profile fields (region, LGA, logo, audit).
--   4. Institution TYPE (university | polytechnic | college_of_education)
--      derived for every existing category, with admission rules per type.
--   5. Platform fee settings keyed on TYPE: application fee plus the
--      second-sitting O'Level surcharge. Amounts in KOBO (integer money).
--
-- Idempotent: safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. USERS: 'institution' role + first-login password change flags
-- --------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('applicant','officer','registrar','institution','jamb','admin'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_institution_scope;
ALTER TABLE users ADD CONSTRAINT chk_institution_scope CHECK (
  (role IN ('officer','registrar','institution') AND institution_id IS NOT NULL)
  OR (role NOT IN ('officer','registrar','institution'))
);

-- Set when an account is created with a system-generated password. The API
-- forces a password change before any other action is permitted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at  TIMESTAMPTZ;

-- --------------------------------------------------------------------------
-- 2. INSTITUTIONS: onboarding profile fields
-- --------------------------------------------------------------------------
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS region       TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS lga          TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_institutions_region ON institutions(region);

-- --------------------------------------------------------------------------
-- 3. INSTITUTION TYPE on categories (+ admission rules per type)
--    Existing seeded categories (federal-university, state-polytechnic, …)
--    are mapped onto one of the three regulatory types.
-- --------------------------------------------------------------------------
ALTER TABLE institution_categories
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'university'
  CHECK (type IN ('university','polytechnic','college_of_education'));

ALTER TABLE institution_categories ADD COLUMN IF NOT EXISTS requires_jamb       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE institution_categories ADD COLUMN IF NOT EXISTS accepts_nabteb      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE institution_categories ADD COLUMN IF NOT EXISTS max_olevel_sittings SMALLINT NOT NULL DEFAULT 2;

-- Derive type from the existing slugs/names.
UPDATE institution_categories SET type = 'polytechnic'
  WHERE slug ILIKE '%polytechnic%' OR slug ILIKE '%monotechnic%'
     OR name ILIKE '%polytechnic%' OR name ILIKE '%monotechnic%';

UPDATE institution_categories SET type = 'college_of_education'
  WHERE slug ILIKE '%college%education%' OR slug ILIKE '%college-of-education%'
     OR name ILIKE '%college of education%';

UPDATE institution_categories SET type = 'university'
  WHERE type NOT IN ('polytechnic','college_of_education');

-- Regulatory rules per type:
--   • Colleges of Education no longer use JAMB as an admission criterion.
--   • Polytechnics and CoEs accept NABTEB; universities typically do not.
UPDATE institution_categories SET requires_jamb  = (type <> 'college_of_education');
UPDATE institution_categories SET accepts_nabteb = (type IN ('polytechnic','college_of_education'));

-- --------------------------------------------------------------------------
-- 4. PLATFORM FEE SETTINGS — one row per institution TYPE (admin-managed)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_type         TEXT NOT NULL UNIQUE
                           CHECK (institution_type IN ('university','polytechnic','college_of_education')),
  application_fee_kobo     INTEGER NOT NULL DEFAULT 250000 CHECK (application_fee_kobo >= 0),
  second_sitting_fee_kobo  INTEGER NOT NULL DEFAULT 100000 CHECK (second_sitting_fee_kobo >= 0),
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_fee_settings_updated ON fee_settings;
CREATE TRIGGER trg_fee_settings_updated BEFORE UPDATE ON fee_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO fee_settings (institution_type, application_fee_kobo, second_sitting_fee_kobo) VALUES
  ('university',           250000, 100000),   -- ₦2,500 + ₦1,000
  ('polytechnic',          200000, 100000),   -- ₦2,000 + ₦1,000
  ('college_of_education', 150000, 100000)    -- ₦1,500 + ₦1,000
ON CONFLICT (institution_type) DO NOTHING;
