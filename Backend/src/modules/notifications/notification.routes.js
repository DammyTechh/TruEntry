'use strict';

const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const { success, paginated } = require('../../utils/ApiResponse');
const { authenticate } = require('../../middleware/auth.middleware');
const { query, queryOne, queryMany } = require('../../config/database');
const { getPagination } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');

const router = express.Router();
router.use(authenticate);

function shape(n) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    read: n.read_at != null,
    readAt: n.read_at,
    data: n.data,
    createdAt: n.created_at,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const rows = await queryMany(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [req.user.id, limit, offset]
  );
  const total = (await queryOne('SELECT COUNT(*)::int AS t FROM notifications WHERE user_id = $1', [req.user.id])).t;
  return paginated(res, { message: 'Notifications', data: rows.map(shape), total, page, limit });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const unread = (await queryOne('SELECT COUNT(*)::int AS t FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id])).t;
  return success(res, { message: 'Unread count', data: { unread } });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const row = await queryOne(
    'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
    [req.params.id, req.user.id]
  );
  if (!row) throw ApiError.notFound('Notification not found');
  return success(res, { message: 'Marked read', data: shape(row) });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  return success(res, { message: 'All notifications marked read' });
}));

module.exports = router;
