'use strict';

const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/ApiResponse');
const { authenticate } = require('../../middleware/auth.middleware');
const service = require('./admissionLetter.service');

const router = express.Router();
router.use(authenticate);

/**
 * Generate/return the admission letter. If storage is configured we return a
 * signed URL; otherwise we stream the PDF directly.
 */
router.get(
  '/:applicationId',
  asyncHandler(async (req, res) => {
    const result = await service.generate(req.params.applicationId, req.user);
    if (result.url) {
      return success(res, { message: 'Admission letter', data: { url: result.url, reference: result.reference } });
    }
    // Fallback: stream the PDF bytes.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.reference}.pdf"`);
    return res.send(result.buffer);
  })
);

module.exports = router;
