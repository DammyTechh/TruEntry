'use strict';

const multer = require('multer');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPES = ['application/pdf'];

function fileFilter(allowed) {
  return (_req, file, cb) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`, { code: 'UNSUPPORTED_FILE_TYPE' }));
  };
}

// Profile image: images only, max 4MB.
// Deliberately under Vercel's ~4.5MB request-body cap — a larger file is
// rejected by the platform before our code runs, which surfaces as an opaque
// gateway error rather than a useful message.
const uploadImage = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE_TYPES),
});

// Policy / documents: pdf only, max 4MB (same platform cap as above).
const uploadPdf = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: fileFilter(PDF_TYPES),
});

// Institution assets (logo, letterhead, signature): images, max 3MB.
const uploadAsset = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE_TYPES),
});

module.exports = { uploadImage, uploadPdf, uploadAsset };
