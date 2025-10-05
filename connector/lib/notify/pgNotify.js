'use strict';

// Import required modules
const { Client } = require('pg');
const config = require('../config');
const logger = require('../logger');

let client; // Holds the PostgreSQL client instance

/**
 * Starts listening for PostgreSQL notifications on a specified channel.
 * @param {Function} onNotification - Callback to handle incoming notifications.
 */
async function start(onNotification) {
  // Initialize PostgreSQL client with configuration
  client = new Client({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  });

  // Listen for notification events from PostgreSQL
  client.on('notification', (msg) => {
    try {
      if (onNotification) {
        // Pass the notification payload to the provided handler
        onNotification(msg.payload);
      }
    } catch (err) {
      logger.error(`[pgNotify] notification handler error: ${err}, payload: ${msg.payload}`);
    }
  });

  // Handle client errors
  client.on('error', (err) => {
    logger.error(`[pgNotify] client error: ${err}`);
  });

  // Connect to the database and start listening on the configured channel
  await client.connect();
  await client.query(`LISTEN ${config.DB_CHANNEL}`);
  logger.info(`[pgNotify] Listening on channel ${config.DB_CHANNEL}`);
}

/**
 * Stops listening and closes the PostgreSQL client connection.
 */
async function stop() {
  try {
    if (client) {
      await client.end(); // Close the connection
      client = null;
    }
  } catch (err) {
    logger.error(`[pgNotify] stop error: ${err}`);
  }
}

// Export the start and stop functions
module.exports = { start, stop };
