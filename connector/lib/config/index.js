'use strict';
// Load environment variables from .env file
require('dotenv').config();

// Helper function to get environment variable or default value
const getEnv = (key, defaultValue) => process.env[key] || defaultValue;

// Configuration object for the application
const config = {
  // Database connection settings
  DB_HOST: getEnv('DB_HOST', 'postgres'),
  DB_PORT: Number(getEnv('DB_PORT', '5432')),
  DB_USER: getEnv('DB_USER', 'postgres'),
  DB_PASSWORD: getEnv('DB_PASSWORD', 'postgres'),
  DB_NAME: getEnv('DB_NAME', 'health_tables'),
  DB_CHANNEL: getEnv('DB_CHANNEL', 'fhir_outbox_event'),

  // FHIR server endpoint (ensures trailing slash)
  FHIR_SERVER: `${getEnv('FHIR_SERVER', 'https://fhir-bootcamp.medblocks.com/fhir/').replace(/\/+$/, '')}/`,

  // Worker configuration
  WORKER_ID: getEnv('WORKER_ID', `worker-${Math.floor(Math.random() * 10000)}`),
  MAX_RETRIES: Number(getEnv('MAX_RETRIES', '5')),

  // Polling interval in milliseconds
  POLL_INTERVAL_MS: Number(getEnv('POLL_INTERVAL_MS', '2000'))
};

// Export the configuration object
module.exports = config;
