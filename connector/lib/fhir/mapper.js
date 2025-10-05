'use strict';

/**
 * Builds a FHIR Patient resource from a payload object.
 * @param {Object} payload - Input data containing patient details.
 * @returns {Object} FHIR Patient resource.
 */
function buildPatientResource(payload) {
  // Initialize resource with type
  const res = { resourceType: 'Patient' };

  // Handle identifiers
  const identifiers = [];
  // Add main identifier if present
  if (payload.identifier_system && payload.identifier_value) {
    identifiers.push({ system: payload.identifier_system, value: payload.identifier_value });
  }
  // Add other identifiers if present
  if (Array.isArray(payload.other_identifiers)) {
    for (const it of payload.other_identifiers) {
      if (it.identifier_system && it.identifier_value) {
        identifiers.push({ system: it.identifier_system, value: it.identifier_value });
      }
    }
  }
  // Attach identifiers to resource if any exist
  if (identifiers.length) res.identifier = identifiers;

  // Handle name
  if (payload.name_family || payload.name_given || payload.name_text) {
    const name = {};
    // Family name
    if (payload.name_family) name.family = payload.name_family;
    // Given name(s)
    if (payload.name_given) {
      name.given = Array.isArray(payload.name_given) ? payload.name_given : [payload.name_given];
    }
    // Name text
    if (payload.name_text) {
      name.text = payload.name_text;
    } else if (payload.name_family || payload.name_given) {
      // Construct text if not provided
      name.text = `${payload.name_given || ''} ${payload.name_family || ''}`.trim();
    }
    res.name = [name];
  }

  // Birth date
  if (payload.birth_date) res.birthDate = payload.birth_date;
  // Gender
  if (payload.gender) res.gender = payload.gender;

  // Handle telecom (phone, email)
  const telecom = [];
  if (payload.phone_number) {
    telecom.push({ system: 'phone', value: payload.phone_number });
  }
  if (payload.email) {
    telecom.push({ system: 'email', value: payload.email });
  }
  if (telecom.length) res.telecom = telecom;

  // Handle address
  if (
    payload.address_line ||
    payload.address_city ||
    payload.address_state ||
    payload.address_postal_code ||
    payload.address_country
  ) {
    const addr = {};
    // Address line(s)
    if (payload.address_line) {
      addr.line = Array.isArray(payload.address_line) ? payload.address_line : [payload.address_line];
    }
    // City
    if (payload.address_city) addr.city = payload.address_city;
    // State
    if (payload.address_state) addr.state = payload.address_state;
    // Postal code
    if (payload.address_postal_code) addr.postalCode = payload.address_postal_code;
    // Country
    if (payload.address_country) addr.country = payload.address_country;
    res.address = [addr];
  }

  return res;
}

module.exports = { buildPatientResource };
