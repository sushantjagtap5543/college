-- GEOSUREPATH - Master Database Schema V3
-- Consolidated for Real-time Tracking, GPRS Commands, and Alert Rules Engine.

-- Enable necessary extensions for UUID and Geospatial support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Metadata: Roles & Users
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{"all": false}'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INTEGER REFERENCES roles(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_text VARCHAR(255), -- for development/quick reference
    phone VARCHAR(20),
    traccar_id INTEGER,
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '365 days',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hardware Management
CREATE TABLE IF NOT EXISTS device_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    protocol VARCHAR(50) DEFAULT 'gt06',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_inventory (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(50) UNIQUE NOT NULL,
    serial_number VARCHAR(100),
    sim_number VARCHAR(20),
    model_id INTEGER REFERENCES device_models(id),
    is_assigned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(50) UNIQUE NOT NULL REFERENCES device_inventory(imei) ON DELETE CASCADE,
    device_name VARCHAR(100),
    model_id INTEGER REFERENCES device_models(id),
    sim_number VARCHAR(20),
    protocol VARCHAR(50),
    speed_limit DECIMAL(5, 2) DEFAULT 80.00,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vehicle Assets
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    driver_name VARCHAR(100),
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. GPRS Command Logic
CREATE TABLE IF NOT EXISTS command_templates (
    id SERIAL PRIMARY KEY,
    protocol VARCHAR(50),
    action VARCHAR(50), -- IGNITION_OFF, IGNITION_ON, SIREN_ON, etc.
    command_string VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (protocol, action)
);

CREATE TABLE IF NOT EXISTS device_commands (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    action VARCHAR(50),
    command_sent VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED
    response TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Real-time Geospatial State
CREATE TABLE IF NOT EXISTS gps_live_data (
    imei VARCHAR(50) PRIMARY KEY REFERENCES devices(imei) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading SMALLINT DEFAULT 0,
    ignition BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- for heartbeats
);

CREATE TABLE IF NOT EXISTS gps_history (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading SMALLINT DEFAULT 0,
    ignition BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gps_history_device_timestamp ON gps_history(device_id, timestamp);

-- 6. Alerts & Geofences Engine
CREATE TABLE IF NOT EXISTS geofences (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    fence_type VARCHAR(20) DEFAULT 'polygon', -- polygon, circle
    geom GEOMETRY(Geometry, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50), -- speed, geofence, ignition
    conditions JSONB NOT NULL, -- e.g. {"limit": 100} or {"geofence_id": 1, "trigger": "exit"}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT false
);

-- SEED INITIAL DATA
INSERT INTO roles (name, permissions) VALUES 
('ADMIN', '{"all": true}'),
('CLIENT', '{"fleet": true, "reports": true}')
ON CONFLICT (name) DO NOTHING;

-- Seed Standard GPS Device Model (Concox GT06)
INSERT INTO device_models (name, brand, protocol) VALUES 
('GT06N', 'Concox', 'gt06'),
('TK103B', 'Coban', 'tk103'),
('ST-901', 'SinoTrack', 'h02')
ON CONFLICT DO NOTHING;

-- Seed Command Templates
INSERT INTO command_templates (protocol, action, command_string) VALUES
('gt06', 'IGNITION_OFF', 'RELAY,1#'),
('gt06', 'IGNITION_ON', 'RELAY,0#'),
('tk103', 'IGNITION_OFF', 'DYD#'),
('tk103', 'IGNITION_ON', 'HFYD#')
ON CONFLICT (protocol, action) DO NOTHING;

-- Seed User's Requested Hardware
INSERT INTO device_inventory (imei, serial_number, sim_number, model_id) VALUES 
('869727079043558', 'SN043558', '9999999999', 1),
('869727079043556', 'SN043556', '8888888888', 1)
ON CONFLICT (imei) DO NOTHING;
