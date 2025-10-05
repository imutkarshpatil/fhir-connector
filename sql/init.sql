-- ======================================================
-- init.sql — Health Tables + FHIR Connector Schema Setup
-- ======================================================

-- ======================================================
-- 1. HEALTH TABLES SCHEMA
-- ======================================================
-- Health Tables Database Schemas
-- Simplified schemas for FHIR connector take-home assignment
-- Compatible with PostgreSQL 16

-- Patient demographics and basic information
CREATE TABLE IF NOT EXISTS patient (
    id SERIAL PRIMARY KEY,
    active BOOLEAN NOT NULL DEFAULT true,
    birth_date DATE,
    deceased BOOLEAN NOT NULL DEFAULT false,
    
    -- Primary name
    name_family TEXT,
    name_given TEXT,
    name_text TEXT,
    
    -- Primary identifier
    identifier_value TEXT,
    identifier_system TEXT,
    
    -- Contact information
    phone_number TEXT,
    email TEXT,
    
    -- Address
    address_line TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT,
    
    -- Demographics
    gender TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- patient's other identifiers
CREATE TABLE IF NOT EXISTS patient_other_identifiers (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    identifier_system TEXT,
    identifier_value TEXT
);

-- Clinical encounters/visits
CREATE TABLE IF NOT EXISTS form (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    name TEXT,
    encounter_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Blood pressure measurements
CREATE TABLE IF NOT EXISTS blood_pressure (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES form(id),
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    systolic_pressure INTEGER,
    diastolic_pressure INTEGER,
    measurement_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position TEXT, -- 'sitting', 'standing', 'lying'
    location TEXT, -- 'left_arm', 'right_arm', etc.
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pulse/heart rate measurements  
CREATE TABLE IF NOT EXISTS pulse (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES form(id),
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    rate INTEGER, -- beats per minute
    measurement_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    regularity TEXT, -- 'regular', 'irregular'
    method TEXT, -- 'palpation', 'auscultation', 'automatic'
    body_site TEXT, -- 'radial', 'carotid', 'heart', etc.
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data

-- Sample patients
INSERT INTO patient (name_family, name_given, birth_date, gender, phone_number, email, 
                    address_line, address_city, address_state, address_postal_code, address_country,
                    identifier_value, identifier_system) 
VALUES 
    ('Smith', 'John', '1990-01-15', 'male', '+1-555-123-4567', 'john.smith@example.com',
     '123 Main Street', 'Boston', 'MA', '02101', 'USA',
     'MRN-001234', 'https://hospital.example.com/mrn'),
    
    ('Johnson', 'Emily', '1985-06-22', 'female', '+1-555-987-6543', 'emily.johnson@example.com',
     '456 Oak Avenue', 'Cambridge', 'MA', '02139', 'USA',
     'MRN-005678', 'https://hospital.example.com/mrn'),
    
    ('Williams', 'Robert', '1955-11-03', 'male', '+1-555-246-8101', 'robert.williams@example.com',
     '789 Pine Road', 'Somerville', 'MA', '02144', 'USA',
     'MRN-009012', 'https://hospital.example.com/mrn'),
    
    ('Brown', 'Maria', '1972-03-28', 'female', '+1-555-369-2580', 'maria.brown@example.com',
     '321 Elm Street', 'Brookline', 'MA', '02445', 'USA',
     'MRN-003456', 'https://hospital.example.com/mrn'),
    
    ('Davis', 'James', '2000-09-14', 'male', '+1-555-147-2589', 'james.davis@example.com',
     '654 Maple Drive', 'Newton', 'MA', '02458', 'USA',
     'MRN-007890', 'https://hospital.example.com/mrn');

-- Sample patient other identifiers
INSERT INTO patient_other_identifiers (patient_id, identifier_system, identifier_value)
VALUES 
    (1, 'https://hospital.example.com/mrn', 'MRN-001234'),
    (2, 'https://hospital.example.com/mrn', 'MRN-005678'),
    (3, 'https://hospital.example.com/mrn', 'MRN-009012'),
    (4, 'https://hospital.example.com/mrn', 'MRN-003456'),
    (5, 'https://hospital.example.com/mrn', 'MRN-007890');

-- Sample forms/encounters
INSERT INTO form (patient_id, name, encounter_date)
VALUES 
    (1, 'Annual Physical', '2024-03-15 10:30:00+00'),
    (1, 'Follow-up Visit', '2024-04-20 14:15:00+00'),
    (2, 'Routine Checkup', '2024-03-10 09:00:00+00'),
    (3, 'Hypertension Management', '2024-03-18 11:45:00+00'),
    (3, 'Cardiac Evaluation', '2024-04-02 13:30:00+00'),
    (4, 'Diabetes Follow-up', '2024-03-22 15:00:00+00'),
    (5, 'Sports Physical', '2024-02-28 16:30:00+00');

-- Sample blood pressure readings
INSERT INTO blood_pressure (form_id, patient_id, systolic_pressure, diastolic_pressure, position, location, comment, measurement_time)
VALUES 
    (1, 1, 120, 80, 'sitting', 'left_arm', 'Normal reading', '2024-03-15 10:35:00+00'),
    (1, 1, 118, 78, 'sitting', 'left_arm', 'Second reading after 5 minutes', '2024-03-15 10:40:00+00'),
    (2, 1, 122, 82, 'sitting', 'left_arm', NULL, '2024-04-20 14:20:00+00'),
    (3, 2, 115, 75, 'sitting', 'right_arm', 'Patient relaxed', '2024-03-10 09:05:00+00'),
    (4, 3, 145, 92, 'sitting', 'left_arm', 'Elevated - discussed medication adjustment', '2024-03-18 11:50:00+00'),
    (4, 3, 142, 90, 'sitting', 'left_arm', 'After 10 minutes rest', '2024-03-18 12:00:00+00'),
    (5, 3, 138, 88, 'sitting', 'left_arm', 'Improved from last visit', '2024-04-02 13:35:00+00'),
    (6, 4, 135, 85, 'sitting', 'right_arm', 'Slightly elevated', '2024-03-22 15:05:00+00'),
    (7, 5, 110, 70, 'sitting', 'left_arm', 'Excellent for age', '2024-02-28 16:35:00+00');

-- Sample pulse readings
INSERT INTO pulse (form_id, patient_id, rate, regularity, method, body_site, comment, measurement_time)
VALUES 
    (1, 1, 72, 'regular', 'palpation', 'radial', 'Normal resting rate', '2024-03-15 10:35:00+00'),
    (2, 1, 76, 'regular', 'automatic', 'finger', NULL, '2024-04-20 14:20:00+00'),
    (3, 2, 68, 'regular', 'palpation', 'radial', 'Athletic resting rate', '2024-03-10 09:05:00+00'),
    (4, 3, 88, 'irregular', 'auscultation', 'heart', 'Atrial fibrillation noted', '2024-03-18 11:50:00+00'),
    (5, 3, 84, 'irregular', 'automatic', 'finger', 'AFib continues', '2024-04-02 13:35:00+00'),
    (6, 4, 80, 'regular', 'palpation', 'radial', NULL, '2024-03-22 15:05:00+00'),
    (7, 5, 58, 'regular', 'palpation', 'radial', 'Athlete - low resting rate normal', '2024-02-28 16:35:00+00');

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers to all tables
CREATE TRIGGER update_patient_updated_at BEFORE UPDATE ON patient 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_updated_at BEFORE UPDATE ON form 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blood_pressure_updated_at BEFORE UPDATE ON blood_pressure 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pulse_updated_at BEFORE UPDATE ON pulse 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ======================================================
-- 2. FHIR CONNECTOR OBJECTS
-- ======================================================

-- === Outbox table ===
CREATE TABLE IF NOT EXISTS fhir_outbox (
  id BIGSERIAL PRIMARY KEY,
  txid BIGINT NOT NULL,
  sequence_in_tx INTEGER NOT NULL DEFAULT 1,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  operation CHAR(1) NOT NULL,
  payload_json JSONB NOT NULL,
  patient_id INTEGER NULL,
  identifier_system TEXT NULL,
  identifier_value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  lock_expires_at TIMESTAMPTZ NULL,
  fhir_resource_id TEXT NULL,
  fhir_version TEXT NULL,
  last_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_fhir_outbox_unprocessed_nextretry ON fhir_outbox (processed, next_retry_at, created_at);
CREATE INDEX IF NOT EXISTS idx_fhir_outbox_txid ON fhir_outbox (txid);
CREATE INDEX IF NOT EXISTS idx_fhir_outbox_patient ON fhir_outbox (patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_outbox_identifier ON fhir_outbox (identifier_system, identifier_value);

-- === DLQ table ===
CREATE TABLE IF NOT EXISTS fhir_dlq (
  id BIGSERIAL PRIMARY KEY,
  outbox_id BIGINT NULL,
  txid BIGINT NULL,
  table_name TEXT NULL,
  record_id INTEGER NULL,
  operation CHAR(1) NULL,
  payload_json JSONB NULL,
  error_text TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fhir_dlq_outbox_id ON fhir_dlq(outbox_id);

-- === Idempotency table ===
CREATE TABLE IF NOT EXISTS fhir_processed_event (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ======================================================
-- 3. FUNCTIONS
-- ======================================================

-- === Trigger function: write outbox + notify connector ===
CREATE OR REPLACE FUNCTION fhir_outbox_write_notify()
RETURNS TRIGGER AS $$
DECLARE
  v_txid bigint;
  v_rec_id integer;
  v_op char(1);
  v_payload jsonb;
  v_patient_id int;
  v_identifier_system text;
  v_identifier_value text;
  v_outbox_id bigint;
BEGIN
  v_txid := txid_current();

  IF TG_OP = 'INSERT' THEN
    v_rec_id := NEW.id;
    v_op := 'I';
    v_payload := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := NEW.id;
    v_op := 'U';
    v_payload := to_jsonb(NEW);
  ELSE
    v_rec_id := OLD.id;
    v_op := 'D';
    v_payload := to_jsonb(OLD);
  END IF;

  BEGIN
    v_patient_id := (v_payload ->> 'patient_id')::int;
  EXCEPTION WHEN others THEN
    v_patient_id := NULL;
  END;

  BEGIN
    v_identifier_system := (v_payload ->> 'identifier_system');
    v_identifier_value := (v_payload ->> 'identifier_value');
  EXCEPTION WHEN others THEN
    v_identifier_system := NULL;
    v_identifier_value := NULL;
  END;

  INSERT INTO fhir_outbox (
    txid, sequence_in_tx, table_name, record_id, operation, payload_json,
    patient_id, identifier_system, identifier_value, created_at
  )
  VALUES (
    v_txid, 1, TG_TABLE_NAME, v_rec_id, v_op, v_payload,
    v_patient_id, v_identifier_system, v_identifier_value, now()
  )
  RETURNING id INTO v_outbox_id;

  PERFORM pg_notify('fhir_outbox_event', v_outbox_id::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- === Move to DLQ ===
CREATE OR REPLACE FUNCTION fhir_move_outbox_to_dlq(p_outbox_id bigint, p_error_text text)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT * INTO r FROM fhir_outbox WHERE id = p_outbox_id;
  IF NOT FOUND THEN
    RAISE NOTICE 'Outbox row % not found', p_outbox_id;
    RETURN;
  END IF;

  INSERT INTO fhir_dlq (outbox_id, txid, table_name, record_id, operation, payload_json, error_text, attempts)
  VALUES (r.id, r.txid, r.table_name, r.record_id, r.operation, r.payload_json, p_error_text, r.attempts);

  UPDATE fhir_outbox SET processed = TRUE, processed_at = now() WHERE id = p_outbox_id;
END;
$$ LANGUAGE plpgsql;

-- === Record processed event (idempotency) ===
CREATE OR REPLACE FUNCTION fhir_mark_event_processed(p_event_key text)
RETURNS void AS $$
BEGIN
  INSERT INTO fhir_processed_event (event_key) VALUES (p_event_key)
  ON CONFLICT (event_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- === Cleanup helper ===
CREATE OR REPLACE FUNCTION fhir_cleanup_old(threshold_days integer)
RETURNS void AS $$
BEGIN
  EXECUTE format('DELETE FROM fhir_outbox WHERE processed = TRUE AND processed_at < now() - INTERVAL ''%s days''', threshold_days);
  EXECUTE format('DELETE FROM fhir_dlq WHERE first_failed_at < now() - INTERVAL ''%s days''', threshold_days * 3);
  EXECUTE format('DELETE FROM fhir_processed_event WHERE processed_at < now() - INTERVAL ''%s days''', threshold_days * 3);
END;
$$ LANGUAGE plpgsql;

-- ======================================================
-- 4. TRIGGERS
-- ======================================================
DROP TRIGGER IF EXISTS trg_fhir_outbox_patient ON patient;
CREATE TRIGGER trg_fhir_outbox_patient
  AFTER INSERT OR UPDATE OR DELETE ON patient
  FOR EACH ROW EXECUTE FUNCTION fhir_outbox_write_notify();

DROP TRIGGER IF EXISTS trg_fhir_outbox_identifiers ON patient_other_identifiers;
CREATE TRIGGER trg_fhir_outbox_identifiers
  AFTER INSERT OR UPDATE OR DELETE ON patient_other_identifiers
  FOR EACH ROW EXECUTE FUNCTION fhir_outbox_write_notify();

-- ======================================================
-- 5. VIEWS
-- ======================================================
CREATE OR REPLACE VIEW vw_fhir_pending_txids AS
SELECT txid, min(created_at) AS first_seen, count(*) AS row_count
FROM fhir_outbox
WHERE processed = FALSE
  AND (next_retry_at IS NULL OR next_retry_at <= now())
GROUP BY txid
ORDER BY first_seen;
-- ======================================================