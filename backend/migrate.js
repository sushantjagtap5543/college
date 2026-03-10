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
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
}

migrate();
