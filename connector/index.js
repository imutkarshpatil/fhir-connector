// connector/index.js
'use strict';

// Import configuration and dependencies
const config = require('./lib/config');
const { initSequelize } = require('./lib/db');
const pgNotify = require('./lib/notify/pgNotify');
const processor = require('./lib/processing/processor');
const metricsServer = require('./lib/metrics/server');
const logger = require('./lib/logger');

/**
 * Main entry point for the connector worker.
 * Initializes database, metrics server, notification listener, and polling loop.
 */
async function main() {
  try {
    // Initialize Sequelize (database connection)
    await initSequelize();
    logger.info('Sequelize initialized.');

    // Start metrics server for monitoring
    metricsServer.startMetricsServer();
    logger.info('Metrics server started');

    // Start PostgreSQL LISTEN/NOTIFY for real-time notifications
    await pgNotify.start(async (payload) => {
      logger.debug('notification received', { payload });
      // Quickly process up to 5 claimed jobs
      for (let i = 0; i < 5; i++) {
        const did = await processor.processClaimed();
        if (!did) break; // Stop if no more jobs to process
      }
    });

    // Fallback polling loop in case notifications are missed
    setInterval(async () => {
      try {
        await processor.pollLoop();
      } catch (err) {
        logger.error('pollLoop error', err);
      }
    }, config.POLL_INTERVAL_MS);

    logger.info(`Worker ${config.WORKER_ID} started. Listening on ${config.DB_CHANNEL}`);
  } catch (err) {
    // Fatal error during startup
    console.error('Fatal startup error', err);
    process.exit(1);
  }
}

// Start the worker
main();
