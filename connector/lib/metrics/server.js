'use strict';

// Import dependencies
const express = require('express');
const metrics = require('../metrics/metrics');
const logger = require('../logger');
const config = require('../config');
const { getSequelize, getModels, ensureInitialized, Sequelize } = require('../db');

// Metrics server configuration
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9464', 10);
const POLL_SECONDS = parseInt(process.env.METRICS_POLL_SECONDS || '10', 10);

// Ensure DB is initialized before starting metrics server
ensureInitialized().catch(err => {
  logger.error(`[metrics] Failed to initialize DB for metrics: ${err}`);
  process.exit(1);
});

// Get ORM models
const { Outbox, Dlq } = getModels();

/**
 * Updates metrics derived from the database using ORM models.
 */
async function updateDbDerivedMetrics() {
  const sequelize = getSequelize();
  if (!sequelize) return;

  try {
    // Calculate lag and unprocessed count for fhir_outbox
    const outboxRows = await Outbox.findAll({
      where: {
        processed: false,
        [Sequelize.Op.or]: [
          { next_retry_at: null },
          { next_retry_at: { [Sequelize.Op.lte]: new Date() } }
        ]
      },
      attributes: [
        [sequelize.fn('min', sequelize.col('created_at')), 'minCreatedAt'],
        [sequelize.fn('count', sequelize.col('*')), 'unprocessedCount']
      ],
      raw: true
    });

    let lag = 0;
    let count = 0;
    if (outboxRows && outboxRows.length) {
      const row = outboxRows[0];
      if (row.minCreatedAt) {
        lag = (Date.now() - new Date(row.minCreatedAt).getTime()) / 1000;
      }
      count = parseInt(row.unprocessedCount || 0, 10);
    }
    metrics.outboxLagSeconds.set(Number(lag));
    metrics.outboxUnprocessedCount.set(count);
    logger.debug(`[metrics] updated outbox metrics lag=${lag} count=${count}`);

    // Get DLQ size
    const dlqCount = await Dlq.count();
    metrics.dlqSize.set(dlqCount);

  } catch (err) {
    logger.error(`[metrics] updateDbDerivedMetrics error: ${err}`);
  }
}

/**
 * Starts the Prometheus metrics server.
 */
function startMetricsServer() {
  const app = express();

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', metrics.register.contentType);
      res.end(await metrics.register.metrics());
    } catch (ex) {
      res.status(500).end(ex.message);
    }
  });

  // Start server
  app.listen(METRICS_PORT, () => {
    logger.info(`[metrics] Prometheus metrics server listening on :${METRICS_PORT}`);
  });

  // Start polling for metrics
  updateDbDerivedMetrics();
  setInterval(updateDbDerivedMetrics, POLL_SECONDS * 1000);
}

module.exports = { startMetricsServer, updateDbDerivedMetrics };
