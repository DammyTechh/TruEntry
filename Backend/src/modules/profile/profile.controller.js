'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/ApiResponse');
const service = require('./profile.service');
const { recordAudit } = require('../../middleware/audit.middleware');

const getProfile = asyncHandler(async (req, res) => {
  const data = await service.getProfile(req.user.id);
  return success(res, { message: 'Profile', data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await service.updateProfile(req.user.id, req.body);
  return success(res, { message: 'Profile updated', data });
});

const verifyNin = asyncHandler(async (req, res) => {
  const data = await service.verifyNin(req.user.id, req.body.nin);
  await recordAudit({ req, action: 'profile.nin_verified', entity: 'user', entityId: req.user.id });
  return success(res, { message: 'NIN verified successfully', data });
});

const verifyJamb = asyncHandler(async (req, res) => {
  const data = await service.verifyJamb(req.user.id, req.body.jambRegNo);
  await recordAudit({ req, action: 'profile.jamb_verified', entity: 'user', entityId: req.user.id });
  return success(res, { message: 'JAMB details verified', data });
});

const verifyOlevel = asyncHandler(async (req, res) => {
  const data = await service.verifyOlevel(req.user.id, req.body.examType, req.body.regNo);
  await recordAudit({ req, action: 'profile.olevel_verified', entity: 'user', entityId: req.user.id });
  return success(res, { message: 'O-Level results verified', data });
});

const uploadImage = asyncHandler(async (req, res) => {
  const data = await service.uploadImage(req.user.id, req.file);
  return success(res, { message: 'Profile image uploaded', data });
});

const completion = asyncHandler(async (req, res) => {
  const data = await service.completion(req.user.id);
  return success(res, { message: 'Profile completion', data });
});

module.exports = {
  getProfile,
  updateProfile,
  verifyNin,
  verifyJamb,
  verifyOlevel,
  uploadImage,
  completion,
};
