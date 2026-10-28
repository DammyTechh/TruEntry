-- ==========================================================================
-- 0008_departments_sittings_and_change_offers.sql
--
-- Four changes, all driven by live feedback on the prototype:
--
--   1. applicant_profiles.olevel_sittings
--      Onboarding lets an applicant record ONE or TWO O'Level sittings, but
--      only the first was ever persisted. The checkout therefore always priced
--      a single sitting and the second-sitting surcharge never appeared.
--
--   2. Per-department O'Level requirements
--      Institutions asked to type the O'Level requirements in while creating
--      the department, rather than only setting them once per admission cycle.
--
--   3. admission_change_offers
--      After every applicant has been considered against the department they
--      actually applied to, leftover seats are offered to candidates who meet
--      a different department's criteria — as an OFFER they must accept, with
--      a notification asking them to change course.
--
--   4. Department delete guard support (applications counted before deleting).
--
-- Idempotent: safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. O'LEVEL SITTINGS RECORDED AT ONBOARDING
--    Shape: [{ "examType": "waec", "regNo": "..." }, ...]  (1 or 2 entries)
--    These are RECORDS ONLY — verification happens after payment, which is
--    why the column is separate from olevel_data (the verified results).
-- --------------------------------------------------------------------------
ALTER TABLE applicant_profiles
  ADD COLUMN IF NOT EXISTS olevel_sittings JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from the single sitting that was previously stored, so applicants
-- who already onboarded keep their recorded result.
UPDATE applicant_profiles
   SET olevel_sittings = jsonb_build_array(
         jsonb_build_object('examType', olevel_exam_type, 'regNo', olevel_reg_no))
 WHERE olevel_sittings = '[]'::jsonb
   AND olevel_exam_type IS NOT NULL
   AND olevel_reg_no IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. PER-DEPARTMENT O'LEVEL REQUIREMENTS
--    Entered by the institution when the department is created or edited.
--    quota_olevel_requirements (0004) still applies institution-wide; these
--    are the course-specific subjects on top of it.
-- --------------------------------------------------------------------------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS min_credits   SMALLINT NOT NULL DEFAULT 5
  CHECK (min_credits >= 0 AND min_credits <= 9);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS max_sittings  SMALLINT NOT NULL DEFAULT 2
  CHECK (max_sittings BETWEEN 1 AND 2);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS olevel_notes  TEXT;

CREATE TABLE IF NOT EXISTS department_olevel_requirements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL,                 -- e.g. 'Mathematics'
  minimum_grade  TEXT NOT NULL DEFAULT 'C6',    -- A1..F9, ranked by olevel_grade_ranks
  is_compulsory  BOOLEAN NOT NULL DEFAULT TRUE, -- false = counts towards credits only
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_dept_olevel_req_department
  ON department_olevel_requirements(department_id);

-- --------------------------------------------------------------------------
-- 3. CHANGE-OF-COURSE OFFERS
--    Produced by the second pass of admissions processing: a department still
--    has seats, this candidate was not admitted to the course they applied
--    for, and they meet this department's criteria. The institution never
--    moves them silently — an offer is recorded and the applicant is asked to
--    accept the change of course.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_change_offers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_id            UUID NOT NULL REFERENCES admission_quotas(id) ON DELETE CASCADE,
  application_id      UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  from_department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id    UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,

  ranking_score       NUMERIC(6,2),
  admission_category  TEXT CHECK (admission_category IN ('national_merit','catchment','elds')),
  reason              TEXT,

  status              TEXT NOT NULL DEFAULT 'offered'
                      CHECK (status IN ('offered','accepted','declined','withdrawn','expired')),
  responded_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_offers_applicant ON admission_change_offers(applicant_id);
CREATE INDEX IF NOT EXISTS idx_change_offers_quota     ON admission_change_offers(quota_id);
CREATE INDEX IF NOT EXISTS idx_change_offers_status    ON admission_change_offers(status);

DROP TRIGGER IF EXISTS trg_change_offers_updated ON admission_change_offers;
CREATE TRIGGER trg_change_offers_updated BEFORE UPDATE ON admission_change_offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One live offer per application at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_change_offer_per_application
  ON admission_change_offers(application_id) WHERE status = 'offered';

-- --------------------------------------------------------------------------
-- 4. APPLICATION STATUS: a candidate holding an unanswered course-change offer
--    'change_offered' sits alongside the existing statuses so the applicant
--    dashboard and the institution list can both show it.
-- --------------------------------------------------------------------------
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN (
  'draft','pending_payment','submitted','under_review',
  'qualified_post_utme','not_qualified_post_utme',
  'post_utme_completed','recommended','approved','rejected',
  'forwarded_jamb','change_offered','admitted','not_admitted'));
