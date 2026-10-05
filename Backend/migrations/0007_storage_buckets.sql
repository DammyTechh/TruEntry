-- ==========================================================================
-- 0007_storage_buckets.sql
--
-- Creates the Supabase Storage buckets the platform writes to. Without these,
-- every upload fails with "Bucket not found" — which is what a fresh project
-- hits the moment an applicant submits a passport photograph.
--
--   profile-images     PUBLIC   passport photographs (served directly in the UI)
--   documents          private  uploaded O'Level / supporting documents
--   admission-letters  private  generated admission letter PDFs
--   reports            private  generated audit / admission report PDFs
--
-- Buckets live in Supabase's `storage` schema. This migration is a no-op on a
-- plain PostgreSQL database (local development without Supabase), so it is
-- safe to run everywhere.
--
-- Idempotent: safe to re-run.
-- ==========================================================================

DO $$
DECLARE
  has_storage BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) INTO has_storage;

  IF NOT has_storage THEN
    RAISE NOTICE 'Supabase storage schema not present — skipping bucket creation.';
    RETURN;
  END IF;

  -- Public bucket: passport photographs are rendered straight into the UI.
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'profile-images', 'profile-images', TRUE, 4194304,
    ARRAY['image/jpeg','image/png','image/webp']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = TRUE,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Private buckets: reached only through short-lived signed URLs.
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    ('documents',         'documents',         FALSE, 4194304,
      ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
    ('admission-letters', 'admission-letters', FALSE, 10485760, ARRAY['application/pdf']),
    ('reports',           'reports',           FALSE, 20971520,
      ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Storage buckets ready.';
END $$;

-- --------------------------------------------------------------------------
-- Read policy for the public bucket.
--
-- The API writes with the service-role key, which bypasses row level security,
-- so no write policies are needed. Public read is what lets an <img> tag load
-- a passport photograph without a signed URL.
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'Public read for profile images'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Public read for profile images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'profile-images')
    $pol$;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Not permitted to create storage policies here — create them in the Supabase dashboard if public images do not load.';
END $$;
