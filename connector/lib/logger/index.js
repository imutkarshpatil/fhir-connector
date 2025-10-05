'use strict';

// Import the pino logger library
const pino = require('pino');
// Import configuration settings
const config = require('../config');

// Create and configure the logger instance
const logger = pino({
  // Set log level from environment variable or default based on NODE_ENV
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Add base properties to every log message
  base: {
    service: 'fhir-connector', // Service name for identification
    worker_id: config.WORKER_ID // Worker ID from config
  },
  // Use ISO time format for timestamps
  timestamp: pino.stdTimeFunctions.isoTime
});

// Export the logger instance for use in other modules
module.exports = logger;
