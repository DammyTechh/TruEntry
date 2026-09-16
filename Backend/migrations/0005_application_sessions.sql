-- ==========================================================================
-- 0005_application_sessions.sql
--
-- Reworks the applicant journey to match the approved workflow:
--
--   onboarding (records only)
--        ↓
--   START APPLICATION  →  choose O'Level sitting type (one / two)
--        ↓
--   PAY  (exam processing fee + second-sitting surcharge when applicable)
--        ↓
--   VERIFY credentials (JAMB + O'Level) — paid for, so it runs after payment
--        ↓
--   JAMB choices populate from the verification response
--        ↓
--   Applicant picks an institution/course and completes the application
--
-- Verification costs money, so it is deliberately detached from onboarding.
-- One session covers one admission attempt and may spawn several applications
-- (one per JAMB choice the applicant pursues).
--
-- Idempotent: safe to re-run.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. PLATFORM VERIFICATION FEES (admin-managed, not per institution)
--    "Exam processing fee" + the surcharge for a second O'Level sitting.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_fee_settings (
  id                          BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- single row
  exam_processing_fee_kobo    INTEGER NOT NULL DEFAULT 2000000 CHECK (exam_processing_fee_kobo >= 0),  -- ₦20,000
  second_sitting_fee_kobo     INTEGER NOT NULL DEFAULT 1000000 CHECK (second_sitting_fee_kobo  >= 0),  -- ₦10,000
  updated_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_fee_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_fees_updated ON platform_fee_settings;
CREATE TRIGGER trg_platform_fees_updated BEFORE UPDATE ON platform_fee_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 2. APPLICATION SESSIONS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             TEXT NOT NULL UNIQUE,
  applicant_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  sitting_type          TEXT NOT NULL DEFAULT 'one' CHECK (sitting_type IN ('one','two')),

  -- Fee breakdown captured at purchase time (kobo), so a later price change
  -- never rewrites history.
  exam_processing_fee_kobo INTEGER NOT NULL DEFAULT 0,
  second_sitting_fee_kobo  INTEGER NOT NULL DEFAULT 0,
  total_fee_kobo           INTEGER NOT NULL DEFAULT 0,

  payment_id            UUID REFERENCES payments(id) ON DELETE SET NULL,
  payment_status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','success','failed','abandoned','refunded')),

  status                TEXT NOT NULL DEFAULT 'pending_payment'
                        CHECK (status IN (
                          'pending_payment',   -- created, awaiting Paystack
                          'paid',              -- money received, verification not started
                          'verifying',         -- verification in progress
                          'verified',          -- JAMB + O'Level confirmed, choices available
                          'verification_failed',
                          'completed',         -- at least one application submitted
                          'expired')),

  -- Verification outcome
  jamb_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  olevel_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  jamb_score            NUMERIC(6,2),
  -- Snapshot of the JAMB response: the institution/course choices the
  -- candidate already made when registering for JAMB.
  jamb_choices          JSONB,
  -- One entry per sitting: { examType, regNo, results: [{subject, grade}] }
  olevel_sittings       JSONB,
  verification_error    TEXT,
  verified_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_applicant ON application_sessions(applicant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status    ON application_sessions(status);

DROP TRIGGER IF EXISTS trg_sessions_updated ON application_sessions;
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON application_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- An applicant may only have one unpaid/in-flight session at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_applicant
  ON application_sessions(applicant_id)
  WHERE status IN ('pending_payment','paid','verifying');

-- --------------------------------------------------------------------------
-- 3. LINK APPLICATIONS AND PAYMENTS TO A SESSION
-- --------------------------------------------------------------------------
ALTER TABLE applications ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES application_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_applications_session ON applications(session_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES application_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);

-- Payments may now also be for verification, not just an application fee.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('application','post_utme','verification'));

-- --------------------------------------------------------------------------
-- 4. ELIGIBILITY SNAPSHOT ON APPLICATIONS
--    Records why an applicant was accepted or blocked at submission time.
-- --------------------------------------------------------------------------
ALTER TABLE applications ADD COLUMN IF NOT EXISTS eligibility JSONB;

-- --------------------------------------------------------------------------
-- 5. JAMB CHOICES ON THE STUBBED RECORDS
--    The live JAMB API returns the institution/course choices a candidate made
--    at registration. The stub mirrors that contract so the applicant flow can
--    be exercised end to end before the live integration exists.
--    Shape: [{ position, institution, code, course }]
-- --------------------------------------------------------------------------
ALTER TABLE mock_jamb_records ADD COLUMN IF NOT EXISTS choices JSONB;
