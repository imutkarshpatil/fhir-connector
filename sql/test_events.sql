-- ======================================================
-- test_events.sql — Validate FHIR Connector DB Setup
-- ======================================================

-- display txid
SELECT txid_current() AS current_txid;

-- 1) INSERT test
INSERT INTO patient (name_family, name_given, birth_date, gender, phone_number, email,
                     address_line, address_city, address_state, address_postal_code, address_country,
                     identifier_value, identifier_system)
VALUES
  ('Brown', 'Maria', '1972-03-28', 'female', '+1-555-369-2580', 'maria.brown@example.com',
   '321 Elm Street', 'Brookline', 'MA', '02445', 'USA',
   'MRN-003456', 'https://hospital.example.com/mrn');

INSERT INTO patient_other_identifiers (patient_id, identifier_system, identifier_value)
VALUES ((SELECT id FROM patient WHERE identifier_value='MRN-003456'), 'https://hospital.example.com/mrn', 'MRN-003456');

-- inspect outbox
SELECT id, txid, table_name, operation, record_id, created_at, processed
FROM fhir_outbox
ORDER BY created_at DESC
LIMIT 5;

-- 2) UPDATE
UPDATE patient
SET phone_number = '+1-555-369-9999', updated_at = now()
WHERE identifier_value = 'MRN-003456';

SELECT id, txid, table_name, operation, record_id, processed
FROM fhir_outbox
ORDER BY id DESC LIMIT 3;

-- 3) DELETE
DELETE FROM patient
WHERE identifier_value = 'MRN-003456';

SELECT id, txid, table_name, operation
FROM fhir_outbox
WHERE operation = 'D'
ORDER BY id DESC LIMIT 3;

-- 4) Multi-row transaction
BEGIN;
UPDATE patient
   SET email = 'john.smith@updated.com', updated_at = now()
 WHERE name_family = 'Smith';

UPDATE patient_other_identifiers
   SET identifier_value = 'MRN-001234-REV1'
 WHERE patient_id = (SELECT id FROM patient WHERE name_family = 'Smith');
COMMIT;

SELECT txid, table_name, operation, record_id
FROM fhir_outbox
WHERE txid IN (
  SELECT txid
  FROM fhir_outbox
  WHERE table_name = 'patient'
  ORDER BY id DESC
  LIMIT 1
)
ORDER BY table_name;

-- 5) Simulate DLQ
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM fhir_outbox WHERE processed = FALSE LIMIT 1;
  PERFORM fhir_move_outbox_to_dlq(v_id, 'Simulated permanent failure for test');
END;
$$;

SELECT * FROM fhir_dlq ORDER BY id DESC LIMIT 3;

-- 6) Cleanup helper run
SELECT fhir_cleanup_old(1);

-- summary
SELECT
  COUNT(*) FILTER (WHERE processed = FALSE) AS unprocessed,
  COUNT(*) FILTER (WHERE processed = TRUE)  AS processed,
  COUNT(*) AS total
FROM fhir_outbox;

SELECT * FROM vw_fhir_pending_txids;
-- End of test_events.sql