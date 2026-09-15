-- ==========================================================================
-- 0004_quotas_and_admission_cycles.sql
--
-- The institution workspace: an admission cycle ("quota") carries every
-- parameter an institution sets before processing a year's admissions.
--
--   1. faculties                  — departments are grouped under a faculty
--   2. admission_quotas           — one row per admission cycle/session
--   3. quota_olevel_requirements  — minimum O'Level grades per subject group
--   4. quota_departments          — per-department allocation within a quota
--   5. quota_choice_preferences   — which JAMB choice positions may apply
--
-- Regulatory allocation (JAMB policy) lives on the quota itself:
--   National Merit 45% · Catchment Area 35% · Educationally Less Developed 20%
--
-- Idempotent: safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. FACULTIES  (a department belongs to a faculty)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, name)
);
CREATE INDEX IF NOT EXISTS idx_faculties_institution ON faculties(institution_id);
DROP TRIGGER IF EXISTS trg_faculties_updated ON faculties;
CREATE TRIGGER trg_faculties_updated BEFORE UPDATE ON faculties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE departments ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES faculties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_departments_faculty ON departments(faculty_id);

-- --------------------------------------------------------------------------
-- 2. ADMISSION QUOTAS  (one per admission cycle)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_quotas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,                      -- e.g. "Admissions 2026"
  session_label       TEXT,                               -- e.g. "2025/2026"

  total_applicants    INTEGER NOT NULL DEFAULT 0 CHECK (total_applicants >= 0),
  jamb_cutoff         NUMERIC(6,2) NOT NULL DEFAULT 0,

  application_start   DATE,
  application_end     DATE,

  -- Ranking rule used when processing admissions.
  admission_rule      TEXT NOT NULL DEFAULT 'jamb_only'
                      CHECK (admission_rule IN ('jamb_only','jamb_postutme_average')),

  -- Regulatory allocation. Enforced to total 100%.
  national_merit_pct  NUMERIC(5,2) NOT NULL DEFAULT 45 CHECK (national_merit_pct  >= 0 AND national_merit_pct  <= 100),
  catchment_pct       NUMERIC(5,2) NOT NULL DEFAULT 35 CHECK (catchment_pct       >= 0 AND catchment_pct       <= 100),
  elds_pct            NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (elds_pct            >= 0 AND elds_pct            <= 100),
  CONSTRAINT chk_allocation_total CHECK (national_merit_pct + catchment_pct + elds_pct = 100),

  -- How departmental seats were shared out.
  distribution_mode   TEXT NOT NULL DEFAULT 'auto' CHECK (distribution_mode IN ('auto','manual')),

  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','open','closed','processing','finished')),

  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, name),
  CONSTRAINT chk_quota_dates CHECK (application_end IS NULL OR application_start IS NULL OR application_end >= application_start)
);
CREATE INDEX IF NOT EXISTS idx_quotas_institution ON admission_quotas(institution_id);
CREATE INDEX IF NOT EXISTS idx_quotas_status      ON admission_quotas(status);
DROP TRIGGER IF EXISTS trg_quotas_updated ON admission_quotas;
CREATE TRIGGER trg_quotas_updated BEFORE UPDATE ON admission_quotas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Only one cycle may be open per institution at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_quota_per_institution
  ON admission_quotas(institution_id) WHERE status = 'open';

-- --------------------------------------------------------------------------
-- 3. O'LEVEL REQUIREMENTS  (minimum grades per subject group)
--    Grades are ordered by rank so "minimum B3" can be compared numerically.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_olevel_requirements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_id       UUID NOT NULL REFERENCES admission_quotas(id) ON DELETE CASCADE,
  subject_group  TEXT NOT NULL CHECK (subject_group IN ('core','trade','field')),
  minimum_grade  TEXT NOT NULL,                    -- A1, B2, B3, C4, C5, C6, D7, E8, F9
  min_credits    SMALLINT NOT NULL DEFAULT 5 CHECK (min_credits >= 0 AND min_credits <= 9),
  max_sittings   SMALLINT NOT NULL DEFAULT 2 CHECK (max_sittings BETWEEN 1 AND 2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quota_id, subject_group)
);
CREATE INDEX IF NOT EXISTS idx_olevel_req_quota ON quota_olevel_requirements(quota_id);

-- Canonical grade ranking (1 = best). Used by eligibility checks.
CREATE TABLE IF NOT EXISTS olevel_grade_ranks (
  grade TEXT PRIMARY KEY,
  rank  SMALLINT NOT NULL
);
INSERT INTO olevel_grade_ranks (grade, rank) VALUES
  ('A1',1),('B2',2),('B3',3),('C4',4),('C5',5),('C6',6),('D7',7),('E8',8),('F9',9)
ON CONFLICT (grade) DO NOTHING;

-- --------------------------------------------------------------------------
-- 4. DEPARTMENT ALLOCATION WITHIN A QUOTA
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_departments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_id       UUID NOT NULL REFERENCES admission_quotas(id) ON DELETE CASCADE,
  department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  allocated      INTEGER NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  admitted       INTEGER NOT NULL DEFAULT 0 CHECK (admitted  >= 0),
  is_selected    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quota_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_quota_departments_quota ON quota_departments(quota_id);
DROP TRIGGER IF EXISTS trg_quota_departments_updated ON quota_departments;
CREATE TRIGGER trg_quota_departments_updated BEFORE UPDATE ON quota_departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 5. ACCEPTED JAMB CHOICE POSITIONS
--    "Only students who picked us as 1st/2nd choice may apply."
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_choice_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_id        UUID NOT NULL REFERENCES admission_quotas(id) ON DELETE CASCADE,
  choice_position SMALLINT NOT NULL CHECK (choice_position BETWEEN 1 AND 4),
  UNIQUE (quota_id, choice_position)
);
CREATE INDEX IF NOT EXISTS idx_quota_choices_quota ON quota_choice_preferences(quota_id);

-- --------------------------------------------------------------------------
-- 6. LINK APPLICATIONS TO A CYCLE + RECORD THE JAMB CHOICE POSITION
-- --------------------------------------------------------------------------
ALTER TABLE applications ADD COLUMN IF NOT EXISTS quota_id        UUID REFERENCES admission_quotas(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS choice_position SMALLINT CHECK (choice_position BETWEEN 1 AND 4);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admission_category TEXT
  CHECK (admission_category IN ('national_merit','catchment','elds'));

CREATE INDEX IF NOT EXISTS idx_applications_quota ON applications(quota_id);

-- --------------------------------------------------------------------------
-- 7. CATCHMENT / ELDS STATE REGISTRY
--    Catchment states are per institution; ELDS states are national policy.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institution_catchment_states (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  state          TEXT NOT NULL,
  UNIQUE (institution_id, state)
);
CREATE INDEX IF NOT EXISTS idx_catchment_institution ON institution_catchment_states(institution_id);

CREATE TABLE IF NOT EXISTS elds_states (
  state TEXT PRIMARY KEY
);
-- The 'educationally less developed states' recognised by JAMB policy.
INSERT INTO elds_states (state) VALUES
  ('Adamawa'),('Bauchi'),('Bayelsa'),('Benue'),('Borno'),('Cross River'),('Ebonyi'),
  ('Gombe'),('Jigawa'),('Kaduna'),('Kano'),('Katsina'),('Kebbi'),('Kogi'),('Kwara'),
  ('Nasarawa'),('Niger'),('Plateau'),('Rivers'),('Sokoto'),('Taraba'),('Yobe'),('Zamfara')
ON CONFLICT (state) DO NOTHING;
