'use strict';

const { query, queryOne, queryMany } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const { getPagination } = require('../../utils/pagination');
const aiService = require('../../services/ai.service');
const emailService = require('../../services/email.service');
const config = require('../../config');
const logger = require('../../config/logger');
const { CHAT_ROLES, ESCALATION_STATUS } = require('../../utils/constants');

async function ensureConversation(userId, conversationId) {
  if (conversationId) {
    const conv = await queryOne(
      'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (!conv) throw ApiError.notFound('Conversation not found');
    return conv;
  }
  return queryOne(
    'INSERT INTO chat_conversations (user_id) VALUES ($1) RETURNING *',
    [userId]
  );
}

async function loadHistory(conversationId, limit = 20) {
  const rows = await queryMany(
    `SELECT role, content FROM chat_messages WHERE conversation_id = $1
       ORDER BY created_at ASC LIMIT $2`,
    [conversationId, limit]
  );
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

/**
 * Post a message, get an AI reply, persist both.
 */
async function sendMessage(user, { conversationId, message }) {
  const conv = await ensureConversation(user.id, conversationId);
  await query(
    `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1,$2,$3)`,
    [conv.id, CHAT_ROLES.USER, message]
  );

  const history = await loadHistory(conv.id);

  // Provide institution context if the user belongs to one.
  let institutionContext = null;
  if (user.institutionId) {
    const inst = await queryOne('SELECT name FROM institutions WHERE id = $1', [user.institutionId]);
    if (inst) institutionContext = `The user is affiliated with ${inst.name}.`;
  }

  const reply = await aiService.chat({
    messages: history,
    institutionContext,
    user: { name: user.fullName, role: user.role },
  });

  await query(
    `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1,$2,$3)`,
    [conv.id, CHAT_ROLES.ASSISTANT, reply.content]
  );
  await query('UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1', [conv.id]);

  return {
    conversationId: conv.id,
    reply: reply.content,
    suggestion: reply.suggestEscalation ? 'You can escalate this to a human agent if needed.' : null,
    escalationSuggested: !!reply.suggestEscalation,
  };
}

async function listConversations(userId, q) {
  const { page, limit, offset } = getPagination(q);
  const rows = await queryMany(
    `SELECT c.*,
            (SELECT content FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM chat_conversations c WHERE c.user_id = $1
       ORDER BY c.updated_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const total = (await queryOne('SELECT COUNT(*)::int AS t FROM chat_conversations WHERE user_id = $1', [userId])).t;
  return {
    data: rows.map((c) => ({
      id: c.id,
      subject: c.subject,
      lastMessage: c.last_message,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    total, page, limit,
  };
}

async function getConversation(userId, id) {
  const conv = await queryOne('SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!conv) throw ApiError.notFound('Conversation not found');
  const messages = await queryMany(
    'SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [id]
  );
  return { id: conv.id, subject: conv.subject, messages };
}

/**
 * Escalate a conversation to a human agent via email.
 */
async function escalate(user, { conversationId, reason }) {
  const conv = await queryOne(
    'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
    [conversationId, user.id]
  );
  if (!conv) throw ApiError.notFound('Conversation not found');

  const messages = await queryMany(
    'SELECT role, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  const transcript = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');

  const escalation = await queryOne(
    `INSERT INTO chat_escalations (conversation_id, user_id, reason, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [conversationId, user.id, reason || null, ESCALATION_STATUS.OPEN]
  );

  try {
    await emailService.sendEscalation({
      userEmail: user.email,
      subject: reason || `Support request from ${user.fullName}`,
      message: transcript || 'User requested human assistance.',
    });
  } catch (err) {
    logger.error('Failed to email escalation', { error: err.message });
  }

  return { escalationId: escalation.id, status: escalation.status };
}

module.exports = { sendMessage, listConversations, getConversation, escalate };
