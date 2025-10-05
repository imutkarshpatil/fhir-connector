// connector/lib/db/index.js
'use strict';

// Import required modules
const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../logger');
const { defineModels } = require('./models');

// Sequelize instance and models container
let sequelize;
let models = {};

/**
 * Initializes Sequelize connection and defines models.
 * @returns {Promise<{sequelize: Sequelize, models: Object}>}
 */
async function initSequelize() {
  // Create Sequelize instance with configuration
  sequelize = new Sequelize(
    config.DB_NAME,
    config.DB_USER,
    config.DB_PASSWORD,
    {
      host: config.DB_HOST,
      port: config.DB_PORT,
      dialect: 'postgres',
      logging: false, // Disable SQL query logging
      pool: { max: 5, min: 0, idle: 10000 } // Connection pool settings
    }
  );

  // Define models using the Sequelize instance
  models = defineModels(sequelize);

  // Test database connection
  await sequelize.authenticate();
  logger.info('[db] Sequelize connected');

  return { sequelize, models };
}

/**
 * Returns the Sequelize instance.
 * @returns {Sequelize}
 */
function getSequelize() {
  return sequelize;
}

/**
 * Returns the defined models.
 * @returns {Object}
 */
function getModels() {
  return models;
}

// Export functions and Sequelize constructor
module.exports = {
  initSequelize,
  getSequelize,
  getModels,
  Sequelize
};
