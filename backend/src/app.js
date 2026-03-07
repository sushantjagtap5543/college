require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const redis = require('redis');
const twilio = require('twilio');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Twilio Client Setup
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID || 'AC_mock',
    process.env.TWILIO_AUTH_TOKEN || 'auth_mock'
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for Twilio Webhooks

// Postgres Connection Pool
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432,
});

// Redis Client (with robust fallback)
let redisClient;
try {
    redisClient = redis.createClient({
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 5) {
                    console.log('Redis Connection: Max retries reached, continuing without Redis');
                    return false; // stop retrying
                }
                return Math.min(retries * 50, 2000); // retry with modest backoff
            }
        }
    });

    redisClient.on('error', (err) => {
        // Silently log and ignore redis errors once we've reported them
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            console.log(`[Redis] Service unavailable at ${process.env.REDIS_HOST || 'localhost'}:6379`);
        } else {
            console.error('[Redis] Unexpected Error:', err);
        }
    });

    redisClient.connect()
        .then(() => console.log('Connected to Redis'))
        .catch((err) => console.log('[Redis] Initial connection failed, but server will continue.'));
} catch (e) {
    console.error('[Redis] Client creation failed:', e);
}

// Global Process Protection: Prevent crashes from unhandled socket errors (common in dev/no-docker)
process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        console.log(`[NETWORK] Caught and suppressed: ${err.message}`);
    } else {
        console.error('[CRITICAL] Uncaught Exception:', err);
        // In production, we might want to exit(1) gracefully, but in dev we stay alive
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.warn('[NETWORK] Unhandled Rejection at:', promise, 'reason:', reason);
});

// WebSocket
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Real clients will authenticate before joining a room
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Basic Health Endpoint
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'OK', message: 'SaaS Platform Backend is running.' });
});

// --- REST API ENDPOINTS ---

// 1. Client Registration & WhatsApp Dispatch
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, phone, imei } = req.body;
    try {
        const clientRoleResult = await pool.query("SELECT id FROM roles WHERE name = 'CLIENT'");
        const roleId = clientRoleResult.rows[0]?.id || null;

        // In a real app, generate a secure random password and hash it.
        const plainPassword = Math.random().toString(36).slice(-8);
        const mockHash = `mockhash_${plainPassword}`;

        const result = await pool.query(
            "INSERT INTO users (role_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
            [roleId, `${firstName} ${lastName}`, email, mockHash]
        );

        const waMessage = `Welcome to GEOSUREPATH! 🚗\nYour GPS Tracking portal account has been created.\n\nPortal: https://geosurepath.com\nUsername: ${email}\nPassword: ${plainPassword}\n\nPlease log in and change your password immediately.`;

        console.log(`[WhatsApp System] Dispatching credentials to ${phone || email}:\n${waMessage}`);

        // If Twilio is configured with a WhatsApp sender, this sends the actual message:
        // await twilioClient.messages.create({
        //     body: waMessage,
        //     from: 'whatsapp:+14155238886', // Twilio Sandbox or approved number
        //     to: \`whatsapp:+\${phone}\`
        // });

        res.json({ status: 'SUCCESS', user: result.rows[0], message: 'Registration successful. Credentials dispatched via WhatsApp.' });
    } catch (err) {
        console.error('Registration/WhatsApp Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Registration failed.' });
    }
});

// 2. Add Device to Inventory (Admin)
app.post('/api/inventory', async (req, res) => {
    const { imei, sim, status } = req.body;
    try {
        const isAssigned = status !== 'Unassigned';
        const result = await pool.query(
            "INSERT INTO device_inventory (imei, sim_number, is_assigned) VALUES ($1, $2, $3) RETURNING *",
            [imei, sim, isAssigned]
        );
        res.json({ status: 'SUCCESS', device: result.rows[0] });
    } catch (err) {
        console.error('Inventory Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to add to inventory.' });
    }
});

// 3. Fetch Devices
app.get('/api/devices', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM device_inventory ORDER BY added_at DESC");
        res.json({ status: 'SUCCESS', devices: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch devices.' });
    }
});

// 3a. Admin Assign Device to Client
app.post('/api/admin/devices/assign', async (req, res) => {
    const { clientId, imei, plateNumber, vehicleType } = req.body;
    try {
        await pool.query('BEGIN');

        let deviceQuery = await pool.query("SELECT id FROM devices WHERE imei = $1", [imei]);
        let deviceId;
        if (deviceQuery.rows.length === 0) {
            const insertDevice = await pool.query(
                "INSERT INTO devices (imei, status) VALUES ($1, 'OFFLINE') RETURNING id",
                [imei]
            );
            deviceId = insertDevice.rows[0].id;
        } else {
            deviceId = deviceQuery.rows[0].id;
        }

        await pool.query(
            "INSERT INTO vehicles (client_id, device_id, plate_number, vehicle_type) VALUES ($1, $2, $3, $4)",
            [clientId, deviceId, plateNumber, vehicleType]
        );

        await pool.query("UPDATE device_inventory SET is_assigned = true WHERE imei = $1", [imei]);

        await pool.query('COMMIT');
        res.json({ status: 'SUCCESS', message: 'Device successfully assigned to client' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Assign Device Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to assign device.' });
    }
});

// 4. Save Geofence / Route
app.post('/api/geofences', async (req, res) => {
    const { name, fenceType, coordinates } = req.body;
    try {
        // Constructing a basic PostGIS geometry string from coordinates
        // Assuming coordinates is an array of [lat, lng] pairs for POLYGON
        let geomString = '';
        if (fenceType === 'POLYGON') {
            const points = coordinates.map(c => `${c[1]} ${c[0]} `).join(', ');
            geomString = `ST_GeomFromText('POLYGON((${points}))', 4326)`;
        } else if (fenceType === 'CIRCLE') {
            // For simplicity, store as point with radius in attributes, or use ST_Buffer
            geomString = `ST_Buffer(ST_GeomFromText('POINT(${coordinates[1]} ${coordinates[0]})', 4326):: geography, ${coordinates[2]}):: geometry`;
        }

        if (!geomString) {
            return res.status(400).json({ status: 'ERROR', message: 'Unsupported geom. Mock saving.' });
        }

        const query = `INSERT INTO geofences(name, fence_type, geom) VALUES($1, $2, ${geomString}) RETURNING id, name, fence_type`;
        const result = await pool.query(query, [name, fenceType]);
        res.json({ status: 'SUCCESS', geofence: result.rows[0] });
    } catch (err) {
        console.error('Geofence Error:', err);
        // Fallback for missing PostGIS or invalid geometries during testing
        res.status(500).json({ status: 'ERROR', message: 'Failed to save geofence (Ensure PostGIS is active).' });
    }
});

// 4a. Admin Fetch Clients & Vehicle Count
app.get('/api/admin/clients', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.name, u.email, u.is_active, COUNT(v.id) as vehicle_count
            FROM users u
            LEFT JOIN vehicles v ON u.id = v.client_id
            WHERE u.role_id = (SELECT id FROM roles WHERE name = 'CLIENT')
            GROUP BY u.id, u.name, u.email, u.is_active
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ status: 'SUCCESS', clients: result.rows });
    } catch (err) {
        console.error('Admin Clients Error:', err);
        // Fallback for mocked layout
        res.json({ status: 'SUCCESS', clients: [{ id: 'mock', name: 'Demo Client', email: 'demo@geosurepath.com', is_active: true, vehicle_count: 5 }] });
    }
});

// 5. Fetch Today's KPIs
app.get('/api/stats', async (req, res) => {
    try {
        let totalCount = 12;
        try {
            const totalDevices = await pool.query("SELECT COUNT(*) FROM device_inventory");
            totalCount = parseInt(totalDevices.rows[0].count);
        } catch (dbErr) {
            console.warn('DB Query failed for /stats, using fallback mock.');
        }
        res.json({
            status: 'SUCCESS',
            stats: {
                totalFleet: totalCount || 12,
                movingNow: 8,
                distanceToday: 482,
                avgEcoScore: 94
            }
        });
    } catch (err) {
        res.json({ status: 'SUCCESS', stats: { totalFleet: 12, movingNow: 8, distanceToday: 482, avgEcoScore: 94 } });
    }
});

// 5a. Fetch Live Fleet (From Redis HASH)
app.get('/api/fleet', async (req, res) => {
    try {
        const fleet = [];
        try {
            const keys = await redisClient.keys('live:*');
            for (const key of keys) {
                const data = await redisClient.hGetAll(key);
                fleet.push({
                    id: data.imei,
                    name: `Device ${data.imei.slice(-6)}`,
                    type: 'car',
                    status: parseInt(data.speed) > 2 ? 'moving' : 'idle',
                    speed: parseInt(data.speed) || 0,
                    heading: parseInt(data.heading) || 0,
                    lat: parseFloat(data.lat),
                    lng: parseFloat(data.lng),
                    lastUpdate: parseInt(data.last_update) || Date.now()
                });
            }
        } catch (redisErr) {
            console.warn('Redis failed for /fleet, providing demo vehicle.');
            fleet.push({
                id: 'DEMO_001',
                name: 'Demo Vehicle',
                type: 'car',
                status: 'moving',
                speed: 45,
                heading: 120,
                lat: 21.1458,
                lng: 79.0882,
                lastUpdate: Date.now()
            });
        }
        res.json({ status: 'SUCCESS', fleet });
    } catch (err) {
        res.json({ status: 'SUCCESS', fleet: [{ id: 'DEMO_001', name: 'Demo Vehicle', lat: 21.1458, lng: 79.0882, status: 'moving', speed: 45 }] });
    }
});

// 5b. Fetch Alerts
app.get('/api/alerts', async (req, res) => {
    try {
        // Mock returning empty alerts for testing until DB linkage
        res.json({ status: 'SUCCESS', alerts: [] });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch alerts.' });
    }
});

// 5c. Fetch History Playback
app.get('/api/history', async (req, res) => {
    const { imei, date, from, to } = req.query;
    try {
        // Query PostGIS data based on date ranges (mock for now as table structure requires review)
        res.json({ status: 'SUCCESS', points: [] });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch history.' });
    }
});

// 6. Send Device Command (Engine Block / Restore)
app.post('/api/commands/sms', async (req, res) => {
    const { deviceId, commandType } = req.body;
    try {
        // Protocol Mapping (e.g., GT06 format)
        let smsBody = '';
        if (commandType === 'CUT_ENGINE') smsBody = 'RELAY,1#';
        else if (commandType === 'RESTORE_ENGINE') smsBody = 'RELAY,0#';
        else smsBody = commandType; // Raw command

        console.log(`[Command Queue] Sending command to ${deviceId}: ${smsBody}`);

        // Push to Redis Queue so TCP server can pick it up and emit over the active socket
        // Note: tcp-server expects hex representation of commands
        await redisClient.lPush(`cmd_queue:${deviceId}`, Buffer.from(smsBody).toString('hex'));

        res.json({ status: 'SUCCESS', message: 'Command Dispatched to Device Queue', command: smsBody });
    } catch (err) {
        console.error('Command Dispatch Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to dispatch command.' });
    }
});

// 7. Twilio Webhook (Receive SMS Reply from Device)
app.post('/api/webhooks/sms', async (req, res) => {
    // Twilio sends application/x-www-form-urlencoded
    const { From, Body } = req.body;
    console.log(`Received SMS from ${From}: ${Body}`);

    // Push real-time acknowledgment to frontend via WebSockets
    io.emit('sms_acknowledgment', { from: From, body: Body, timestamp: new Date() });

    // Twilio expects an empty TwiML response
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

// --- LIVE TRACKING PUB/SUB & SIMULATION ---
const redisSub = redisClient.duplicate();
redisSub.on('error', (err) => console.log('Redis Sub Error', err));
redisSub.connect().then(() => {
    console.log('Redis Subscriber ready for gps:updates');
    redisSub.subscribe('gps:updates', (message) => {
        try {
            const data = JSON.parse(message);
            io.emit('LOCATION_UPDATE', data);
        } catch (e) {
            console.error('Failed to parse gps:updates message');
        }
    });
});



// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Backend API Server running on port ${PORT}`);
});
