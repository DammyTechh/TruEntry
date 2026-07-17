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

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    logger.error('Supabase upload failed', { bucket, path, error: error.message });
    throw ApiError.badGateway('Could not upload file', { code: 'UPLOAD_FAILED' });
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

module.exports = { upload, signedUrl, remove, buckets: config.supabase.buckets, isConfigured: () => !!supabase };
