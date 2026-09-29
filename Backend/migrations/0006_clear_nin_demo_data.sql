-- ==========================================================================
-- 0006_clear_nin_demo_data.sql
--
-- NIN verification is LIVE through Dojah, so the seeded demo NIN records are
-- dead data. Worse, they are misleading: if DOJAH_MOCK were ever set by
-- mistake, those rows would let a fake NIN verify successfully.
--
-- The table itself is kept (local development can still opt into the mock by
-- setting DOJAH_MOCK=true and inserting its own rows), but it ships empty.
--
-- JAMB and WAEC/NECO/NABTEB demo records are deliberately LEFT IN PLACE —
-- those APIs are not yet available, and the seeded records are what allow the
-- applicant journey to be exercised end to end.
--
-- Idempotent: safe to re-run.
-- ==========================================================================

DELETE FROM mock_nin_records;

COMMENT ON TABLE mock_nin_records IS
  'Empty in production: NIN is verified live via Dojah. Local development only (DOJAH_MOCK=true).';

COMMENT ON TABLE mock_jamb_records IS
  'Demo JAMB records — in use until the live JAMB API is available (JAMB_API_MODE=stub).';

COMMENT ON TABLE mock_olevel_records IS
  'Demo WAEC/NECO/NABTEB records — in use until the live exam APIs are available (WAEC_API_MODE=stub).';
