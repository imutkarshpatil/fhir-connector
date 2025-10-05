// connector/lib/db/models.js
'use strict';

const { DataTypes } = require('sequelize');

/**
 * Initializes all Sequelize models used by the FHIR connector.
 * 
 * @param {Sequelize} sequelize - Sequelize instance
 * @returns {object} models - An object containing initialized Sequelize models
 */
function defineModels(sequelize) {
  /**
   * fhir_outbox — durable change events from triggers
   * Groups multiple DB changes under same txid + patient_id for atomic sync.
   */
  const Outbox = sequelize.define('fhir_outbox', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    txid: { type: DataTypes.BIGINT, allowNull: false },
    sequence_in_tx: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    table_name: { type: DataTypes.TEXT, allowNull: false },
    record_id: { type: DataTypes.INTEGER, allowNull: false },
    operation: { type: DataTypes.CHAR(1), allowNull: false }, // 'I', 'U', 'D'
    payload_json: { type: DataTypes.JSONB, allowNull: false },
    patient_id: { type: DataTypes.INTEGER },
    identifier_system: { type: DataTypes.TEXT },
    identifier_value: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    processed: { type: DataTypes.BOOLEAN, defaultValue: false },
    processed_at: { type: DataTypes.DATE },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    next_retry_at: { type: DataTypes.DATE },
    locked_by: { type: DataTypes.TEXT },
    lock_expires_at: { type: DataTypes.DATE },
    fhir_resource_id: { type: DataTypes.TEXT },
    fhir_version: { type: DataTypes.TEXT },
    last_error: { type: DataTypes.TEXT }
  }, {
    tableName: 'fhir_outbox',
    timestamps: false,
    indexes: [
      { fields: ['processed', 'next_retry_at', 'created_at'] },
      { fields: ['txid'] },
      { fields: ['patient_id'] },
      { fields: ['identifier_system', 'identifier_value'] }
    ]
  });

  /**
   * fhir_dlq — dead-letter queue
   * Holds permanently failed events after all retries exhausted.
   */
  const Dlq = sequelize.define('fhir_dlq', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    outbox_id: { type: DataTypes.BIGINT },
    txid: { type: DataTypes.BIGINT },
    table_name: { type: DataTypes.TEXT },
    record_id: { type: DataTypes.INTEGER },
    operation: { type: DataTypes.CHAR(1) },
    payload_json: { type: DataTypes.JSONB },
    error_text: { type: DataTypes.TEXT },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    first_failed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    last_failed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'fhir_dlq',
    timestamps: false,
    indexes: [{ fields: ['outbox_id'] }]
  });

  /**
   * fhir_processed_event — idempotency tracker
   * Records unique event keys to prevent double-processing.
   */
  const ProcessedEvent = sequelize.define('fhir_processed_event', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    event_key: { type: DataTypes.TEXT, unique: true },
    processed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'fhir_processed_event',
    timestamps: false,
    indexes: [{ fields: ['processed_at'] }]
  });

  return { Outbox, Dlq, ProcessedEvent };
}

module.exports = { defineModels };
