-- GPRS COMMAND MODULE SCHEMA
-- Creating the tables as per USER_REQUEST

-- 1. Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    imei VARCHAR(50) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    protocol VARCHAR(50),
    model VARCHAR(50),
    sim_number VARCHAR(20),
    vehicle_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    driver_name VARCHAR(100),
    device_id INTEGER REFERENCES devices(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Command Templates Table
CREATE TABLE IF NOT EXISTS command_templates (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100),
    model VARCHAR(100),
    protocol VARCHAR(50),
    action VARCHAR(50), -- IGNITION_OFF, IGNITION_ON
    command_string VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Device Commands Table (Logs)
CREATE TABLE IF NOT EXISTS device_commands (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id),
    device_id INTEGER REFERENCES devices(id),
    action VARCHAR(50),
    command_sent VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED
    response TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID -- References our existing users(id) if available
);

-- Seed Command Templates
INSERT INTO command_templates (brand, model, protocol, action, command_string) VALUES
('Concox', 'GT06', 'gt06', 'IGNITION_OFF', 'RELAY,1#'),
('Concox', 'GT06', 'gt06', 'IGNITION_ON', 'RELAY,0#'),
('Concox', 'GT06N', 'gt06', 'IGNITION_OFF', 'RELAY,1#'),
('Concox', 'GT06N', 'gt06', 'IGNITION_ON', 'RELAY,0#'),
('Coban', 'TK103', 'tk103', 'IGNITION_OFF', 'DYD#'),
('Coban', 'TK103', 'tk103', 'IGNITION_ON', 'HFYD#'),
('Coban', 'TK103B', 'tk103', 'IGNITION_OFF', 'DYD#'),
('Coban', 'TK103B', 'tk103', 'IGNITION_ON', 'HFYD#'),
('Teltonika', 'FMB920', 'teltonika', 'IGNITION_OFF', 'setdigout 1'),
('Teltonika', 'FMB920', 'teltonika', 'IGNITION_ON', 'setdigout 0'),
('Teltonika', 'FMB120', 'teltonika', 'IGNITION_OFF', 'setdigout 1'),
('Teltonika', 'FMB120', 'teltonika', 'IGNITION_ON', 'setdigout 0'),
('Jimi', 'VL02', 'jimi', 'IGNITION_OFF', 'RELAY,1#'),
('Jimi', 'VL02', 'jimi', 'IGNITION_ON', 'RELAY,0#'),
('Jimi', 'VL03', 'jimi', 'IGNITION_OFF', 'RELAY,1#'),
('Jimi', 'VL03', 'jimi', 'IGNITION_ON', 'RELAY,0#'),
('Meitrack', 'T333', 'meitrack', 'IGNITION_OFF', 'RELAY,1#'),
('Meitrack', 'T333', 'meitrack', 'IGNITION_ON', 'RELAY,0#'),
('Queclink', 'GV300', 'queclink', 'IGNITION_OFF', 'AT+GTOUT=1,1'),
('Queclink', 'GV300', 'queclink', 'IGNITION_ON', 'AT+GTOUT=1,0'),
('SinoTrack', 'ST901', 'h02', 'IGNITION_OFF', 'RELAY,1#'),
('SinoTrack', 'ST901', 'h02', 'IGNITION_ON', 'RELAY,0#'),
('Eelink', 'TK116', 'eelink', 'IGNITION_OFF', 'RELAY,1#'),
('Eelink', 'TK116', 'eelink', 'IGNITION_ON', 'RELAY,0#'),
('WanWay', 'S20', 'wanway', 'IGNITION_OFF', 'RELAY,1#'),
('WanWay', 'S20', 'wanway', 'IGNITION_ON', 'RELAY,0#');
