// connector/index.js
'use strict';

// Import configuration and dependencies
const config = require('./lib/config');
const db = require('./lib/db');
const pgNotify = require('./lib/notify/pgNotify');
const processor = require('./lib/processing/processor');
const metricsServer = require('./lib/metrics/server');
const logger = require('./lib/logger');

const PROCESS_BURST_LIMIT = parseInt(process.env.PROCESS_BURST_LIMIT || process.env.BURST_LIMIT || '5', 10);

/**
 * Drain a small burst of work from the outbox.
 * Runs sequential claims up to PROCESS_BURST_LIMIT.
 */
async function drainBurst() {
  for (let i = 0; i < PROCESS_BURST_LIMIT; i++) {
    try {
      const did = await processor.processClaimed();
      if (!did) break; // nothing left to process right now
    } catch (err) {
      // Processor errors are logged within processor; surface here too
      logger.error('[index] error while processing claimed work', err);
      // Back off slightly on unexpected errors to avoid tight error loops
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/**
 * Main entry point for the connector worker.
 * Initializes database, metrics server, notification listener, and polling loop.
 */
async function main() {
  try {
    // Initialize DB and models (ensures getModels() is usable)
    await db.initSequelize();
    logger.info('Sequelize initialized.');

    // Start metrics server for monitoring
    metricsServer.startMetricsServer();
    logger.info('Metrics server started');

    // Start PostgreSQL LISTEN/NOTIFY for real-time notifications
    await pgNotify.start(async (payload) => {
      logger.debug('notification received', { payload });
      // Quickly drain a small burst of work (configurable)
      await drainBurst();
    });

    // Fallback polling loop in case notifications are missed
    const pollInterval = setInterval(async () => {
      try {
        await processor.pollLoop();
      } catch (err) {
        logger.error('pollLoop error', err);
      }
    }, config.POLL_INTERVAL_MS);

    logger.info(`Worker ${config.WORKER_ID} started. Listening on ${config.DB_CHANNEL}`);

    // Graceful shutdown
    const shutdown = async (signal) => {
      try {
        logger.info(`Received ${signal}; shutting down gracefully...`);
        clearInterval(pollInterval);

        // Stop listening to notifications
        if (pgNotify && typeof pgNotify.stop === 'function') {
          await pgNotify.stop();
          logger.info('pgNotify stopped');
        }

        // Close Sequelize connection if present
        const sequelize = db.getSequelize();
        if (sequelize) {
          await sequelize.close();
          logger.info('Sequelize connection closed');
        }

        logger.info('Shutdown complete; exiting');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    // Fatal error during startup
    logger.error('Fatal startup error', err);
    process.exit(1);
  }
}

// Start the worker
main();
