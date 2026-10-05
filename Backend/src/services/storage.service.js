'use strict';

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

let supabase = null;
if (config.supabase.url && config.supabase.serviceRoleKey) {
  supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Buckets that must exist. Created on first use if missing, so a fresh
// Supabase project does not silently fail every upload.
const PUBLIC_BUCKETS = new Set([config.supabase.buckets.profiles]);
const ensured = new Set();

/**
 * Make sure a bucket exists before uploading into it. A missing bucket is the
 * most common cause of upload failures on a new project, and the raw Supabase
 * error ("Bucket not found") never reaches the user.
 */
async function ensureBucket(bucket) {
  if (!supabase || ensured.has(bucket)) return;
  try {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: PUBLIC_BUCKETS.has(bucket),
      fileSizeLimit: 10 * 1024 * 1024,
    });
    // "already exists" is the expected outcome after the first run.
    if (error && !/exist/i.test(error.message || '')) {
      logger.warn('Could not ensure storage bucket', { bucket, error: error.message });
    } else {
      logger.info('Storage bucket ready', { bucket });
    }
  } catch (err) {
    logger.warn('Bucket check failed', { bucket, error: err.message });
  } finally {
    ensured.add(bucket);
  }
}

/**
 * Upload a buffer to a Supabase Storage bucket and return a public URL.
 * @param {object} opts
 * @param {string} opts.bucket - bucket key from config.supabase.buckets
 * @param {Buffer} opts.buffer
 * @param {string} opts.contentType
 * @param {string} [opts.folder]
 * @param {string} [opts.filename]
 * @returns {Promise<{path, url}>}
 */
async function upload({ bucket, buffer, contentType, folder = '', filename }) {
  if (!supabase) {
    throw ApiError.serviceUnavailable('File storage is not configured', { code: 'STORAGE_NOT_CONFIGURED' });
  }
  const ext = (contentType && contentType.split('/')[1]) || 'bin';
  const name = filename || `${uuidv4()}.${ext}`;
  const path = folder ? `${folder}/${name}` : name;

  await ensureBucket(bucket);

  let { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  // A bucket can disappear or be created after this process started; create it
  // and retry once rather than failing the applicant's upload.
  if (error && /bucket.*not.*found/i.test(error.message || '')) {
    ensured.delete(bucket);
    await ensureBucket(bucket);
    ({ error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    }));
  }

  if (error) {
    logger.error('Supabase upload failed', { bucket, path, error: error.message });
    // Surface the real reason — a generic message here has cost hours of
    // debugging in the past.
    throw ApiError.badGateway(`Could not upload file: ${error.message}`, {
      code: 'UPLOAD_FAILED',
      details: { bucket, reason: error.message },
    });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/**
 * Create a signed URL for private buckets (letters, reports).
 */
async function signedUrl(bucket, path, expiresIn = 3600) {
  if (!supabase) throw ApiError.serviceUnavailable('File storage is not configured');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw ApiError.badGateway('Could not create signed URL', { code: 'SIGN_URL_FAILED' });
  return data.signedUrl;
}

async function remove(bucket, path) {
  if (!supabase) return;
  await supabase.storage.from(bucket).remove([path]);
}

/** Verify storage is usable — used by the health endpoint. */
async function check() {
  if (!supabase) return { ok: false, reason: 'not-configured' };
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return { ok: false, reason: error.message };
    const names = (data || []).map((b) => b.name);
    const required = Object.values(config.supabase.buckets);
    const missing = required.filter((b) => !names.includes(b));
    return { ok: missing.length === 0, buckets: names, missing };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = {
  upload, signedUrl, remove, ensureBucket, check,
  buckets: config.supabase.buckets,
  isConfigured: () => !!supabase,
};
