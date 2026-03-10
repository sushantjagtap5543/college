const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: process.env.DB_PORT || 5432,
});

async function migrate() {
    try {
        // Core Traccar-style Extensions
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(100);");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';");
        console.log("Migration successful: Extended users table.");

        await pool.query("ALTER TABLE device_inventory ADD COLUMN IF NOT EXISTS model VARCHAR(50);");
        await pool.query("ALTER TABLE device_inventory ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE;");
        console.log("Migration successful: Extended device_inventory table.");

        await pool.query("ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone VARCHAR(20);");
        await pool.query("ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE;");
        await pool.query("ALTER TABLE devices ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';");
        console.log("Migration successful: Extended devices table.");

        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR(100);");
        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year INTEGER;");
        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color VARCHAR(50);");
        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin VARCHAR(20);");
        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer DECIMAL(12, 2) DEFAULT 0;");
        await pool.query("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_hours DECIMAL(12, 2) DEFAULT 0;");
        console.log("Migration successful: Extended vehicles table.");

        // Georoutes Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS georoutes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                coordinates JSONB NOT NULL,
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
