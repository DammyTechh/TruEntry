'use strict';

const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/ApiResponse');
const validate = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const service = require('./chatbot.service');

const router = express.Router();
router.use(authenticate);

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2000),
});

const escalateSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

router.post('/message', validate({ body: sendSchema }), asyncHandler(async (req, res) => {
  const data = await service.sendMessage(req.user, req.body);
  return success(res, { message: 'Reply', data });
}));

router.get('/conversations', asyncHandler(async (req, res) => {
  const { data, total, page, limit } = await service.listConversations(req.user.id, req.query);
  return paginated(res, { message: 'Conversations', data, total, page, limit });
}));

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const data = await service.getConversation(req.user.id, req.params.id);
  return success(res, { message: 'Conversation', data });
}));

router.post('/escalate', validate({ body: escalateSchema }), asyncHandler(async (req, res) => {
  const data = await service.escalate(req.user, req.body);
  return success(res, { message: 'Conversation escalated to a human agent', data });
}));

module.exports = router;
