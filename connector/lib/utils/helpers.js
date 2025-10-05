// connector/lib/utils/helpers.js

/**
 * Sleeps for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an HTTP status code is retryable.
 * Retryable if status is 429 (Too Many Requests) or >= 500 (Server Error).
 * @param {number} status - HTTP status code.
 * @returns {boolean}
 */
function isRetryableStatus(status) {
  if (!status) return true; // Treat undefined/null status as retryable
  return status >= 500 || status === 429;
}

/**
 * Merges the 'payload_json' objects from an array of rows.
 * Rows are sorted by 'id' before merging.
 * @param {Array<{id: number, payload_json: Object}>} rows
 * @returns {Object} - Merged payload object.
 */
function mergePayloads(rows) {
  const merged = {};
  // Sort rows by id in ascending order
  rows.sort((a, b) => Number(a.id) - Number(b.id));
  for (const row of rows) {
    if (!row.payload_json) continue; // Skip if payload_json is missing
    Object.assign(merged, row.payload_json); // Merge payload into result
  }
  return merged;
}

module.exports = { sleep, isRetryableStatus, mergePayloads };
