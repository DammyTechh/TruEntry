-- ==========================================================================
-- 0002_seed_admin.sql
-- Creates OR resets the super admin so you can always sign in.
-- Password is hashed inside Postgres with bcrypt (pgcrypto, cost 12),
-- which is verified correctly by the app's bcryptjs.compare().
--
-- Credentials seeded here:
--   email:    admin@truentry.org
--   password: TruEntry@2026
--
-- Idempotent: safe to run multiple times. Re-running RESETS the password
-- back to the value below (handy if it ever gets out of sync).
-- ==========================================================================

INSERT INTO users (email, password_hash, role, full_name, is_email_verified, is_active)
VALUES (
  'admin@truentry.org',
  crypt('TruEntry@2026', gen_salt('bf', 12)),
  'admin',
  'System Administrator',
  TRUE,
  TRUE
)
ON CONFLICT (email) DO UPDATE
  SET password_hash     = EXCLUDED.password_hash,
      role              = 'admin',
      is_email_verified = TRUE,
      is_active         = TRUE,
      updated_at        = NOW();
