-- ==========================================================================
-- 0011_olevel_recheck_and_admission_list.sql
--
--   1. O'Level re-checks, logged the same way JAMB re-checks are. Verification
--      snapshots a candidate's results, so a result corrected, released or
--      upgraded afterwards never reached the application — and neither did
--      the admission it should have earned.
--
--   2. An index to make the admission list quick to pull per cycle, now that
--      institutions generate it after every run.
--
-- Idempotent: safe to re-run.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS olevel_recheck_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES application_sessions(id) ON DELETE CASCADE,
  applicant_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_sittings  JSONB,
  new_sittings       JSONB,
  changed            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_olevel_recheck_session ON olevel_recheck_log(session_id);

-- Pulling "everyone admitted in this cycle, best first" is now a routine
-- query rather than an occasional one.
CREATE INDEX IF NOT EXISTS idx_applications_quota_status
  ON applications(quota_id, status);
