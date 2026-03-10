-- GEOSUREPATH - Extended Database Schema updates for total Traccar-like autonomy
-- This script adds missing columns and tables to support 100% clone functionality locally.

-- 1. Add missing columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- 2. Add missing columns to device_inventory
ALTER TABLE device_inventory ADD COLUMN IF NOT EXISTS model VARCHAR(50);
ALTER TABLE device_inventory ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE;
ALTER TABLE device_inventory ADD COLUMN IF NOT EXISTS note TEXT;

-- 3. Add missing columns to devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

-- 4. Add missing columns to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_hours DECIMAL(12, 2) DEFAULT 0;

-- 5. Create Georoutes table (for route fencing)
CREATE TABLE IF NOT EXISTS georoutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    coordinates JSONB NOT NULL, -- Array of [lat, lng]
    tolerance_meters INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Notification Profiles for more granular control
CREATE TABLE IF NOT EXISTS notification_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(100),
    phone VARCHAR(20),
    web_push_subscription JSONB,
    alert_types JSONB DEFAULT '["OVERSPEED", "GEOFENCE_ENTER", "GEOFENCE_EXIT", "SOS", "POWER_CUT", "IGNITION_ON", "IGNITION_OFF"]'
);
