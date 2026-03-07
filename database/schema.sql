-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Users & Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'SUPER_ADMIN' or 'CLIENT'
    permissions JSONB DEFAULT '{}'
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INTEGER REFERENCES roles(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Devices & Models
CREATE TABLE device_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) UNIQUE NOT NULL,
    protocol VARCHAR(50) NOT NULL, -- e.g., 'GT06'
    supported_commands JSONB DEFAULT '[]' -- e.g., ["IGNITION_ON", "IGNITION_OFF"]
);

CREATE TABLE device_inventory (
    imei VARCHAR(50) PRIMARY KEY,
    sim_number VARCHAR(15) NOT NULL, -- 13 digit M2M or standard
    is_assigned BOOLEAN DEFAULT false,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    imei VARCHAR(50) UNIQUE NOT NULL REFERENCES device_inventory(imei),
    model_id INTEGER REFERENCES device_models(id),
    status VARCHAR(20) DEFAULT 'OFFLINE', -- 'ONLINE', 'OFFLINE'
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vehicles
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID UNIQUE REFERENCES devices(id) ON DELETE SET NULL,
    plate_number VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50), -- 'CAR', 'TRUCK', 'BIKE'
    icon_color VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. GPS Live Data (Latest row only)
CREATE TABLE gps_live_data (
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

-- 5. GPS History (Partitioned by Month)
CREATE TABLE gps_history (
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

-- Creating partition for current month (example)
-- CREATE TABLE gps_history_2024_03 PARTITION OF gps_history FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- 6. Geofences & Routefences (PostGIS)
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    fence_type VARCHAR(20) NOT NULL, -- 'CIRCLE', 'POLYGON', 'RECTANGLE'
    geom geometry NOT NULL, -- PostGIS geom
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE route_fences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    route_geom geometry(LineString) NOT NULL, -- The drawn route line
    corridor_distance_meters INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Commands & Queue
CREATE TABLE logical_commands (
    id SERIAL PRIMARY KEY,
    command_alias VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'IGNITION_OFF'
    description TEXT
);

CREATE TABLE device_command_map (
    model_id INTEGER REFERENCES device_models(id),
    logical_command_id INTEGER REFERENCES logical_commands(id),
    actual_payload VARCHAR(255) NOT NULL, -- e.g., 'RELAY,1#' for GT06
    PRIMARY KEY (model_id, logical_command_id)
);

CREATE TABLE command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    user_id UUID REFERENCES users(id),
    logical_command_id INTEGER REFERENCES logical_commands(id),
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'ACK', 'FAILED'
    sent_at TIMESTAMP WITH TIME ZONE,
    ack_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Alerts & Rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL, -- 'OVERSPEED', 'GEOFENCE_IN', 'IGNITION_ON'
    conditions JSONB NOT NULL, -- e.g., {"max_speed": 80}
    severity VARCHAR(20) DEFAULT 'INFO', -- 'INFO', 'WARNING', 'CRITICAL'
    cooldown_minutes INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id),
    rule_id UUID REFERENCES alert_rules(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Audit Logs & System State
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- 'LOGIN_SUCCESS', 'CREATED_VEHICLE', 'SENT_COMMAND', 'CHANGED_ALERT_THRESHOLD'
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dynamic_content (
    id SERIAL PRIMARY KEY,
    section_name VARCHAR(100) UNIQUE NOT NULL,
    content_payload JSONB NOT NULL, -- HTML strings, video URLs, product listings
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_gps_history_device_time ON gps_history (device_id, timestamp DESC);
CREATE INDEX idx_gps_live_data_coords ON gps_live_data (latitude, longitude);
CREATE INDEX idx_alerts_device_status ON alerts (device_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);
