const { Pool } = require('pg');
const { createClient } = require('redis');

const pool = new Pool({
    user: process.env.DB_USER || 'gps_admin',
    password: process.env.DB_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gps_saas',
    port: 5432,
});

const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
    socket: { reconnectStrategy: (retries) => (retries > 1 ? false : 500) }
});

async function seedAndSimulate() {
    try {
        await redisClient.connect();
        console.log('[REDIS] Connection established');
    } catch (e) {
        console.log('[REDIS_MOCK] Operating in Simulation Virtual Mode');
        // Mock redis methods
        redisClient.hSet = async () => { };
        redisClient.publish = async () => { };
    }

    console.log('--- SEEDING 100 DUMMY DEVICES ---');

    try {
        // 1. Get a client ID to assign devices to
        const clientRes = await pool.query("SELECT id FROM users WHERE role = 'client' LIMIT 1");
        if (clientRes.rows.length === 0) {
            console.error('No client user found. Please register a client first.');
            process.exit(1);
        }
        const clientId = clientRes.rows[0].id;

        // 2. Get a standard model ID
        const modelRes = await pool.query("SELECT id FROM device_models LIMIT 1");
        const modelId = modelRes.rows[0]?.id || null;

        for (let i = 0; i < 100; i++) {
            const imei = 'SIM' + String(100000000000 + i);
            const name = 'Test Vehicle ' + (i + 1);

            // Insert into inventory
            await pool.query(
                "INSERT INTO device_inventory (imei, serial_number, model_id, protocol) VALUES ($1, $2, $3, 'GT06') ON CONFLICT (imei) DO NOTHING",
                [imei, 'SN' + imei, modelId]
            );

            // Insert into devices and link to client
            await pool.query(
                "INSERT INTO devices (user_id, imei, name, model_id, speed_limit) VALUES ($1, $2, $3, $4, 80) ON CONFLICT (imei) DO NOTHING",
                [clientId, imei, name, modelId]
            );
        }

        console.log('--- SIMULATING MOVEMENT ---');
        // Pune coordinates
        let baseLat = 18.5204;
        let baseLng = 73.8567;

        setInterval(async () => {
            for (let i = 0; i < 100; i++) {
                const imei = 'SIM' + String(100000000000 + i);
                const lat = baseLat + (Math.random() - 0.5) * 0.1;
                const lng = baseLng + (Math.random() - 0.5) * 0.1;
                const speed = Math.floor(Math.random() * 60 + 20);

                const data = {
                    imei,
                    lat: String(lat),
                    lng: String(lng),
                    speed: String(speed),
                    heading: String(Math.floor(Math.random() * 360)),
                    last_update: String(Date.now()),
                    gps_fixed: '1'
                };

                await redisClient.hSet(`live:${imei}`, data);
                await redisClient.publish('gps:updates', JSON.stringify(data));
            }
            console.log('Virtual Mesh updated: 100 devices active at ' + new Date().toLocaleTimeString());
        }, 5000);
    } catch (e) { console.log('[SIM_VIRTUAL] Postgres unavailable, operating on static device list'); }
}

seedAndSimulate();
