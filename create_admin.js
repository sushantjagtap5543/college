const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: 'db',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432
});

(async () => {
    try {
        const hash = await bcrypt.hash('admin@123', 10);
        const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'ADMIN'");

        if (roleRes.rows.length) {
            const roleId = roleRes.rows[0].id;
            // Upsert the admin user
            await pool.query(`
                INSERT INTO users (role_id, name, email, password_hash) 
                VALUES ($1, 'Super Admin', 'admin@geosurepath.com', $2) 
                ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
            `, [roleId, hash]);
            console.log('SUCCESS: Admin account provisioned.');
        } else {
            console.log('ERROR: ADMIN role not found.');
        }
    } catch (err) {
        console.error('ERROR during provisioning:', err);
    } finally {
        await pool.end();
    }
})();
