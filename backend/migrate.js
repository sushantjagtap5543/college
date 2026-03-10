const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432,
});

async function migrate() {
    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;");
        console.log("Migration successful: Added plain_password column to users.");

        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;");
        console.log("Migration successful: Added is_active column to vehicles.");

        await pool.query("ALTER TABLE geofences ADD COLUMN IF NOT EXISTS coordinates JSONB;");
        await pool.query("ALTER TABLE geofences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);");
        await pool.query("ALTER TABLE geofences ALTER COLUMN geom DROP NOT NULL;"); // Allow null if not using PostGIS yet
        console.log("Migration successful: Updated geofences schema.");

        // Alert Rules Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_rules (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL, -- 'geofence', 'speed', 'ignition', 'offline'
                conditions JSONB NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Migration successful: Created alert_rules table.");

        // Notification Profiles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notification_profiles (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(100),
                phone VARCHAR(20),
                is_email_active BOOLEAN DEFAULT true,
                is_sms_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Migration successful: Created notification_profiles table.");

        // Georoutes Table (Support for ST_Distance)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS georoutes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                coordinates JSONB NOT NULL, -- Array of [lat, lng]
                buffer_meters INTEGER DEFAULT 100,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Migration successful: Created georoutes table.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
