'use strict';

const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Persist an audit log entry. Fire-and-forget: failures never break the request.
 * Import and call from services after meaningful state changes.
 *
 * @param {object} opts
 * @param {object} [opts.req] - express request (for actor + ip + ua)
 * @param {string} opts.action - e.g. 'application.approved'
 * @param {string} [opts.entity]
 * @param {string} [opts.entityId]
 * @param {object} [opts.metadata]
 */
async function recordAudit({ req, action, entity, entityId, metadata }) {
  try {
    const actorId = req && req.user ? req.user.id : null;
    const actorRole = req && req.user ? req.user.role : null;
    const ip = req ? req.ip : null;
    const ua = req && req.headers ? req.headers['user-agent'] : null;

    await query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [actorId, actorRole, action, entity || null, entityId || null, ip, ua, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    logger.error('Failed to write audit log', { action, error: err.message });
  }
}

module.exports = { recordAudit };
