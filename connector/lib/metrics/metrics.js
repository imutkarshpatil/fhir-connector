'use strict';

// Import prom-client for Prometheus metrics
const client = require('prom-client');

// Create a new registry for custom metrics
const register = new client.Registry();

// Collect default system metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

/**
 * Gauge: Age in seconds of the oldest unprocessed outbox event
 */
const outboxLagSeconds = new client.Gauge({
  name: 'fhir_outbox_lag_seconds',
  help: 'Age in seconds of the oldest unprocessed outbox event'
});

/**
 * Gauge: Number of unprocessed outbox rows
 */
const outboxUnprocessedCount = new client.Gauge({
  name: 'fhir_outbox_unprocessed_count',
  help: 'Number of unprocessed outbox rows'
});

/**
 * Gauge: Number of rows in the dead letter queue
 */
const dlqSize = new client.Gauge({
  name: 'fhir_dlq_total',
  help: 'Number of rows in the dead letter queue'
});

/**
 * Counter: Total number of outbox events successfully processed
 */
const processedTotal = new client.Counter({
  name: 'fhir_connector_processed_total',
  help: 'Total number of outbox events successfully processed'
});

/**
 * Counter: Total number of failed attempts (transient or permanent)
 */
const failedTotal = new client.Counter({
  name: 'fhir_connector_failed_total',
  help: 'Total number of failed attempts (transient or permanent)'
});

/**
 * Counter: Total number of FHIR API errors (HTTP 4xx/5xx)
 */
const fhirCallErrors = new client.Counter({
  name: 'fhir_call_errors_total',
  help: 'Total number of FHIR API errors (HTTP 4xx/5xx)'
});

/**
 * Histogram: FHIR API call latency in seconds
 * Buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
 */
const fhirCallLatency = new client.Histogram({
  name: 'fhir_call_latency_seconds',
  help: 'FHIR API call latency in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

// Register all custom metrics to the registry
register.registerMetric(outboxLagSeconds);
register.registerMetric(outboxUnprocessedCount);
register.registerMetric(dlqSize);
register.registerMetric(processedTotal);
register.registerMetric(failedTotal);
register.registerMetric(fhirCallErrors);
register.registerMetric(fhirCallLatency);

// Export metrics and registry for use in other modules
module.exports = {
  register,
  outboxLagSeconds,
  outboxUnprocessedCount,
  dlqSize,
  processedTotal,
  failedTotal,
  fhirCallErrors,
  fhirCallLatency
};
