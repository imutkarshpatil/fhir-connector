'use strict';

// Import required modules
const { getSequelize, getModels, Sequelize, ensureInitialized } = require('../db');
const config = require('../config');
const mapper = require('../fhir/mapper');
const fhirClient = require('../fhir/client');
const metrics = require('../metrics/metrics');
const logger = require('../logger');

// Ensure DB is initialized
ensureInitialized().catch(err => {
  logger.error('Database initialization error', err);
  process.exit(1);
});

// Get Sequelize instance and models
const sequelize = () => getSequelize();
const { Outbox, Dlq, ProcessedEvent } = getModels();

/**
 * Sleep for the given milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Merge payload_json objects from multiple rows into a single object.
 * @param {Array} rows
 * @returns {Object}
 */
function mergePayloads(rows) {
  const merged = {};
  rows.sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of rows) {
    if (!row.payload_json) continue;
    Object.assign(merged, row.payload_json);
  }
  return merged;
}

/**
 * Determine if an HTTP status code is retryable.
 * @param {number|null} status
 * @returns {boolean}
 */
function isRetryableStatus(status) {
  if (!status) return true;
  return status >= 500 || status === 429;
}

/**
 * Claim a single outbox row for processing.
 * @returns {Promise<Object|null>}
 */
async function claimOneOutbox() {
  // Find one candidate row
  const candidate = await Outbox.findOne({
    where: {
      processed: false,
      [Sequelize.Op.or]: [
        { next_retry_at: null },
        { next_retry_at: { [Sequelize.Op.lte]: sequelize().fn('now') } }
      ],
      [Sequelize.Op.or]: [
        { locked_by: null },
        { lock_expires_at: { [Sequelize.Op.lte]: sequelize().fn('now') } }
      ]
    },
    order: [['created_at', 'ASC']]
  });

  if (!candidate) return null;

  // Claim the row
  await candidate.update({
    locked_by: config.WORKER_ID,
    lock_expires_at: sequelize().literal("now() + interval '30 seconds'")
  });

  return candidate.get({ plain: true });
}

/**
 * Claim all outbox rows in a group (same txid and patient).
 * @param {string} txid
 * @param {string|null} patientId
 * @returns {Promise<Array>}
 */
async function claimGroup(txid, patientId) {
  // Build a correct eligibility where (no duplicate keys)
  const nowFn = sequelize().fn('now');
  const eligibleWhere = {
    processed: false,
    txid,
    [Sequelize.Op.and]: [
      {
        // ready-to-retry condition
    [Sequelize.Op.or]: [
      { next_retry_at: null },
          { next_retry_at: { [Sequelize.Op.lte]: nowFn } }
        ]
      },
      {
        // available-to-lock condition
    [Sequelize.Op.or]: [
      { locked_by: null },
          { lock_expires_at: { [Sequelize.Op.lte]: nowFn } }
        ]
      }
    ]
  };

  // add patient id filter
  if (patientId === null) eligibleWhere.patient_id = null;
  else eligibleWhere.patient_id = patientId;

  // values to set when claiming
  const updateValues = {
      locked_by: config.WORKER_ID,
    // keep using literal if your codebase expects string SQL here
    lock_expires_at: sequelize().literal("now() + interval '30 seconds'")
  };

  // Try atomic UPDATE ... RETURNING (Postgres + Sequelize support)
  try {
    const [affectedCount, updatedRows] = await Outbox.update(updateValues, {
      where: eligibleWhere,
      returning: true // Postgres: returns the updated rows
    });

    if (Array.isArray(updatedRows) && updatedRows.length > 0) {
      return updatedRows.map(r => r.get({ plain: true }));
    }
    // If returning empty, fallthrough to fallback refetch
  } catch (err) {
    // Some Sequelize configs or dialects may not support returning; we'll fall back
    // (don't throw — we still try the safe refetch)
    logger.error(`claimGroup error: ${err}, txid: ${txid}, patientId: ${patientId}`);
  }

  // Fallback: refetch rows that were actually claimed by this worker.
  // IMPORTANT: this where does NOT reuse the old 'eligibleWhere' (which contained
  // a locked_by:null OR clause). We build a clean filter that looks for rows
  // locked_by our worker (AND processed=false, same txid/patient).
  const claimedWhere = {
    processed: false,
    txid,
    locked_by: config.WORKER_ID
  };
  if (patientId === null) claimedWhere.patient_id = null;
  else claimedWhere.patient_id = patientId;

  const claimedRows = await Outbox.findAll({ where: claimedWhere });
  return claimedRows.map(r => r.get({ plain: true }));
}

/**
 * Mark outbox rows as processed.
 * @param {Array<number>} ids
 * @param {string|null} fhirId
 * @param {string|null} fhirVersion
 * @returns {Promise<void>}
 */
async function markProcessed(ids, fhirId, fhirVersion) {
  if (!ids || ids.length === 0) return;
  await Outbox.update(
    {
      processed: true,
      processed_at: sequelize().fn('now'),
      fhir_resource_id: fhirId || null,
      fhir_version: fhirVersion || null,
      locked_by: null,
      lock_expires_at: null
    },
    {
      where: { id: ids }
    }
  );
}

/**
 * Mark an outbox row for retry after failure.
 * @param {number} id
 * @param {string} errText
 * @returns {Promise<void>}
 */
async function markRetry(id, errText) {
  const row = await Outbox.findByPk(id);
  if (!row) return;
  await row.update({
    attempts: row.attempts + 1,
    last_error: errText,
    next_retry_at: sequelize().literal("now() + (interval '1 minute' * greatest(attempts,1))"),
    locked_by: null,
    lock_expires_at: null
  });
  metrics.failedTotal.inc();
}

/**
 * Move an outbox row to the Dead Letter Queue (DLQ) after unretryable failure.
 * @param {number} id
 * @param {string} errText
 * @returns {Promise<void>}
 */
async function moveToDLQ(id, errText) {
  const row = await Outbox.findByPk(id);
  if (!row) return;
  // Create DLQ entry
  await Dlq.create({
    outbox_id: row.id,
    payload_json: row.payload_json,
    error_text: errText,
    moved_at: sequelize().fn('now')
  });
  // Remove from Outbox
  await row.destroy();
  metrics.failedTotal.inc();
}

/**
 * Process a claimed outbox group:
 * - Merge payloads
 * - Build FHIR Patient resource
 * - Send to FHIR server (conditional or by ID)
 * - Mark processed, retry, or move to DLQ as needed
 * @returns {Promise<boolean>} true if processed, false otherwise
 */
async function processClaimed() {
  const claimed = await claimOneOutbox();
  if (!claimed) return false;

  const txid = parseInt(claimed.txid, 10);
  const patientId = claimed.patient_id !== null ? parseInt(claimed.patient_id, 10) : null;
  const groupRows = await claimGroup(txid, patientId);
  if (!groupRows || groupRows.length === 0) {
    await markRetry(claimed.id, 'Empty group after claim');
    return false;
  }

  const merged = mergePayloads(groupRows);
  const eventKey = `${groupRows[0].table_name}|${groupRows[0].record_id}|${txid}`;

  // Build FHIR Patient resource from merged payload
  const patientResource = mapper.buildPatientResource(merged);

  // Determine FHIR URL for update (conditional or by ID)
  let fhirUrl = null;
  let useById = false;
  if (patientResource.identifier && patientResource.identifier.length > 0) {
    const id0 = patientResource.identifier[0];
    fhirUrl = { type: 'conditional', system: id0.system, value: id0.value, q: `${id0.system}|${id0.value}` };
  } else if (groupRows[0].fhir_resource_id) {
    useById = true;
    fhirUrl = { type: 'byId', id: groupRows[0].fhir_resource_id };
  } else {
    // No identifier available, move all group rows to DLQ
    const err = 'No identifier available for conditional update';
    logger.warn('[processor] ' + err);
    for (const row of groupRows) await moveToDLQ(row.id, err);
    return true;
  }

  try {
    // Send Patient resource to FHIR server
    let resp;
    if (fhirUrl.type === 'conditional') {
      resp = await fhirClient.conditionalPutPatient(fhirUrl.system, fhirUrl.value, patientResource);
    } else {
      resp = await fhirClient.putPatientById(fhirUrl.id, patientResource);
    }

    // Extract FHIR resource ID and version
    const fhirId = resp.data && resp.data.id ? resp.data.id : null;
    const fhirVersion = resp.data && resp.data.meta ? resp.data.meta.versionId : null;
    const ids = groupRows.map(row => row.id);

    // Mark all group rows as processed
    await markProcessed(ids, fhirId, fhirVersion);

    // ORM version of marking event processed
    await ProcessedEvent.create({ event_key: eventKey, processed_at: new Date() });

    metrics.processedTotal.inc(ids.length);
    logger.info('[processor] processed', { txid, count: ids.length, fhirId, fhirVersion });
    return true;
  } catch (err) {
    // Handle FHIR errors: retry or move to DLQ
    const status = err.response ? err.response.status : null;
    const errText = err.response && err.response.data ? JSON.stringify(err.response.data) : (err.message || 'unknown error');
    logger.error('[processor] FHIR error', { status, errText });

    if (isRetryableStatus(status)) {
      for (const row of groupRows) await markRetry(row.id, errText);
      logger.warn('[processor] scheduled retry', { txid });
    } else {
      for (const row of groupRows) await moveToDLQ(row.id, errText);
      logger.error('[processor] moved to DLQ', { txid, errText });
    }
    return false;
  }
}

/**
 * Poll loop to continuously process outbox events.
 * Sleeps briefly if nothing processed or on error.
 */
async function pollLoop() {
  try {
    const processed = await processClaimed();
    if (!processed) await sleep(500);
  } catch (err) {
    logger.error('[processor] pollLoop error', err);
    await sleep(1000);
  }
}

// Export main functions
module.exports = { processClaimed, pollLoop };
