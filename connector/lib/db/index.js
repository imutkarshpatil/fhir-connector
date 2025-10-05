// connector/lib/db/index.js
'use strict';

const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../logger');
const { defineModels } = require('./models');

let sequelize = null;
let models = {};
let initPromise = null;

/**
 * Initialize Sequelize connection and define models.
 * Safe to call multiple times; returns same promise if initialization in progress.
 */
async function initSequelize() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      sequelize = new Sequelize(
        config.DB_NAME,
        config.DB_USER,
        config.DB_PASSWORD,
        {
          host: config.DB_HOST,
          port: config.DB_PORT,
          dialect: 'postgres',
          logging: false,
          pool: { max: 5, min: 0, idle: 10000 }
        }
      );

      // Define models now (keeps definitions close to the instance)
      models = defineModels(sequelize);

      // Test connection
      await sequelize.authenticate();
      logger.info(`[db] Sequelize connected to ${config.DB_HOST}:${config.DB_PORT} as ${config.DB_USER}`);

      return { sequelize, models };
    } catch (err) {
      // Reset initPromise so a retry can be attempted by caller
      initPromise = null;
      logger.error(`[db] initSequelize failed for ${config.DB_HOST}:${config.DB_PORT} as ${config.DB_USER}`, err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Returns the Sequelize instance (or null if not initialized).
 */
function getSequelize() {
  return sequelize;
}

/**
 * Returns the defined models.
 * - If models are not yet defined but sequelize exists, define them lazily.
 * - If neither is initialized, throws a descriptive error.
 */
function getModels() {
  if (models && Object.keys(models).length > 0) {
    return models;
  }

  // If sequelize exists but models not defined (rare), define lazily
  if (sequelize) {
    models = defineModels(sequelize);
    return models;
  }

  throw new Error('Sequelize not initialized. Call and await initSequelize() before using models.');
}

/**
 * Helper to await initialization from other modules.
 * Example: await ensureInitialized();
 */
async function ensureInitialized() {
  if (initPromise) {
    await initPromise;
    return { sequelize, models };
  }
  // Not initialized yet — start initialization
  return await initSequelize();
}

module.exports = {
  initSequelize,
  getSequelize,
  getModels,
  ensureInitialized,
  Sequelize
};
