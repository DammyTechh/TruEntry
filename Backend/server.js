'use strict';

const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/config/logger');
const db = require('./src/config/database');

let server;

async function start() {
  // Fail fast on misconfiguration in production.
  config.validate();

  // Verify the database is reachable before accepting traffic.
  const health = await db.healthCheck().catch((err) => {
    logger.error('Database health check failed at startup', { error: err.message });
    return { ok: false };
  });
  if (!health.ok && config.isProd) {
    logger.error('Refusing to start without a healthy database in production');
    process.exit(1);
  }

  server = app.listen(config.port, () => {
    logger.info(`TruEntry API listening on port ${config.port}`, {
      env: process.env.NODE_ENV || 'development',
      docs: `${config.urls.backend}${config.apiPrefix}/docs`,
    });
  });
}

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      try {
        await db.close();
      } catch (err) {
        logger.error('Error closing database pool', { error: err.message });
      }
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force-exit if it hangs.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason && reason.message ? reason.message : reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
