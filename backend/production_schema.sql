-- GEOSUREPATH PRODUCTION SCHEMA
-- Run this script in your Postgres database to initialize the tables for deployment.

-- 1. Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('ADMIN'), ('CLIENT') ON CONFLICT DO NOTHING;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Device Master Stock (Admin Inventory)
CREATE TABLE IF NOT EXISTS device_inventory (
    imei VARCHAR(15) PRIMARY KEY,
    sim_number VARCHAR(20) UNIQUE NOT NULL,
    is_assigned BOOLEAN DEFAULT false,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Active Devices (TCP Connection tracking)
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(15) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'OFFLINE',
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Vehicles (Client Assets)
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id),
    device_id INTEGER REFERENCES devices(id),
    plate_number VARCHAR(20),
    vehicle_name VARCHAR(50),
    vehicle_type VARCHAR(20) DEFAULT 'car',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Geofences
CREATE TABLE IF NOT EXISTS geofences (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fence_type VARCHAR(20) NOT NULL, -- 'POLYGON' or 'CIRCLE'
    geom GEOMETRY, -- Requires PostGIS extension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. GPS Telemetry (Long-term storage)
CREATE TABLE IF NOT EXISTS gps_telemetry (
    id BIGSERIAL PRIMARY KEY,
    imei VARCHAR(15) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2) DEFAULT 0,
    heading SMALLINT DEFAULT 0,
    altitude DECIMAL(8, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attributes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_telemetry_imei_time ON gps_telemetry (imei, timestamp);

