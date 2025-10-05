-- Health Tables Database Schemas
-- Simplified schemas for FHIR connector take-home assignment
-- Compatible with PostgreSQL 16

-- Patient demographics and basic information
CREATE TABLE patient (
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
CREATE TABLE patient_other_identifiers (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    identifier_system TEXT,
    identifier_value TEXT
);

-- Clinical encounters/visits
CREATE TABLE form (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patient(id),
    name TEXT,
    encounter_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Blood pressure measurements
CREATE TABLE blood_pressure (
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
CREATE TABLE pulse (
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