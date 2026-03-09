-- GEOSUREPATH PRODUCTION SCHEMA
-- Synchronized with database/schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'SUPER_ADMIN' or 'CLIENT'
    permissions JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INTEGER REFERENCES roles(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plain_password TEXT,
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Devices & Models
CREATE TABLE IF NOT EXISTS device_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) UNIQUE NOT NULL,
    protocol VARCHAR(50) NOT NULL, -- e.g., 'GT06'
    supported_commands JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS device_inventory (
    imei VARCHAR(50) PRIMARY KEY,
    sim_number VARCHAR(20) UNIQUE NOT NULL,
    protocol VARCHAR(50),
    is_assigned BOOLEAN DEFAULT false,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    imei VARCHAR(50) UNIQUE NOT NULL REFERENCES device_inventory(imei),
    model_id INTEGER REFERENCES device_models(id),
    status VARCHAR(20) DEFAULT 'OFFLINE',
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID UNIQUE REFERENCES devices(id) ON DELETE SET NULL,
    plate_number VARCHAR(50) NOT NULL,
    vehicle_name VARCHAR(50),
    vehicle_type VARCHAR(50) DEFAULT 'car',
    icon_color VARCHAR(20) DEFAULT '#000000',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. GPS Live Data
CREATE TABLE IF NOT EXISTS gps_live_data (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading SMALLINT DEFAULT 0,
    altitude DECIMAL(7, 2) DEFAULT 0,
    ignition BOOLEAN DEFAULT false,
    power_cut BOOLEAN DEFAULT false,
    raw_packet JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 5. GPS History
CREATE TABLE IF NOT EXISTS gps_history (
    id BIGSERIAL,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading SMALLINT DEFAULT 0,
    altitude DECIMAL(7, 2) DEFAULT 0,
    ignition BOOLEAN,
    power_cut BOOLEAN,
    raw_packet JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- 5a. Default partition for Catch-all
CREATE TABLE IF NOT EXISTS gps_history_default PARTITION OF gps_history DEFAULT;

-- 6. Geofences
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    fence_type VARCHAR(20) NOT NULL,
    geom geometry NOT NULL,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Commands & Queue
CREATE TABLE IF NOT EXISTS logical_commands (
    id SERIAL PRIMARY KEY,
    command_alias VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS device_command_map (
    model_id INTEGER REFERENCES device_models(id),
    logical_command_id INTEGER REFERENCES logical_commands(id),
    actual_payload VARCHAR(255) NOT NULL,
    PRIMARY KEY (model_id, logical_command_id)
);

CREATE TABLE IF NOT EXISTS command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    user_id UUID REFERENCES users(id),
    logical_command_id INTEGER REFERENCES logical_commands(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    ack_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Initial Data Seeding
INSERT INTO roles (name) VALUES ('ADMIN'), ('CLIENT') ON CONFLICT DO NOTHING;
INSERT INTO logical_commands (command_alias, description) VALUES 
('ENGINE_STOP', 'Cut off fuel/electricity'),
('ENGINE_RESUME', 'Restore fuel/electricity'),
('REBOOT', 'Restart device hardware')
ON CONFLICT (command_alias) DO NOTHING;
