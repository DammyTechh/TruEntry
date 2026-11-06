-- ==========================================================================
-- 0009_app_settings.sql
--
-- A small key/value table for platform switches an admin can flip without a
-- redeploy. The first one is the testing switch:
--
--   test_mode_free_onboarding  true  → NIN is accepted without the Dojah lookup
--                                      and the exam-processing fee settles
--                                      without Paystack (see TEST_MODE.md)
--                              false → normal live behaviour
--
-- It starts ON so the team can test end to end. Turn it off from
-- Admin → Fees → Testing mode before going live.
--
-- The app also creates this table on first use, so this migration is optional,
-- but running it keeps the schema in one place. Idempotent: safe to re-run.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('test_mode_free_onboarding', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
