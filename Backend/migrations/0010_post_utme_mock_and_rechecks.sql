-- ==========================================================================
-- 0010_post_utme_mock_and_rechecks.sql
--
-- Two gaps found while the team tried to rehearse a full admission cycle:
--
--   1. The "JAMB + Post-UTME average" admission rule could not be tested at
--      all. The rule was implemented, but nothing could put a Post-UTME score
--      on an application outside a multi-step officer flow with no screen, so
--      every candidate ranked with a Post-UTME of zero. There is now a mock
--      Post-UTME table alongside the JAMB and O'Level ones, and institutions
--      can type a score straight into the admissions list.
--
--   2. A candidate who changes course or institution at JAMB had no way to
--      pull the new choices through — verification ran once and the session
--      kept the stale snapshot forever. Re-checks are now recorded so the
--      history is auditable.
--
-- Idempotent: safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. MOCK POST-UTME SCORES
--    Keyed by JAMB registration number, the same handle the JAMB mock uses,
--    so one demo candidate lines up across all three regulator stubs.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mock_post_utme_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamb_reg_no   TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  score         NUMERIC(6,2) NOT NULL CHECK (score >= 0),
  max_score     NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  exam_year     INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mock_post_utme_reg ON mock_post_utme_records(jamb_reg_no);

DROP TRIGGER IF EXISTS trg_mock_post_utme_updated ON mock_post_utme_records;
CREATE TRIGGER trg_mock_post_utme_updated BEFORE UPDATE ON mock_post_utme_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The applications table keeps the score actually used for ranking. Record
-- where it came from so a demo score is never mistaken for a real one.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS post_utme_source TEXT
  CHECK (post_utme_source IN ('officer','mock','import'));

-- --------------------------------------------------------------------------
-- 2. JAMB RE-CHECKS
--    One row per re-pull of a candidate's JAMB record, so a change of course
--    or institution can be seen and explained afterwards.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jamb_recheck_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES application_sessions(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jamb_reg_no     TEXT,
  previous_score  NUMERIC(6,2),
  new_score       NUMERIC(6,2),
  previous_choices JSONB,
  new_choices     JSONB,
  changed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jamb_recheck_session ON jamb_recheck_log(session_id);

-- The JAMB registration number used for a session, so a re-check knows what
-- to look up without the applicant typing it again.
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS jamb_reg_no TEXT;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS last_rechecked_at TIMESTAMPTZ;

-- Backfill from the profile for sessions created before the column existed.
UPDATE application_sessions s
   SET jamb_reg_no = p.jamb_reg_no
  FROM applicant_profiles p
 WHERE p.user_id = s.applicant_id
   AND s.jamb_reg_no IS NULL
   AND p.jamb_reg_no IS NOT NULL;
