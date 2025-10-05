'use strict';

// Import required modules
const axios = require('axios');
const config = require('../config');
const metrics = require('../metrics/metrics');
const logger = require('../logger');

// Create an Axios client instance for FHIR server requests
const client = axios.create({
  baseURL: config.FHIR_SERVER,
  timeout: 15000, // 15 seconds timeout
  headers: { 'Content-Type': 'application/fhir+json' }
});

/**
 * Conditionally creates or updates a Patient resource based on identifier.
 * Uses FHIR conditional PUT: https://www.hl7.org/fhir/http.html#cond-put
 * @param {string} system - Identifier system (e.g., 'urn:oid:1.2.36.146.595.217.0.1')
 * @param {string} value - Identifier value
 * @param {Object} body - Patient resource body
 * @returns {Promise<Object>} - Axios response object
 */
async function conditionalPutPatient(system, value, body) {
  // Encode identifier for URL
  const q = encodeURIComponent(`${system}|${value}`);
  const url = `Patient?identifier=${q}`;
  const start = Date.now();

  try {
    // Perform conditional PUT request
    const resp = await client.put(url, body);
    // Record latency metric
    const elapsed = (Date.now() - start) / 1000.0;
    metrics.fhirCallLatency.observe(elapsed);
    return resp;
  } catch (err) {
    // Record latency and error metrics
    const elapsed = (Date.now() - start) / 1000.0;
    metrics.fhirCallLatency.observe(elapsed);
    metrics.fhirCallErrors.inc();
    // Log error details
    logger.error('[fhirClient] conditionalPut error', {
      url,
      err: err.message,
      status: err.response && err.response.status
    });
    throw err;
  }
}

/**
 * Updates a Patient resource by ID.
 * Optionally uses If-Match header for version control.
 * @param {string} id - Patient resource ID
 * @param {Object} body - Patient resource body
 * @param {string} [ifMatch] - Optional If-Match header value
 * @returns {Promise<Object>} - Axios response object
 */
async function putPatientById(id, body, ifMatch) {
  const headers = {};
  if (ifMatch) headers['If-Match'] = ifMatch;
  const url = `Patient/${encodeURIComponent(id)}`;
  const start = Date.now();

  try {
    // Perform PUT request to update patient by ID
    const resp = await client.put(url, body, { headers });
    // Record latency metric
    const elapsed = (Date.now() - start) / 1000.0;
    metrics.fhirCallLatency.observe(elapsed);
    return resp;
  } catch (err) {
    // Record latency and error metrics
    const elapsed = (Date.now() - start) / 1000.0;
    metrics.fhirCallLatency.observe(elapsed);
    metrics.fhirCallErrors.inc();
    // Log error details
    logger.error('[fhirClient] putById error', {
      url,
      err: err.message,
      status: err.response && err.response.status
    });
    throw err;
  }
}

// Export functions for use in other modules
module.exports = { conditionalPutPatient, putPatientById };
