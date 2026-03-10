require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');
const { Pool } = require('pg');
const redis = require('redis');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://traccar:8082';
const TRACCAR_USER = process.env.TRACCAR_USER || 'admin';
const TRACCAR_PASS = process.env.TRACCAR_PASS || 'admin';
const TRACCAR_AUTH = Buffer.from(`${TRACCAR_USER}:${TRACCAR_PASS}`).toString('base64');
const fetch = require('node-fetch');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const googleDrive = require('./services/googleDrive');
const fs = require('fs');
const path = require('path');


const app = express();
const CommandFactory = {
    'GT06': (commandType) => {
        const s = commandType === 'ENGINE_STOP' ? 'Relay,1#' : 'Relay,0#';
        const b = Buffer.from(s, 'ascii');
        const d = Buffer.concat([Buffer.from([b.length, 0, 0, 0, 1]), b, Buffer.from([0, 2])]);
        const p = Buffer.concat([Buffer.from([d.length + 3, 0x80]), d, Buffer.from([0, 1])]);
        let c = 0xFFFF; for (const x of p) { c ^= x; for (let i = 0; i < 8; i++) c = (c & 1) ? (c >> 1) ^ 0xA001 : (c >> 1); }
        return Buffer.concat([Buffer.from([0x78, 0x78]), p, Buffer.from([c >> 8, c & 0xFF, 0x0D, 0x0A])]).toString('hex');
    },
    'TK103': (commandType) => Buffer.from(commandType === 'ENGINE_STOP' ? 'stop123456' : 'resume123456', 'ascii').toString('hex'),
    'H02': (commandType) => Buffer.from(commandType === 'ENGINE_STOP' ? '*HQ,MOBIL,S20,000000,1#' : '*HQ,MOBIL,S20,000000,0#', 'ascii').toString('hex'),
    'Teltonika': (commandType) => Buffer.from(commandType === 'ENGINE_STOP' ? 'setdigout 1' : 'setdigout 0', 'ascii').toString('hex')
};


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Email Transporter Setup
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
        user: process.env.SMTP_USER || 'test_user',
        pass: process.env.SMTP_PASS || 'test_pass'
    }
});

// Twilio Client Setup
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID || 'AC_mock',
    process.env.TWILIO_AUTH_TOKEN || 'auth_mock'
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for Twilio Webhooks

// Postgres Connection Pool
let pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432,
});

pool.on('error', () => { }); // Catch background pool idle errors

// Admin Provisioning Logic
const ensureAdminExists = async () => {
    const PORTAL_NAME = process.env.PORTAL_NAME || 'GeoSurePath';
    const adminEmail = process.env.ADMIN_EMAIL || `cadmin@${PORTAL_NAME.toLowerCase()}.com`;
    const adminPass = process.env.ADMIN_PASSWORD || 'admin@123';

    try {
        await pool.query('SELECT 1');
    } catch (e) {
        console.warn("[INIT] Local PostgreSQL disconnected. Initializing pg-mem (In-Memory Virtual Mode).");
        try {
            const { newDb } = require('pg-mem');
            const crypto = require('crypto');
            const fs = require('fs');
            const path = require('path');
            const db = newDb();

            db.public.registerFunction({
                name: 'uuid_generate_v4',
                args: [],
                returns: 'uuid',
                implementation: () => crypto.randomUUID(),
                impure: true
            });

            db.public.registerFunction({
                name: 'version',
                args: [],
                returns: 'text',
                implementation: () => 'PostgreSQL 14.1 (mocked by pg-mem)',
                impure: true
            });

            const schemaPath = path.join(__dirname, '../../database/schema.sql');
            let schemaSql = fs.readFileSync(schemaPath, 'utf8');
            schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/ig, '');
            schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/ig, '');
            schemaSql = schemaSql.replace(/geom geometry NOT NULL/ig, 'geom TEXT NOT NULL');
            schemaSql = schemaSql.replace(/PARTITION BY RANGE \(timestamp\)/ig, '');
            schemaSql = schemaSql.replace(/DECIMAL\(\d+,\s*\d+\)/ig, 'DECIMAL');

            db.public.none(schemaSql);

            const pgMock = db.adapters.createPg();
            pool = new pgMock.Pool();
            console.log("[INIT] Mock Database initialized.");
        } catch (memDbErr) {
            console.error("[INIT] Virtual Mode failed:", memDbErr);
            return;
        }
    }

    try {
        const result = await pool.query("SELECT COUNT(*) FROM users");
        if (parseInt(result.rows[0].count) === 0) {
            console.log(`[INIT] No users found. Provisioning admin: ${adminEmail}`);
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(adminPass, salt);

            const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'SUPER_ADMIN' OR name = 'ADMIN' LIMIT 1");
            if (roleRes.rows.length === 0) {
                console.error("[INIT] ADMIN role not found in database. Please run schema.sql first.");
                return;
            }
            const roleId = roleRes.rows[0].id;

            await pool.query(
                "INSERT INTO users (role_id, name, email, password_hash) VALUES ($1, $2, $3, $4)",
                [roleId, 'Super Admin', adminEmail, hash]
            );
            console.log("[INIT] Admin user provisioned successfully.");
        }
    } catch (e) {
        console.error("[INIT] Admin provisioning check failed:", e);
    }
};

ensureAdminExists();

// --- GPS SIMULATION ENGINE (For Demo/Development) ---
const SIMULATE = process.env.SIMULATE === 'true' || true; // Default to true for now to show results
if (SIMULATE) {
    const simulateDevices = async () => {
        const simImeis = ['869727079043558', '869727079043556', '869727079043554'];
        console.log(`[SIMULATOR] Starting live telemetry simulation for: ${simImeis.join(', ')}`);

        // Initial positions around Pune/Mumbai area
        const states = {
            '869727079043558': { lat: 18.5204, lng: 73.8567, speed: 45 },
            '869727079043556': { lat: 18.5304, lng: 73.8667, speed: 0 },
            '869727079043554': { lat: 18.5404, lng: 73.8767, speed: 85 }
        };

        setInterval(async () => {
            for (const imei of simImeis) {
                const s = states[imei];
                if (s.speed > 0) {
                    s.lat += (Math.random() - 0.5) * 0.0005;
                    s.lng += (Math.random() - 0.5) * 0.0005;
                }

                const packet = {
                    imei,
                    lat: s.lat,
                    lng: s.lng,
                    speed: s.speed,
                    heading: Math.floor(Math.random() * 360),
                    ignition: s.speed > 0,
                    device_timestamp: new Date().toISOString(),
                    isRealTime: true
                };

                // Dispatch to Redis Alert Engine
                if (redisClient && redisClient.isOpen) {
                    await redisClient.publish('gps:updates', JSON.stringify(packet));
                    await redisClient.hSet(`live:${imei}`, {
                        imei,
                        lat: s.lat.toString(),
                        lng: s.lng.toString(),
                        speed: s.speed.toString(),
                        heading: packet.heading.toString(),
                        last_update: Date.now().toString()
                    });
                }
            }
        }, 3000);
    };
    setTimeout(simulateDevices, 5000);
}


// Redis Client (with robust fallback)
let redisClient;
const createMockRedis = () => ({
    on: () => { },
    connect: async () => console.log('[Redis_MOCK] Operating in Virtual Mode'),
    get: async () => null,
    set: async () => 'OK',
    rPush: async () => 1,
    del: async () => 1,
    keys: async () => []
});

try {
    redisClient = redis.createClient({
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
        socket: { reconnectStrategy: (retries) => (retries > 30 ? false : Math.min(retries * 100, 3000)) }
    });
    redisClient.on('error', () => { redisClient = createMockRedis(); });
    redisClient.connect().catch(() => { redisClient = createMockRedis(); });
} catch (e) {
    redisClient = createMockRedis();
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
    if (reason && (reason.code === 'ECONNREFUSED' || reason.code === 'ECONNRESET')) {
        console.log(`[NETWORK] suppressed unhandled rejection: ${reason.message}`);
    } else {
        console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
    }
});

// WebSocket
io.on('connection', async (socket) => {
    console.log('New client connected:', socket.id);

    const userId = socket.handshake.auth?.userId;
    const role = socket.handshake.auth?.role;

    if (userId && role === 'CLIENT') {
        try {
            // Fetch assigned IMEIs for this client
            const result = await pool.query(`
                SELECT d.imei FROM devices d 
                JOIN vehicles v ON d.id = v.device_id 
                WHERE v.client_id = $1 AND v.is_active = true
            `, [userId]);

            const assignedImeis = result.rows.map(r => r.imei);

            // Join specific rooms for each assigned IMEI
            assignedImeis.forEach(imei => {
                socket.join(`imei_${imei}`);
            });
            console.log(`Socket ${socket.id} (Client) joined ${assignedImeis.length} IMEI rooms.`);
        } catch (err) {
            console.error('WebSocket auth query error:', err);
        }
    } else if (role === 'ADMIN') {
        // Admins join an admin room to receive everything
        socket.join('admin_room');
        console.log(`Socket ${socket.id} (Admin) joined admin_room.`);
    }

    // Existing room join fallback
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ===============================================================
// REAL-TIME GPS ALERT ENGINE
// Subscribes to Redis gps:updates (published by tcp-server)
// Emits: LOCATION_UPDATE (live tracking) + GPS_ALERT (notifications)
// ===============================================================
const geofenceStateCache = {}; // { imei: { geofenceId: 'inside'|'outside', lastSpeed: N } }
const SPEED_LIMIT_KMH = 80;

function pointInPolygon(lat, lng, points) {
    let inside = false;
    // points are [lat, lng]
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i][0], yi = points[i][1]; // xi=lat, yi=lng
        const xj = points[j][0], yj = points[j][1]; // xj=lat, yj=lng

        const intersect = ((yi > lng) !== (yj > lng))
            && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInCircle(lat, lng, cLat, cLng, radiusM) {
    const R = 6371000, dLat = (lat - cLat) * Math.PI / 180, dLng = (lng - cLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(cLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusM;
}

function emitAlert(imei, payload) {
    io.to(`imei_${imei}`).emit('GPS_ALERT', payload);
    io.to('admin_room').emit('GPS_ALERT', payload);
    console.log(`[ALERT] ${payload.type} for ${imei}`);
}

const setupRedisAlertSubscriber = async () => {
    try {
        const redisSub = redis.createClient({
            url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
            socket: { reconnectStrategy: (r) => (r > 30 ? false : Math.min(r * 100, 3000)) }
        });
        redisSub.on('error', (e) => console.error('[AlertSub] Redis:', e.message));
        await redisSub.connect();

        await redisSub.subscribe('gps:updates', async (rawMsg) => {
            let msg;
            try { msg = JSON.parse(rawMsg); } catch { return; }
            const { imei, lat, lng, speed } = msg;
            if (!imei || lat == null || lng == null) return;

            const latN = parseFloat(lat), lngN = parseFloat(lng), speedN = parseFloat(speed) || 0;

            // Look up vehicle info for rich messages
            let vehicleName = imei, plateNumber = 'N/A', clientId = null;
            try {
                const vr = await pool.query(`
                    SELECT v.vehicle_name, v.plate_number, v.client_id FROM vehicles v
                    JOIN devices d ON d.id = v.device_id
                    WHERE d.imei = $1 AND v.is_active = true LIMIT 1`, [imei]);
                if (vr.rows.length > 0) {
                    vehicleName = vr.rows[0].vehicle_name || imei;
                    plateNumber = vr.rows[0].plate_number || 'N/A';
                    clientId = vr.rows[0].client_id;
                }
            } catch { /* continue */ }

            // Forward LOCATION_UPDATE to socket rooms in real-time
            // ONLY if it is a real-time packet (not a re-upload of historical data)
            if (msg.isRealTime !== false) {
                const locPayload = {
                    imei,
                    lat: latN,
                    lng: lngN,
                    speed: speedN,
                    heading: parseFloat(msg.heading) || 0,
                    satellites: msg.satellites,
                    gps_fixed: msg.gps_fixed,
                    timestamp: msg.device_timestamp // Use original device time
                };
                io.to(`imei_${imei}`).emit('LOCATION_UPDATE', locPayload);
                io.to('admin_room').emit('LOCATION_UPDATE', locPayload);
            }

            // High-frequency history storage for re-uploads is already handled by tcp-server directly into DB.
            // But we process alerts (overspeed/geofence) for ALL packets to ensure history has correct alerts.

            // Overspeed detection (transition-based)
            if (!geofenceStateCache[imei]) geofenceStateCache[imei] = { lastSpeed: 0 };
            const prevSpeed = geofenceStateCache[imei].lastSpeed || 0;
            if (speedN > SPEED_LIMIT_KMH && prevSpeed <= SPEED_LIMIT_KMH) {
                emitAlert(imei, {
                    type: 'OVERSPEED', imei, vehicleName, plate: plateNumber, lat: latN, lng: lngN,
                    message: `Vehicle "${vehicleName}" (${plateNumber}) overspeeding at ${Math.round(speedN)} km/h. Limit: ${SPEED_LIMIT_KMH} km/h. IMEI: ${imei}. Location: ${latN.toFixed(5)}, ${lngN.toFixed(5)}.`,
                    timestamp: msg.device_timestamp || new Date().toISOString(),
                });
            }
            geofenceStateCache[imei].lastSpeed = speedN;

            // Geofence crossing detection
            try {
                const geoRes = await pool.query(
                    `SELECT id, name, shape_type, coordinates, radius FROM geofences WHERE is_active = true AND (client_id = $1 OR client_id IS NULL)`,
                    [clientId]
                );
                for (const geo of geoRes.rows) {
                    let isInside = false;
                    try {
                        const coords = typeof geo.coordinates === 'string' ? JSON.parse(geo.coordinates) : geo.coordinates;
                        if (geo.shape_type === 'circle' && coords && coords.center) {
                            isInside = pointInCircle(latN, lngN, coords.center[0], coords.center[1], geo.radius || 100);
                        } else if (Array.isArray(coords) && coords.length >= 3) {
                            isInside = pointInPolygon(latN, lngN, coords);
                        }
                    } catch { continue; }

                    const prevState = geofenceStateCache[imei][geo.id] || 'outside';
                    const currState = isInside ? 'inside' : 'outside';
                    if (prevState !== currState) {
                        geofenceStateCache[imei][geo.id] = currState;
                        const isEntry = currState === 'inside';
                        emitAlert(imei, {
                            type: isEntry ? 'GEOFENCE_ENTER' : 'GEOFENCE_EXIT',
                            imei, vehicleName, plate: plateNumber, lat: latN, lng: lngN,
                            geofenceName: geo.name,
                            message: `Vehicle "${vehicleName}" (Plate: ${plateNumber}, IMEI: ${imei}) has ${isEntry ? 'ENTERED' : 'EXITED'} geofence zone "${geo.name}". Location: ${latN.toFixed(5)}, ${lngN.toFixed(5)}.`,
                            timestamp: msg.device_timestamp || new Date().toISOString(),
                        });
                    }
                }
            } catch { /* geofence check failed */ }
        });
        console.log('[AlertSub] GPS Alert Engine active — subscribed to gps:updates');
    } catch (e) {
        console.error('[AlertSub] Could not start GPS Alert Engine:', e.message);
    }
};

setTimeout(setupRedisAlertSubscriber, 3000); // Start after Redis is ready

// Basic Health Endpoint
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'OK', message: 'SaaS Platform Backend is running.' });
});

// Auto-create Demo Leads Table
pool.query(`
    CREATE TABLE IF NOT EXISTS demo_leads (
        id SERIAL PRIMARY KEY,
        contact VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => console.error("[DB] Expected error or success ensuring demo_leads table", err?.message));

// --- REST API ENDPOINTS ---


// 1.2 Add New Vehicle to Existing Account
app.post('/api/vehicles/add', async (req, res) => {
    const { userId, imei, vehicleName, plateNumber } = req.body;
    try {
        await pool.query('BEGIN');

        // Validate IMEI
        const inventoryCheck = await pool.query("SELECT * FROM device_inventory WHERE imei = $1", [imei]);
        if (inventoryCheck.rows.length === 0 || inventoryCheck.rows[0].is_assigned) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ status: 'ERROR', message: 'IMEI invalid or already assigned.' });
        }

        // Ensure device exists
        let deviceQuery = await pool.query("SELECT id FROM devices WHERE imei = $1", [imei]);
        let deviceId;
        if (deviceQuery.rows.length === 0) {
            const insertDevice = await pool.query("INSERT INTO devices (imei, status) VALUES ($1, 'OFFLINE') RETURNING id", [imei]);
            deviceId = insertDevice.rows[0].id;
        } else {
            deviceId = deviceQuery.rows[0].id;
        }

        // Create Vehicle link
        await pool.query(
            "INSERT INTO vehicles (client_id, device_id, plate_number, vehicle_type, vehicle_name) VALUES ($1, $2, $3, $4, $5)",
            [userId, deviceId, plateNumber || 'TBD', 'car', vehicleName || 'New Vehicle']
        );

        // Update Inventory
        await pool.query("UPDATE device_inventory SET is_assigned = true WHERE imei = $1", [imei]);

        await pool.query('COMMIT');
        res.json({ status: 'SUCCESS', message: 'Vehicle added successfully.' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ status: 'ERROR', message: 'Failed to add vehicle.' });
    }
});

// 1.3 Remove (Soft-Delete) Vehicle
app.post('/api/vehicles/remove', async (req, res) => {
    const { vehicleId } = req.body;
    try {
        await pool.query('UPDATE vehicles SET is_active = false WHERE id = $1', [vehicleId]);
        res.json({ status: 'SUCCESS', message: 'Vehicle marked as inactive.' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to remove vehicle.' });
    }
});

// 1.5. User Login Endpoint (Proxied to Traccar)

// --- PUBLIC REGISTRATION ---
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ status: 'ERROR', message: 'Name, Email, and Password are required.' });
    }

    try {
        // 1. Create User in Traccar (Bypasses local DB first to ensure Traccar sync)
        const traccarUserRes = await fetch(`${TRACCAR_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${TRACCAR_AUTH}`
            },
            body: JSON.stringify({ name, email, password, administrator: false })
        });

        if (!traccarUserRes.ok) {
            const errorText = await traccarUserRes.text();
            console.error('[Traccar] Registration failed:', errorText);

            // If user already exists in Traccar, we might want to check local DB
            if (errorText.includes('duplicate') || errorText.includes('already exists')) {
                return res.status(400).json({ status: 'ERROR', message: 'Account already exists.' });
            }
            return res.status(500).json({ status: 'ERROR', message: 'Failed to sync with tracking engine.' });
        }

        const traccarUser = await traccarUserRes.json();

        // 2. Create in Local database
        try {
            await pool.query('BEGIN');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'CLIENT'");
            if (roleRes.rows.length === 0) {
                throw new Error("CLIENT role not found. System misconfigured.");
            }
            const roleId = roleRes.rows[0].id;

            await pool.query(
                `INSERT INTO users (role_id, name, email, password_hash, password_text, phone, traccar_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [roleId, name, email, hash, password, phone || '', traccarUser.id]
            );
            await pool.query('COMMIT');

            res.json({ status: 'SUCCESS', message: 'Registration successful. Welcome to GeoSurePath!' });
        } catch (dbErr) {
            await pool.query('ROLLBACK');
            console.error('[DB] Registration Rollback Trace:', dbErr);
            res.status(500).json({ status: 'ERROR', message: 'Internal Database Error during registration.' });
        }
    } catch (err) {
        console.error('[AUTH] Critical Registration Failure:', err);
        res.status(500).json({ status: 'ERROR', message: 'System unreachable. Please try again later.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log(`[AuthProxy] Login attempt for ${email} via Traccar...`);

        // 1. Authenticate with Traccar
        const traccarRes = await fetch(`${TRACCAR_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email, password })
        });

        if (traccarRes.ok) {
            const traccarUser = await traccarRes.json();
            const setCookie = traccarRes.headers.get('set-cookie');

            // 2. Fetch/Sync local role info
            const localUser = await pool.query(`
                SELECT u.id, r.name as role
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.email = $1
            `, [email]);

            const role = localUser.rows.length > 0 ? localUser.rows[0].role : (traccarUser.administrator ? 'ADMIN' : 'CLIENT');

            console.log(`[AuthProxy] Success for ${email} (${role})`);

            // Forward the Traccar session cookie to the frontend
            if (setCookie) res.setHeader('Set-Cookie', setCookie);

            res.json({
                status: 'SUCCESS',
                user: {
                    id: traccarUser.id,
                    name: traccarUser.name,
                    email: traccarUser.email,
                    role: role,
                    traccarId: traccarUser.id
                }
            });
        } else {
            console.warn(`[AuthProxy] Traccar rejected login for ${email}`);
            res.status(401).json({ status: 'ERROR', message: 'Invalid credentials or Traccar unavailable.' });
        }
    } catch (err) {
        console.error('[AuthProxy] Server Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error during authentication proxy.' });
    }
});

// 1.7. Password Reset Endpoint (for logged-in users)
app.post('/api/reset-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    try {
        const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'User not found.' });
        }

        const user = result.rows[0];
        if (!await bcrypt.compare(currentPassword, user.password_hash)) {
            return res.status(401).json({ status: 'ERROR', message: 'Current password incorrect.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await pool.query("UPDATE users SET password_hash = $1, password_text = $2 WHERE id = $3", [passwordHash, newPassword, userId]);

        res.json({ status: 'SUCCESS', message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to reset password.' });
    }
});

// 1.8. Forgot Password Reset via Mock OTP
app.post('/api/auth/reset-password-otp', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Email not registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.query("UPDATE users SET password_hash = $1, password_text = $2 WHERE email = $3", [passwordHash, newPassword, email]);

        res.json({ status: 'SUCCESS', message: 'Password has been successfully reset.' });
    } catch (err) {
        console.error('Forgot Password Reset Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to reset password.' });
    }
});

// Profile Update
app.post('/api/update-profile', async (req, res) => {
    const { userId, name, email } = req.body;
    try {
        await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [name, email, userId]);
        const result = await pool.query("SELECT id, name, email, role_id FROM users WHERE id = $1", [userId]);
        // Re-fetch role name for frontend
        const roleQuery = await pool.query("SELECT name FROM roles WHERE id = $1", [result.rows[0].role_id]);

        const updatedUser = {
            id: result.rows[0].id,
            name: result.rows[0].name,
            email: result.rows[0].email,
            role: roleQuery.rows.length > 0 ? roleQuery.rows[0].name : 'CLIENT'
        };
        res.json({ status: 'SUCCESS', user: updatedUser });
    } catch (err) {
        console.error('Update Profile Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update profile.' });
    }
});

// Password Reset (Settings)
app.post('/api/reset-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    try {
        const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
        if (result.rows.length === 0) return res.status(404).json({ status: 'ERROR', message: 'User not found.' });

        const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!isMatch) return res.status(400).json({ status: 'ERROR', message: 'Incorrect current password.' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
        res.json({ status: 'SUCCESS' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update password.' });
    }
});

// 2. Add Device to Inventory (Admin)
app.post('/api/inventory', async (req, res) => {
    const { imei, sim, status, protocol } = req.body;
    try {
        const isAssigned = status !== 'Unassigned';
        const result = await pool.query(
            "INSERT INTO device_inventory (imei, sim_number, is_assigned, protocol) VALUES ($1, $2, $3, $4) RETURNING *",
            [imei, sim, isAssigned, protocol || 'GT06']
        );
        res.json({ status: 'SUCCESS', device: result.rows[0] });
    } catch (err) {
        console.error('Inventory Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to add to inventory.' });
    }
});

// 1.6 Fetch Devices from Traccar (Proxied)
app.get('/api/devices', async (req, res) => {
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/devices`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Cookie': req.headers.cookie || ''
            }
        });

        if (traccarRes.ok) {
            const devices = await traccarRes.json();
            res.json({ status: 'SUCCESS', devices });
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR', message: 'Failed to fetch devices from Traccar' });
        }
    } catch (err) {
        console.error('[DeviceProxy] Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// 1.7 Sync Attributes/Computed Attributes
app.get('/api/attributes/computed', async (req, res) => {
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/attributes/computed`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Cookie': req.headers.cookie || ''
            }
        });
        if (traccarRes.ok) {
            const attributes = await traccarRes.json();
            res.json({ status: 'SUCCESS', attributes });
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR' });
        }
    } catch (err) {
        res.status(500).json({ status: 'ERROR' });
    }
});

// 1.8 Reports Proxy (Trips, Stops, Summary)
app.get('/api/reports/:type', async (req, res) => {
    const { type } = req.params;
    const { deviceId, from, to } = req.query;
    try {
        const url = new URL(`${TRACCAR_URL}/api/reports/${type}`);
        if (deviceId) url.searchParams.append('deviceId', deviceId);
        if (from) url.searchParams.append('from', from);
        if (to) url.searchParams.append('to', to);

        const traccarRes = await fetch(url.toString(), {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Accept': 'application/json',
                'Cookie': req.headers.cookie || ''
            }
        });

        if (traccarRes.ok) {
            const data = await traccarRes.json();
            res.json(data);
        } else {
            const errorText = await traccarRes.text();
            res.status(traccarRes.status).json({ status: 'ERROR', message: errorText });
        }
    } catch (err) {
        console.error(`[ReportProxy] ${type} Error:`, err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch report from telemetry engine' });
    }
});

// 1.9 Geofence Proxy (List)
app.get('/api/geofences', async (req, res) => {
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/geofences`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Cookie': req.headers.cookie || ''
            }
        });
        if (traccarRes.ok) {
            const fences = await traccarRes.json();
            const formatted = fences.map(f => {
                let coordinates = [];
                let fence_type = 'POLYGON';
                if (f.area.startsWith('CIRCLE')) {
                    const match = f.area.match(/CIRCLE\((.*) (.*), (.*)\)/);
                    if (match) {
                        coordinates = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
                        fence_type = 'CIRCLE';
                    }
                } else if (f.area.startsWith('POLYGON')) {
                    const points = f.area.replace('POLYGON((', '').replace('))', '').split(', ');
                    coordinates = points.map(p => {
                        const [lat, lng] = p.split(' ');
                        return [parseFloat(lat), parseFloat(lng)];
                    });
                }
                return { ...f, coordinates, fence_type };
            });
            res.json({ status: 'SUCCESS', geofences: formatted });
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR' });
        }
    } catch (err) {
        res.status(500).json({ status: 'ERROR' });
    }
});

// 1.11 Positions Proxy
app.get('/api/positions', async (req, res) => {
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/positions`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Cookie': req.headers.cookie || ''
            }
        });
        if (traccarRes.ok) {
            const positions = await traccarRes.json();
            res.json(positions);
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR' });
        }
    } catch (err) {
        res.status(500).json({ status: 'ERROR' });
    }
});

// 3a. Admin Assign Device to Client
app.post('/api/admin/devices/assign', async (req, res) => {
    const { clientId, imei, plateNumber, vehicleType, vehicleName } = req.body;
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
            "INSERT INTO vehicles (client_id, device_id, plate_number, vehicle_type, vehicle_name) VALUES ($1, $2, $3, $4, $5)",
            [clientId, deviceId, plateNumber, vehicleType, vehicleName || 'New Vehicle']
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

// 4. Save Geofence (Proxy to Traccar)
app.post('/api/geofences', async (req, res) => {
    const { name, fence_type, coordinates } = req.body;
    try {
        // Convert internal format to Traccar format (WKT)
        let area = '';
        if (fence_type === 'POLYGON' || fence_type === 'ROUTE') {
            const points = coordinates.map(c => `${c[0]} ${c[1]}`).join(', ');
            area = `POLYGON((${points}))`;
        } else if (fence_type === 'CIRCLE') {
            area = `CIRCLE(${coordinates[0]} ${coordinates[1]}, ${coordinates[2]})`;
        }

        const traccarRes = await fetch(`${TRACCAR_URL}/api/geofences`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Content-Type': 'application/json',
                'Cookie': req.headers.cookie || ''
            },
            body: JSON.stringify({ name, area })
        });

        if (traccarRes.ok) {
            const fence = await traccarRes.json();
            res.json({ status: 'SUCCESS', geofence: fence });
        } else {
            const errorText = await traccarRes.text();
            res.status(traccarRes.status).json({ status: 'ERROR', message: errorText });
        }
    } catch (err) {
        console.error('Geofence Proxy Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to synchronize geofence' });
    }
});

// 4.1. Delete Geofence (Proxy to Traccar)
app.delete('/api/geofences/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/geofences/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Cookie': req.headers.cookie || ''
            }
        });
        if (traccarRes.ok) {
            res.json({ status: 'SUCCESS' });
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR' });
        }
    } catch (err) {
        res.status(500).json({ status: 'ERROR' });
    }
});

// 4.2. Link Geofence to Device (Permissions Proxy)
app.post('/api/permissions', async (req, res) => {
    try {
        const traccarRes = await fetch(`${TRACCAR_URL}/api/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Content-Type': 'application/json',
                'Cookie': req.headers.cookie || ''
            },
            body: JSON.stringify(req.body)
        });
        if (traccarRes.ok) {
            res.json({ status: 'SUCCESS' });
        } else {
            res.status(traccarRes.status).json({ status: 'ERROR' });
        }
    } catch (err) {
        res.status(500).json({ status: 'ERROR' });
    }
});

// Removed local geofence fetch (using proxy instead)

// 4a. Admin Fetch Clients & Vehicle Count
app.get('/api/admin/clients', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.name, u.email, u.is_active, u.is_blocked, u.subscription_plan, u.subscription_end_date, COUNT(v.id) as vehicle_count
            FROM users u
            LEFT JOIN vehicles v ON u.id = v.client_id
            WHERE u.role_id = (SELECT id FROM roles WHERE name = 'CLIENT')
            GROUP BY u.id, u.name, u.email, u.is_active, u.is_blocked, u.subscription_plan, u.subscription_end_date
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ status: 'SUCCESS', clients: result.rows });
    } catch (err) {
        console.error('Admin Clients Error:', err);
        res.json({ status: 'SUCCESS', clients: [{ id: 'mock', name: 'System Auditor', email: 'audit@system.local', is_active: true, is_blocked: false, vehicle_count: 0 }] });
    }
});

// 4b. Admin Toggle User Block Status
app.post('/api/admin/clients/toggle-block', async (req, res) => {
    const { userId, blocked } = req.body;
    try {
        await pool.query("UPDATE users SET is_blocked = $1 WHERE id = $2", [blocked, userId]);
        res.json({ status: 'SUCCESS', message: `User account ${blocked ? 'blocked' : 'unblocked'} successfully.` });
    } catch (err) {
        console.error('Toggle Block Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update user status.' });
    }
});

// 4c. Admin Renew Subscription
app.post('/api/admin/clients/renew', async (req, res) => {
    const { userId, daysToAdd } = req.body;
    try {
        await pool.query("UPDATE users SET subscription_end_date = COALESCE(subscription_end_date, CURRENT_TIMESTAMP) + ($1 || ' days')::INTERVAL WHERE id = $2", [daysToAdd || 365, userId]);
        res.json({ status: 'SUCCESS', message: `Subscription extended by ${daysToAdd || 365} days.` });
    } catch (err) {
        console.error('Renew Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to renew subscription.' });
    }
});

// 4d. Admin Impersonate Client (Remote Access)
app.post('/api/admin/clients/impersonate', async (req, res) => {
    const { userId } = req.body;
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, r.name as role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Client not found.' });
        }

        const user = result.rows[0];
        res.json({
            status: 'SUCCESS',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isImpersonated: true
            }
        });
    } catch (err) {
        console.error('Impersonate Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to access client account.' });
    }
});

// 4e. Admin Direct Authorize Client
app.post('/api/admin/clients/create', async (req, res) => {
    const { name, email, password, phone } = req.body;
    try {
        await pool.query('BEGIN');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'CLIENT'");
        const roleId = roleRes.rows[0].id;

        const userRes = await pool.query(
            "INSERT INTO users (role_id, name, email, password_hash, password_text, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [roleId, name, email, hash, password, phone]
        );
        const userId = userRes.rows[0].id;

        await pool.query('COMMIT');
        res.json({ status: 'SUCCESS', message: 'Client authorized successfully.', userId });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Admin Client Creation Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to authorize client.' });
    }
});

// 4d. Admin Update Client Details
app.post('/api/admin/clients/update', async (req, res) => {
    const { userId, name, email, password } = req.body;
    try {
        let query = "UPDATE users SET name = $1, email = $2";
        const params = [name, email, userId];

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            query += ", password_hash = $4, password_text = $5";
            params.push(hash, password);
        }

        query += " WHERE id = $3";
        await pool.query(query, params);
        res.json({ status: 'SUCCESS', message: 'User details updated successfully.' });
    } catch (err) {
        console.error('Admin Update Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update user.' });
    }
});

// 4e. Admin Update Billing (Plan/Expiry)
app.patch('/api/admin/clients/:userId/billing', async (req, res) => {
    const { userId } = req.params;
    const { subscriptionPlan, subscriptionEndDate } = req.body;
    try {
        await pool.query(
            "UPDATE users SET subscription_plan = $1, subscription_end_date = $2 WHERE id = $3",
            [subscriptionPlan, subscriptionEndDate || null, userId]
        );
        res.json({ status: 'SUCCESS', message: 'Billing manually updated by authority override.' });
    } catch (err) {
        console.error('Billing Update Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Override failed at database layer.' });
    }
});

// --- ADVANCED ADMIN CONTROLS: DATA ARCHIVAL & BACKUPS ---

// Daily Google Drive Backup Task (Running at 1 AM)
// Modified to maintain LIFETIME tracking data in local DB while still backing up offsite
cron.schedule('0 1 * * *', async () => {
    console.log('[Backup System] Initiating Daily Cloud Backup to Google Drive...');
    try {
        // 1. Fetch data from the last 24 hours for incremental backup
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const result = await pool.query(
            "SELECT * FROM gps_history WHERE timestamp >= $1",
            [yesterday]
        );

        if (result.rows.length === 0) {
            console.log('[Backup System] No new data to backup from last 24h.');
        } else {
            // 2. Export to JSON file
            const fileName = `daily_backup_${new Date().toISOString().split('T')[0]}.json`;
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const filePath = path.join(tempDir, fileName);

            fs.writeFileSync(filePath, JSON.stringify({
                type: 'INCREMENTAL',
                date: yesterday.toISOString().split('T')[0],
                count: result.rows.length,
                data: result.rows
            }, null, 2));

            // 3. Upload to Google Drive (Incremental)
            await googleDrive.uploadFile(filePath, process.env.GOOGLE_BACKUP_FOLDER_ID || '1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8');
            fs.unlinkSync(filePath);
            console.log(`[Backup System] Incremental backup of ${result.rows.length} records completed.`);
        }

        // 4. PERIODIC FULL SNAPSHOT (Mondays at 1:30 AM)
        if (new Date().getDay() === 1) {
            console.log('[Backup System] Initiating Weekly Full System Snapshot...');
            const tables = ['users', 'devices', 'vehicles', 'device_inventory', 'command_logs'];
            const fullBackup = {};
            for (const table of tables) {
                const res = await pool.query(`SELECT * FROM ${table}`);
                fullBackup[table] = res.rows;
            }

            const snapName = `full_snapshot_${new Date().toISOString().split('T')[0]}.json`;
            const snapPath = path.join(__dirname, '../temp', snapName);
            fs.writeFileSync(snapPath, JSON.stringify(fullBackup, null, 2));
            await googleDrive.uploadFile(snapPath, process.env.GOOGLE_BACKUP_FOLDER_ID || '1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8');
            fs.unlinkSync(snapPath);
            console.log('[Backup System] Weekly Full Snapshot completed.');
        }

        // !!! IMPORTANT: PRUNING DISABLED !!!
        // We no longer delete from gps_history to maintain "LIFETIME DATA"
        // await pool.query("DELETE FROM gps_history WHERE timestamp < $1", [pruningDate]);

    } catch (err) {
        console.error('[Backup System] Backup CRITICAL ERROR:', err);
    }
});

// 5. Fetch Today's KPIs
app.get('/api/stats', async (req, res) => {
    try {
        const totalDevices = await pool.query("SELECT COUNT(*) FROM device_inventory");
        res.json({
            status: 'SUCCESS',
            stats: {
                totalFleet: parseInt(totalDevices.rows[0].count),
                movingNow: 0, // Would need more complex query for real-time
                distanceToday: 0,
                avgEcoScore: 100
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch stats.' });
    }
});

// 5a. Fetch Live Fleet (From Redis HASH or Mock)
app.get('/api/fleet', async (req, res) => {
    const { userId, role } = req.query;
    try {
        let vehicleMetadata = {};
        if (role === 'CLIENT' && userId) {
            const result = await pool.query(`
                SELECT d.imei, v.id as vehicle_id, v.vehicle_number, v.driver_name FROM devices d 
                JOIN vehicles v ON d.id = v.device_id 
                WHERE v.client_id = $1 AND v.is_active = true
            `, [userId]);
            result.rows.forEach(r => {
                vehicleMetadata[r.imei] = r;
            });
        }

        const allowedImeis = new Set(Object.keys(vehicleMetadata));

        const fleet = [];
        try {
            const keys = await redisClient.keys('live:*');
            for (const key of keys) {
                const data = await redisClient.hGetAll(key);
                if (role === 'ADMIN' || allowedImeis.has(data.imei)) {
                    const meta = vehicleMetadata[data.imei] || {};
                    fleet.push({
                        id: data.imei,
                        vehicle_id: meta.vehicle_id,
                        name: meta.vehicle_number || `Device ${data.imei.slice(-6)}`,
                        plate_number: meta.driver_name,
                        type: 'car',
                        status: parseInt(data.speed) > 2 ? 'moving' : 'idle',
                        speed: parseInt(data.speed) || 0,
                        heading: parseInt(data.heading) || 0,
                        lat: parseFloat(data.lat),
                        lng: parseFloat(data.lng),
                        lastUpdate: parseInt(data.last_update) || Date.now()
                    });
                }
            }
        } catch (redisErr) {
            console.error('Redis failed for /fleet:', redisErr.message);
            return res.status(503).json({ status: 'ERROR', message: 'Live tracking service unavailable.' });
        }
        res.json({ status: 'SUCCESS', fleet });
    } catch (err) {
        console.error('Fleet API Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error.' });
    }
});

// 5b. Fetch Alerts
app.get('/api/alerts', async (req, res) => {
    const { userId, role } = req.query;
    try {
        const result = role === 'ADMIN'
            ? await pool.query("SELECT a.*, d.imei FROM alerts a JOIN devices d ON a.device_id = d.id ORDER BY timestamp DESC LIMIT 10")
            : await pool.query("SELECT a.*, d.imei FROM alerts a JOIN devices d ON a.device_id = d.id JOIN vehicles v ON d.id = v.device_id WHERE v.client_id = $1 ORDER BY timestamp DESC LIMIT 10", [userId]);
        res.json({ status: 'SUCCESS', alerts: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch alerts.' });
    }
});

// 5b. Geofence Operations
app.get('/api/geofences', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, fence_type, coordinates FROM geofences');
        res.json({ status: 'SUCCESS', geofences: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch geofences' });
    }
});

app.post('/api/geofences', async (req, res) => {
    const { name, fence_type, coordinates, user_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO geofences (name, fence_type, coordinates, user_id) VALUES ($1, $2, $3, $4)',
            [name, fence_type, JSON.stringify(coordinates), user_id || req.user?.id]
        );
        res.json({ status: 'SUCCESS' });
    } catch (err) {
        console.error("Geofence save error:", err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to save geofence' });
    }
});

// 5d. Alert Rules
app.get('/api/alerts/rules', async (req, res) => {
    const userId = req.query.user_id || req.user?.id;
    try {
        const result = await pool.query('SELECT * FROM alert_rules WHERE user_id = $1', [userId]);
        res.json({ status: 'SUCCESS', rules: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch rules' });
    }
});

app.post('/api/alerts/rules', async (req, res) => {
    const { name, type, conditions, user_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO alert_rules (name, type, conditions, user_id) VALUES ($1, $2, $3, $4)',
            [name, type, JSON.stringify(conditions), user_id || req.user?.id]
        );
        res.json({ status: 'SUCCESS' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to save rule' });
    }
});

// 5e. Notification Profiles
app.get('/api/notifications/profiles', async (req, res) => {
    const userId = req.query.user_id || req.user?.id;
    try {
        const result = await pool.query('SELECT * FROM notification_profiles WHERE user_id = $1', [userId]);
        res.json({ status: 'SUCCESS', profile: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch profiles' });
    }
});

app.post('/api/notifications/profiles', async (req, res) => {
    const { email, phone, user_id } = req.body;
    try {
        await pool.query(`
            INSERT INTO notification_profiles (user_id, email, phone)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone
        `, [user_id || req.user?.id, email, phone]);
        res.json({ status: 'SUCCESS' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to save profile' });
    }
});

// 5f. Georoutes
app.get('/api/georoutes', async (req, res) => {
    const userId = req.query.user_id || req.user?.id;
    try {
        const result = await pool.query('SELECT * FROM georoutes WHERE user_id = $1', [userId]);
        res.json({ status: 'SUCCESS', georoutes: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch georoutes' });
    }
});

app.post('/api/georoutes', async (req, res) => {
    const { name, coordinates, user_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO georoutes (name, coordinates, user_id) VALUES ($1, $2, $3)',
            [name, JSON.stringify(coordinates), user_id || req.user?.id]
        );
        res.json({ status: 'SUCCESS' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to save georoute' });
    }
});

// 5c. Fetch History Playback
app.get('/api/history', async (req, res) => {
    const { imei, from, to } = req.query; // Expecting ISO strings
    try {
        const fromDate = new Date(from);
        const archivalLimit = new Date();
        archivalLimit.setDate(archivalLimit.getDate() - 180);

        let points = [];

        // CASE A: Requested range is within 180 days (Server Storage)
        if (fromDate >= archivalLimit) {
            const result = await pool.query(
                "SELECT latitude as lat, longitude as lng, speed, timestamp, heading, ignition FROM gps_history WHERE device_id = (SELECT id FROM devices WHERE imei = $1) AND timestamp BETWEEN $2 AND $3 ORDER BY timestamp ASC",
                [imei, from, to]
            );
            points = result.rows;
        }
        // CASE B: Requested range is older than 3 months (Google Drive Fallback)
        else {
            console.log(`[History] Fetching archival data from Google Drive for ${imei}...`);
            const files = await googleDrive.findArchives(imei);
            // In a production scenario, we would stream/parse the found JSON files here.
            // For now, we return a fallback or the found file links.
            res.json({
                status: 'SUCCESS',
                source: 'cloud_archival',
                message: 'Historical data found in cloud archival. Pulling stream...',
                points: [], // Streamed data would be merged here
                archives: files
            });
            return;
        }

        res.json({ status: 'SUCCESS', points });
    } catch (err) {
        console.error('History API Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to fetch history.' });
    }
});

// 6. Send Device Command (Traccar-First GPRS / GPRS / SMS)
app.post('/api/commands/send', async (req, res) => {
    const { deviceId, commandType, isAdminSms, adminMobile } = req.body;

    try {
        // 1. Attempt GPRS Command via Traccar API if available
        try {
            console.log(`[Traccar] Attempting GPRS command via Traccar API for ${deviceId}...`);
            // Map our command types to Traccar internal command types
            const typeMap = {
                'CUT_ENGINE': 'engineStop',
                'RESTORE_ENGINE': 'engineResume'
            };

            const traccarRes = await fetch(`${process.env.TRACCAR_URL || 'http://traccar:8082'}/api/commands/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                },
                body: JSON.stringify({
                    deviceId: deviceId, // Traccar numeric ID or UniqueID depending on setup
                    type: typeMap[commandType] || 'custom',
                    attributes: commandType === 'custom' ? { data: req.body.customData } : {}
                })
            });

            if (traccarRes.ok) {
                return res.json({ status: 'SUCCESS', message: 'Command Dispatched via Core Engine', source: 'system' });
            }
        } catch (traccarErr) {
            console.warn('[Traccar] Command proxy failed, falling back to TCP Server:', traccarErr.message);
        }

        // 2. Fallback: Custom GPRS via TCP Server Redis Queue
        let commandHex = '';
        if (commandType === 'CUT_ENGINE') commandHex = 'Relay,1#';
        else if (commandType === 'RESTORE_ENGINE') commandHex = 'Relay,0#';
        else commandHex = commandType;

        if (redisClient) {
            await redisClient.lPush(`cmd_queue:${deviceId}`, Buffer.from(commandHex).toString('hex'));
            return res.json({ status: 'SUCCESS', message: 'Command queued to TCP Server GPRS queue.', source: 'tcp-server' });
        }

        res.status(503).json({ status: 'ERROR', message: 'No active command gateway available.' });
    } catch (err) {
        console.error('Unified Command Dispatch Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to dispatch command.' });
    }
});

// 7. Automated Database Backup (Server & Google Drive)
app.post('/api/admin/backup', async (req, res) => {
    try {
        console.log('[Backup] Initiating manual backup trigger...');
        const backupPath = path.join(__dirname, `../backups/backup_${Date.now()}.sql`);

        // Ensure directory exists
        if (!fs.existsSync(path.join(__dirname, '../backups'))) {
            fs.mkdirSync(path.join(__dirname, '../backups'), { recursive: true });
        }

        // Execute pg_dump (Assuming environment variables are set)
        const password = process.env.POSTGRES_PASSWORD || 'gps_strong_password';
        const user = process.env.POSTGRES_USER || 'gps_admin';
        const db = process.env.POSTGRES_DB || 'gps_saas';
        const host = process.env.DB_HOST || 'db';

        const { exec } = require('child_process');
        exec(`PGPASSWORD="${password}" pg_dump -h ${host} -U ${user} ${db} > ${backupPath}`, async (error) => {
            if (error) {
                console.error('[Backup] pg_dump failed:', error);
                return res.status(500).json({ status: 'ERROR', message: 'Server storage backup failed.' });
            }

            console.log(`[Backup] Local backup saved: ${backupPath}`);

            // Google Drive Upload
            try {
                const driveRes = await googleDrive.uploadFile(backupPath); // Default to root or env-defined folder
                res.json({ status: 'SUCCESS', message: 'Backup secured locally and on Google Drive.', driveId: driveRes.id });
            } catch (driveErr) {
                console.warn('[Backup] Google Drive upload failed:', driveErr.message);
                res.json({ status: 'SUCCESS', message: 'Backup secured locally, but Google Drive sync failed.' });
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Backup orchestration failed.' });
    }
});

// 7. Twilio Webhook (Receive SMS Reply from Device)
app.post('/api/webhooks/sms', async (req, res) => {
    const { From, Body } = req.body;
    console.log(`Received SMS from ${From}: ${Body}`);
    io.emit('sms_acknowledgment', { from: From, body: Body, timestamp: new Date() });
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

// 1.10. Traccar Webhook Receiver (Real-time Events)
app.post('/api/traccar/webhooks', async (req, res) => {
    const { event, device, position } = req.body;
    if (!event || !device) return res.sendStatus(200);

    console.log(`[TraccarWebhook] Received ${event.type} for Device ${device.name}`);

    // Map Traccar events to Portal alerts
    const alertTypeMap = {
        'geofenceEnter': 'GEOFENCE_ENTER',
        'geofenceExit': 'GEOFENCE_EXIT',
        'deviceOverspeed': 'OVERSPEED',
        'deviceOnline': 'ONLINE',
        'deviceOffline': 'OFFLINE',
        'alarm': 'ALARM'
    };

    const alert = {
        type: alertTypeMap[event.type] || event.type.toUpperCase(),
        imei: device.uniqueId,
        vehicleName: device.name,
        plateNumber: device.phone || 'N/A',
        message: event.attributes?.message || `${event.type} detected by System`,
        timestamp: new Date(event.eventTime),
        position: position
    };

    // Broadcast to user and admin
    io.to(`imei_${device.uniqueId}`).emit('VEHICLE_ALERT', alert);
    io.to('admin_room').emit('VEHICLE_ALERT', alert);

    // Persistent storage
    try {
        await pool.query(
            "INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, $3 FROM devices WHERE imei = $1",
            [device.uniqueId, alert.message, alert.timestamp]
        );
    } catch (e) { console.error('[TraccarWebhook] DB Guard Error:', e.message); }

    res.sendStatus(200);
});

// --- LIVE TRACKING PUB/SUB & GEOFENCING ---
const redisSub = redisClient.duplicate();
redisSub.on('error', (err) => console.log('Redis Sub Error', err));

// State tracker for geofences (Enter/Exit)
const checkGeofenceEvents = async (imei, lat, lng) => {
    try {
        const currentFencesQuery = `
            SELECT g.id, g.name 
            FROM geofences g
            WHERE ST_Contains(g.geom, ST_SetSRID(ST_Point($1, $2), 4326))
        `;
        const currentRes = await pool.query(currentFencesQuery, [parseFloat(lng), parseFloat(lat)]);
        const currentIds = currentRes.rows.map(r => r.id);

        const lastStateKey = `gf_last:${imei}`;
        const lastIdsStr = await redisClient.get(lastStateKey);
        const lastIds = lastIdsStr ? JSON.parse(lastIdsStr) : [];

        // Entered: in current but not in last
        const entered = currentRes.rows.filter(r => !lastIds.includes(r.id));
        // Exited: in last but not in current
        const exitedIds = lastIds.filter(id => !currentIds.includes(id));

        // Detect Exit details (querying names for IDs)
        let exited = [];
        if (exitedIds.length > 0) {
            const exitRes = await pool.query('SELECT id, name FROM geofences WHERE id = ANY($1)', [exitedIds]);
            exited = exitRes.rows;
        }

        // Update state
        await redisClient.set(lastStateKey, JSON.stringify(currentIds), { EX: 86400 });

        return { entered, exited };
    } catch (e) {
        return { entered: [], exited: [] };
    }
};

redisSub.connect().then(() => {
    console.log('Redis Subscriber ready for gps:updates');
    redisSub.subscribe('gps:updates', async (message) => {
        try {
            const data = JSON.parse(message);
            if (!data.imei) return;

            // 1. Broadcast Position
            io.to(`imei_${data.imei}`).emit('LOCATION_UPDATE', data);
            io.to('admin_room').emit('LOCATION_UPDATE', data);

            // 2. Continuous Geofence Check
            const { entered, exited } = await checkGeofenceEvents(data.imei, data.lat, data.lng);

            // 3. Overspeed Check (per-vehicle configurable limit, default 80 km/h)
            const speedKmh = parseFloat(data.speed) || 0;
            if (speedKmh > 0) await checkOverspeed(data.imei, speedKmh);

            // Fetch vehicle info for richer alerts
            const vRes = await pool.query('SELECT v.vehicle_number, v.driver_name FROM vehicles v JOIN devices d ON d.id=v.device_id WHERE d.imei=$1 AND v.is_active=true LIMIT 1', [data.imei]);
            const vehicleName = vRes.rows[0]?.vehicle_number || data.imei;
            const plateNumber = vRes.rows[0]?.driver_name || 'N/A';

            entered.forEach(gf => {
                const alert = {
                    type: 'GEOFENCE_ENTER',
                    imei: data.imei,
                    vehicleName,
                    plateNumber,
                    fenceName: gf.name,
                    message: `Vehicle ${vehicleName} (${plateNumber}) ENTERED geofence: ${gf.name}`,
                    timestamp: new Date()
                };
                io.to(`imei_${data.imei}`).emit('VEHICLE_ALERT', alert);
                io.to('admin_room').emit('VEHICLE_ALERT', alert);
                pool.query('INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, NOW() FROM devices WHERE imei = $1', [data.imei, alert.message]);
            });

            exited.forEach(gf => {
                const alert = {
                    type: 'GEOFENCE_EXIT',
                    imei: data.imei,
                    vehicleName,
                    plateNumber,
                    fenceName: gf.name,
                    message: `Vehicle ${vehicleName} (${plateNumber}) EXITED geofence: ${gf.name}`,
                    timestamp: new Date()
                };
                io.to(`imei_${data.imei}`).emit('VEHICLE_ALERT', alert);
                io.to('admin_room').emit('VEHICLE_ALERT', alert);
                pool.query('INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, NOW() FROM devices WHERE imei = $1', [data.imei, alert.message]);
            });

        } catch (e) {
            console.error('gps:updates processing error:', e);
        }
    });
});




// Ensure subscription_plan column exists
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'Premium'").catch(e => console.warn('[DB] subscription_plan:', e?.message));

// PATCH /api/admin/clients/:id/billing
app.patch('/api/admin/clients/:id/billing', async (req, res) => {
    const { subscriptionPlan, subscriptionEndDate } = req.body;
    try {
        await pool.query(
            "UPDATE users SET subscription_plan = $1, subscription_end_date = $2 WHERE id = $3",
            [subscriptionPlan, subscriptionEndDate, req.params.id]
        );
        res.json({ status: 'SUCCESS', message: 'Billing updated successfully.' });
    } catch (e) {
        console.error('Update billing error:', e);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update billing.' });
    }
});

// Per-IMEI overspeed cooldown (one alert per 5 minutes)
const lastOverspeedAlert = {};
const checkOverspeed = async (imei, speedKmh) => {
    try {
        const now = Date.now();
        if (lastOverspeedAlert[imei] && now - lastOverspeedAlert[imei] < 300000) return;
        const vRes = await pool.query('SELECT v.speed_limit, v.vehicle_name, v.plate_number FROM vehicles v JOIN devices d ON d.id=v.device_id WHERE d.imei=$1 AND v.is_active=true LIMIT 1', [imei]);
        const speedLimit = vRes.rows[0]?.speed_limit ?? 80;
        if (speedKmh <= speedLimit) return;
        const vName = vRes.rows[0]?.vehicle_name || imei;
        const plate = vRes.rows[0]?.plate_number || '';
        const msg = 'Overspeed: ' + vName + ' (' + plate + ') at ' + speedKmh + ' km/h (limit: ' + speedLimit + ' km/h)';
        lastOverspeedAlert[imei] = now;
        const alert = { type: 'OVERSPEED', imei, message: msg, speed: speedKmh, limit: speedLimit, timestamp: new Date() };
        io.to('imei_' + imei).emit('VEHICLE_ALERT', alert);
        io.to('admin_room').emit('VEHICLE_ALERT', alert);
        pool.query('INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, NOW() FROM devices WHERE imei=$1', [imei, msg]).catch(() => { });
        console.log('[OVERSPEED] ' + msg);
    } catch (e) { }
};

// GET /api/vehicles
app.get('/api/vehicles', async (req, res) => {
    const { userId, role } = req.query;
    try {
        const rows = role === 'ADMIN'
            ? (await pool.query('SELECT v.id,v.vehicle_name,v.plate_number,v.vehicle_type,v.speed_limit,d.imei,u.name as client_name,u.id as client_id FROM vehicles v JOIN devices d ON d.id=v.device_id JOIN users u ON u.id=v.client_id WHERE v.is_active=true ORDER BY u.name,v.vehicle_name')).rows
            : (await pool.query('SELECT v.id,v.vehicle_name,v.plate_number,v.vehicle_type,v.speed_limit,d.imei FROM vehicles v JOIN devices d ON d.id=v.device_id WHERE v.client_id=$1 AND v.is_active=true ORDER BY v.vehicle_name', [userId])).rows;
        res.json({ status: 'SUCCESS', vehicles: rows });
    } catch (e) { res.json({ status: 'SUCCESS', vehicles: [] }); }
});

// PATCH /api/vehicles/:id/speed-limit  (client)
app.patch('/api/vehicles/:id/speed-limit', async (req, res) => {
    const limit = parseInt(req.body.speedLimit);
    if (isNaN(limit) || limit < 10 || limit > 300) return res.status(400).json({ status: 'ERROR', message: 'Limit must be 10-300 km/h.' });
    try {
        await pool.query('UPDATE vehicles SET speed_limit=$1 WHERE id=$2', [limit, req.params.id]);
        res.json({ status: 'SUCCESS', message: 'Speed limit updated to ' + limit + ' km/h' });
    } catch (e) { res.status(500).json({ status: 'ERROR', message: 'Failed.' }); }
});

// PATCH /api/admin/vehicles/:id/speed-limit  (admin override)
app.patch('/api/admin/vehicles/:id/speed-limit', async (req, res) => {
    const limit = parseInt(req.body.speedLimit);
    if (isNaN(limit) || limit < 10 || limit > 300) return res.status(400).json({ status: 'ERROR', message: 'Limit must be 10-300 km/h.' });
    try {
        await pool.query('UPDATE vehicles SET speed_limit=$1 WHERE id=$2', [limit, req.params.id]);
        res.json({ status: 'SUCCESS', message: 'Admin: speed limit set to ' + limit + ' km/h' });
    } catch (e) { res.status(500).json({ status: 'ERROR', message: 'Failed.' }); }
});

// GET /api/admin/vehicles  — all vehicles with speed limits
app.get('/api/admin/vehicles', async (req, res) => {
    try {
        const r = await pool.query('SELECT v.id,v.vehicle_name,v.plate_number,v.vehicle_type,v.speed_limit,d.imei,u.name as client_name,u.email as client_email,u.id as client_id FROM vehicles v JOIN devices d ON d.id=v.device_id JOIN users u ON u.id=v.client_id WHERE v.is_active=true ORDER BY u.name,v.vehicle_name');
        res.json({ status: 'SUCCESS', vehicles: r.rows });
    } catch (e) { res.json({ status: 'SUCCESS', vehicles: [] }); }
});

// ==========================================
// ENHANCED ADMIN CONTROL APIs

// ==========================================

// System Health — uptime, DB stats, Redis ping, backup info
app.get('/api/admin/system-health', async (req, res) => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${hours}h ${minutes}m`;

    let dbStats = { clients: 0, devices: 0, vehicles: 0, alerts: 0, telemetry: 0, dbSize: 'N/A' };
    let redisStatus = 'Disconnected';
    let lastBackup = 'Never';

    try {
        const [clients, devices, vehicles, alertCount, sizeResult] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users WHERE role_id = (SELECT id FROM roles WHERE name='CLIENT')"),
            pool.query("SELECT COUNT(*) FROM device_inventory"),
            pool.query("SELECT COUNT(*) FROM vehicles WHERE is_active = true"),
            pool.query("SELECT COUNT(*) FROM alerts"),
            pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size")
        ]);
        dbStats = {
            clients: parseInt(clients.rows[0].count),
            devices: parseInt(devices.rows[0].count),
            vehicles: parseInt(vehicles.rows[0].count),
            alerts: parseInt(alertCount.rows[0].count),
            dbSize: sizeResult.rows[0].size
        };
    } catch (e) {
        dbStats = { clients: 0, devices: 0, vehicles: 0, alerts: 0, dbSize: 'Offline' };
    }

    try {
        await redisClient.ping();
        redisStatus = 'Connected';
    } catch (e) {
        redisStatus = 'Offline';
    }

    // Read last backup timestamp if stored
    const backupLogPath = path.join(__dirname, '../temp/last_backup.txt');
    if (fs.existsSync(backupLogPath)) {
        lastBackup = fs.readFileSync(backupLogPath, 'utf8').trim();
    }

    res.json({
        status: 'SUCCESS',
        health: {
            uptime,
            dbStats,
            redisStatus,
            lastBackup,
            nodeVersion: process.version,
            platform: process.platform,
            memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
            googleDriveFolderId: process.env.GOOGLE_BACKUP_FOLDER_ID || '1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8',
            googleDriveLink: 'https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8'
        }
    });
});

// Manual Backup Trigger
app.post('/api/admin/backup/trigger', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM gps_history LIMIT 100000"); // Safety limit

        const fileName = `manual_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify({
            exportedAt: new Date().toISOString(),
            totalRecords: result.rows.length,
            data: result.rows
        }, null, 2));

        const folderId = process.env.GOOGLE_BACKUP_FOLDER_ID || '1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8';
        await googleDrive.uploadFile(filePath, folderId);

        // Record backup timestamp
        fs.writeFileSync(path.join(tempDir, 'last_backup.txt'), new Date().toISOString());

        // !!! IMPORTANT !!!
        // We REMOVED the 'DELETE FROM gps_history' so data is kept locally as well.

        fs.unlinkSync(filePath);

        res.json({
            status: 'SUCCESS',
            message: `Manual backup complete. ${result.rows.length} records mirrored to Google Drive. No data was deleted from the server.`,
            fileName,
            driveFolder: folderId
        });
    } catch (err) {
        console.error('[Manual Backup] Error:', err);
        res.status(500).json({ status: 'ERROR', message: `Backup failed: ${err.message}` });
    }
});

// Backup Status
app.get('/api/admin/backup/status', (req, res) => {
    const backupLogPath = path.join(__dirname, '../temp/last_backup.txt');
    let lastBackup = null;
    if (fs.existsSync(backupLogPath)) {
        lastBackup = fs.readFileSync(backupLogPath, 'utf8').trim();
    }
    res.json({
        status: 'SUCCESS',
        lastBackup,
        retentionPolicy: '3 months on server, older data on Google Drive',
        driveLink: 'https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8'
    });
});

// Revenue Stats — based on client registration dates (no separate billing table needed)
// MRR estimate: count active clients × plan price estimate
app.get('/api/admin/revenue', async (req, res) => {
    try {
        // Group clients by registration month for a bar chart
        const monthlyReg = await pool.query(`
            SELECT
                TO_CHAR(created_at, 'Mon YYYY') as month,
                TO_CHAR(created_at, 'YYYY-MM') as month_key,
                COUNT(*) as new_clients
            FROM users
            WHERE role_id = (SELECT id FROM roles WHERE name = 'CLIENT')
            GROUP BY month, month_key
            ORDER BY month_key DESC
            LIMIT 12
        `);

        // Per-client billing reference: reg date + 1 year = next billing due
        const clientBilling = await pool.query(`
            SELECT u.id, u.name, u.email, u.created_at as registered_at,
                   u.subscription_plan, u.subscription_end_date,
                   COUNT(v.id) as vehicles,
                   u.is_blocked
            FROM users u
            LEFT JOIN vehicles v ON u.id = v.client_id AND v.is_active = true
            WHERE u.role_id = (SELECT id FROM roles WHERE name = 'CLIENT')
            GROUP BY u.id, u.name, u.email, u.created_at, u.is_blocked, u.subscription_plan, u.subscription_end_date
            ORDER BY u.created_at DESC
        `);

        const totalClients = clientBilling.rows.length;

        // Estimated MRR: assume ₹500/device/month
        const totalVehicles = clientBilling.rows.reduce((sum, c) => sum + parseInt(c.vehicles || 0), 0);
        const estimatedMRR = totalVehicles * 500;

        res.json({
            status: 'SUCCESS',
            revenue: {
                totalClients,
                totalActiveVehicles: totalVehicles,
                estimatedMRR,
                estimatedARR: estimatedMRR * 12,
                monthlyRegistrations: monthlyReg.rows.reverse(),
                clientBillingReference: clientBilling.rows.map(c => ({
                    ...c,
                    nextBillingDue: new Date(new Date(c.registered_at).setFullYear(
                        new Date(c.registered_at).getFullYear() + 1
                    )).toISOString().split('T')[0]
                }))
            }
        });
    } catch (err) {
        console.error('[Revenue API] Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to calculate revenue stats.' });
    }
});

// Full Alert Log — with pagination and filters
app.get('/api/admin/alerts/all', async (req, res) => {
    const { page = 1, limit = 50, imei, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        let whereClause = '';
        const params = [parseInt(limit), offset];
        const conditions = [];
        if (imei) { params.push(imei); conditions.push(`d.imei = $${params.length}`); }
        if (type) { params.push(`%${type}%`); conditions.push(`a.message ILIKE $${params.length}`); }
        if (conditions.length) whereClause = 'WHERE ' + conditions.join(' AND ');

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM alerts a
            JOIN devices d ON a.device_id = d.id ${whereClause}
        `, params.slice(2));

        const result = await pool.query(`
            SELECT a.id, a.message, a.timestamp, d.imei, v.vehicle_name, v.plate_number
            FROM alerts a
            JOIN devices d ON a.device_id = d.id
            LEFT JOIN vehicles v ON d.id = v.device_id AND v.is_active = true
            ${whereClause}
            ORDER BY a.timestamp DESC
            LIMIT $1 OFFSET $2
        `, params);

        res.json({
            status: 'SUCCESS',
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            alerts: result.rows
        });
    } catch (err) {
        console.error('Full Alerts Log Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error.' });
    }
});




app.post('/api/commands/send', async (req, res) => {
    const { deviceId, commandType, params = {} } = req.body;
    try {
        console.log(`[CommandProxy] Sending ${commandType} to Device ${deviceId} via Traccar...`);

        // Map internal types to Traccar types
        let type = 'custom';
        let attributes = { data: '' };

        if (commandType === 'CUT_ENGINE') {
            type = 'engineStop';
        } else if (commandType === 'RESTORE_ENGINE') {
            type = 'engineResume';
        } else if (commandType === 'CUSTOM_GPRS') {
            type = 'custom';
            attributes.data = params.data || '';
        }

        const traccarRes = await fetch(`${TRACCAR_URL}/api/commands/send`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                'Content-Type': 'application/json',
                'Cookie': req.headers.cookie || ''
            },
            body: JSON.stringify({ deviceId, type, attributes })
        });

        if (traccarRes.ok) {
            res.json({ status: 'SUCCESS', message: 'Command successfully queued.' });
        } else {
            const errorText = await traccarRes.text();
            res.status(traccarRes.status).json({ status: 'ERROR', message: errorText });
        }
    } catch (err) {
        console.error('[CommandProxy] Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error during command proxy.' });
    }
});

app.post('/api/commands/gprs', async (req, res) => {
    const { imei, commandType, params = {} } = req.body;
    try {
        // 1. Get device details (protocol, model_id, etc.)
        const devRes = await pool.query(
            "SELECT i.protocol, d.model_id, i.sim_number FROM device_inventory i JOIN devices d ON i.imei = d.imei WHERE i.imei = $1",
            [imei]
        );
        const dev = devRes.rows[0];
        if (!dev) return res.status(404).json({ status: 'ERROR', message: 'Device not found' });

        let finalCommandHex;

        // 2. Check for dynamic command template in DB
        const logicalRes = await pool.query("SELECT id FROM logical_commands WHERE command_alias = $1", [commandType]);
        if (logicalRes.rows.length > 0 && dev.model_id) {
            const cmdMapRes = await pool.query(
                "SELECT actual_payload FROM device_command_map WHERE model_id = $1 AND logical_command_id = $2",
                [dev.model_id, logicalRes.rows[0].id]
            );
            if (cmdMapRes.rows.length > 0) {
                let template = cmdMapRes.rows[0].actual_payload;
                // Substitute variables: {imei}, {phone}, {p1}, {p2}...
                template = template.replace(/{imei}/g, imei);
                template = template.replace(/{phone}/g, dev.sim_number || '');
                Object.keys(params).forEach(k => {
                    template = template.replace(new RegExp(`{${k}}`, 'g'), params[k]);
                });

                // Convert to hex if it's a string command, or keep as hex if it's already hex
                // Simple heuristic: if it looks like GT06 hex, it's hex, else ASCII
                if (/^[0-9A-Fa-f]+$/.test(template) && template.length % 2 === 0) {
                    finalCommandHex = template;
                } else {
                    finalCommandHex = Buffer.from(template, 'ascii').toString('hex');
                }
            }
        }

        // 3. Fallback to CommandFactory if no DB template
        if (!finalCommandHex) {
            const proto = (dev.protocol || 'GT06').toUpperCase();
            const builder = CommandFactory[proto] || CommandFactory['GT06'];
            finalCommandHex = builder(commandType);
        }

        // 4. Queue in Redis
        await redisClient.rPush(`cmd_queue:${imei}`, finalCommandHex);

        // 5. Log in DB for verification
        try {
            await pool.query(
                "INSERT INTO command_logs (device_id, logical_command_id, status) SELECT d.id, lc.id, 'PENDING' FROM devices d, logical_commands lc WHERE d.imei = $1 AND lc.command_alias = $2",
                [imei, commandType]
            );
        } catch (e) { console.error('[DB] Failed to log command:', e.message); }

        res.json({ status: 'SUCCESS', hex: finalCommandHex });
    } catch (e) {
        console.error('GPRS Error:', e);
        res.status(500).json({ status: 'ERROR' });
    }
});


// --- ADMIN MODEL & COMMAND MANAGEMENT ---
// 6. Get recent command logs
app.get('/api/admin/command-logs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cl.id, cl.status, cl.created_at, cl.sent_at, d.imei, lc.command_alias
            FROM command_logs cl
            JOIN devices d ON cl.device_id = d.id
            JOIN logical_commands lc ON cl.logical_command_id = lc.id
            ORDER BY cl.created_at DESC
            LIMIT 50
        `);
        res.json({ status: 'SUCCESS', logs: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});


// 1. Get all device models
app.get('/api/admin/models', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM device_models ORDER BY model_name ASC");
        res.json({ status: 'SUCCESS', models: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// 2. Create/Update device model
app.post('/api/admin/models', async (req, res) => {
    const { model_name, protocol } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO device_models (model_name, protocol) VALUES ($1, $2) ON CONFLICT (model_name) DO UPDATE SET protocol = EXCLUDED.protocol RETURNING *",
            [model_name, protocol]
        );
        res.json({ status: 'SUCCESS', model: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// --- GPRS COMMAND MODULE (Traccar Integration) ---

// 1. Get all vehicles with device details
app.get('/api/vehicles', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT v.*, d.imei, d.protocol, d.model as device_model, d.sim_number,
                   gl.speed, gl.ignition as live_ignition
            FROM vehicles v
            LEFT JOIN devices d ON v.device_id = d.id
            LEFT JOIN gps_live_data gl ON d.imei = gl.imei
            ORDER BY v.created_at DESC
        `);
        res.json({ status: 'SUCCESS', vehicles: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// 2. Send Ignition Command (Traccar GPRS)
app.post('/api/commands/send-ignition', async (req, res) => {
    const { vehicleId, action, userId } = req.body; // action: IGNITION_OFF, IGNITION_ON

    try {
        // 1. Retrieve vehicle & device
        const vRes = await pool.query(`
            SELECT v.*, d.imei, d.protocol, gl.speed 
            FROM vehicles v
            JOIN devices d ON v.device_id = d.id
            LEFT JOIN gps_live_data gl ON d.imei = gl.imei
            WHERE v.id = $1
        `, [vehicleId]);

        if (vRes.rows.length === 0) throw new Error('Vehicle not found');
        const vehicle = vRes.rows[0];

        // 2. Safety Check: Only cut ignition if speed is 0
        if (action === 'IGNITION_OFF' && vehicle.speed > 0) {
            return res.status(400).json({
                status: 'FAILED',
                message: 'Safety Protocol: Cannot cut ignition while vehicle is moving!'
            });
        }

        // 3. Find correct command string for protocol
        const tRes = await pool.query(`
            SELECT command_string 
            FROM command_templates 
            WHERE protocol = $1 AND action = $2
        `, [vehicle.protocol, action]);

        if (tRes.rows.length === 0) throw new Error(`No command template found for protocol: ${vehicle.protocol}`);
        const commandString = tRes.rows[0].command_string;

        // 4. Log initial command entry
        const logRes = await pool.query(`
            INSERT INTO device_commands (vehicle_id, device_id, action, command_sent, status, user_id)
            VALUES ($1, $2, $3, $4, 'SENT', $5)
            RETURNING id
        `, [vehicleId, vehicle.device_id, action, commandString, userId]);
        const logId = logRes.rows[0].id;

        // 5. Send to Traccar API
        // First, we need to find the internal Traccar ID by IMEI
        const traccarDevicesRes = await fetch(`${TRACCAR_URL}/api/devices?uniqueId=${vehicle.imei}`, {
            headers: { 'Authorization': `Basic ${TRACCAR_AUTH}` }
        });
        const traccarDevices = await traccarDevicesRes.json();

        if (!traccarDevices || traccarDevices.length === 0) {
            throw new Error('Device not found on Traccar server');
        }
        const traccarId = traccarDevices[0].id;

        const traccarCmdRes = await fetch(`${TRACCAR_URL}/api/commands/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${TRACCAR_AUTH}`
            },
            body: JSON.stringify({
                deviceId: traccarId,
                type: 'custom',
                attributes: { data: commandString }
            })
        });

        if (traccarCmdRes.status >= 400) {
            const errData = await traccarCmdRes.text();
            await pool.query("UPDATE device_commands SET status = 'FAILED', response = $1 WHERE id = $2", [errData, logId]);
            return res.status(traccarCmdRes.status).json({ status: 'FAILED', message: 'Traccar rejected command', details: errData });
        }

        // 6. Final success
        await pool.query("UPDATE device_commands SET status = 'DELIVERED' WHERE id = $1", [logId]);

        // Notify via Websocket
        io.emit('COMMAND_UPDATE', {
            vehicleId,
            action,
            status: 'DELIVERED',
            imei: vehicle.imei
        });

        res.json({ status: 'SUCCESS', message: `Command ${action} dispatched successfully.` });

    } catch (err) {
        console.error('[GPRS_CMD] Global Error:', err.message);
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// 3. Command History
app.get('/api/commands/history/:vehicleId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT dc.*, u.name as user_name 
            FROM device_commands dc
            LEFT JOIN users u ON dc.user_id = u.id
            WHERE dc.vehicle_id = $1
            ORDER BY dc.sent_at DESC
            LIMIT 50
        `, [req.params.vehicleId]);
        res.json({ status: 'SUCCESS', history: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// 4. Admin: Command Templates Management
app.get('/api/admin/command-templates', async (req, res) => {
    try {
        const r = await pool.query("SELECT * FROM command_templates ORDER BY protocol, action");
        res.json({ status: 'SUCCESS', templates: r.rows });
    } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

app.post('/api/admin/command-templates', async (req, res) => {
    const { protocol, action, command_string, description } = req.body;
    try {
        const r = await pool.query(
            "INSERT INTO command_templates (protocol, action, command_string, description) VALUES ($1, $2, $3, $4) ON CONFLICT (protocol, action) DO UPDATE SET command_string = EXCLUDED.command_string, description = EXCLUDED.description RETURNING *",
            [protocol, action, command_string, description]
        );
        res.json({ status: 'SUCCESS', template: r.rows[0] });
    } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

app.delete('/api/admin/command-templates/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM command_templates WHERE id = $1", [req.params.id]);
        res.json({ status: 'SUCCESS', message: 'Template deleted.' });
    } catch (e) { res.status(500).json({ status: 'ERROR', message: e.message }); }
});

// 4. Admin: Inventory Management
app.get('/api/admin/inventory', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM device_inventory ORDER BY created_at DESC");
        res.json({ status: 'SUCCESS', devices: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

app.post('/api/admin/inventory', async (req, res) => {
    const { imei, protocol, model, sim_number } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO device_inventory (imei, protocol, model, sim_number) VALUES ($1, $2, $3, $4) ON CONFLICT (imei) DO UPDATE SET protocol = EXCLUDED.protocol, sim_number = EXCLUDED.sim_number RETURNING *",
            [imei, protocol, model, sim_number]
        );
        res.json({ status: 'SUCCESS', device: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: err.message });
    }
});

// 5. Admin: Asset Provisioning (Link Device to Vehicle)
app.post('/api/admin/devices/assign', async (req, res) => {
    const { clientId, imei, vehicleNumber, driverName } = req.body;
    // Transactional: Create Device (if missing in devices table), then Vehicle
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Mark as assigned in inventory
        await client.query("UPDATE device_inventory SET is_assigned = true WHERE imei = $1", [imei]);

        // 2. Ensure device exists in 'devices' (live) table
        const devExists = await client.query("SELECT id FROM devices WHERE imei = $1", [imei]);
        let deviceId;
        if (devExists.rows.length === 0) {
            const newDev = await client.query(
                "INSERT INTO devices (imei, device_name, protocol) VALUES ($1, $2, (SELECT protocol FROM device_inventory WHERE imei=$1)) RETURNING id",
                [imei, vehicleNumber]
            );
            deviceId = newDev.rows[0].id;
        } else {
            deviceId = devExists.rows[0].id;
        }

        // 3. Create Vehicle
        const vehRes = await client.query(
            "INSERT INTO vehicles (vehicle_number, driver_name, device_id, client_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [vehicleNumber, driverName, deviceId, clientId]
        );

        await client.query('COMMIT');
        res.json({ status: 'SUCCESS', vehicle: vehRes.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ status: 'ERROR', message: err.message });
    } finally {
        client.release();
    }
});

// 6. Admin: Unlinked Traccar Devices Detection
app.get('/api/admin/unlinked-devices', async (req, res) => {
    try {
        // Fetch all devices from Traccar
        const traccarRes = await fetch(`${TRACCAR_URL}/api/devices`, {
            headers: { 'Authorization': `Basic ${TRACCAR_AUTH}` }
        });
        const traccarDevices = await traccarRes.json();

        // Fetch all registered IMEIs in our portal
        const portalRes = await pool.query("SELECT imei FROM devices");
        const registeredImeis = new Set(portalRes.rows.map(r => r.imei));

        // Filter for devices in Traccar but NOT in our portal
        const unlinked = traccarDevices.filter(d => !registeredImeis.has(d.uniqueId));

        res.json({ status: 'SUCCESS', unlinked });
    } catch (e) {
        res.status(500).json({ status: 'ERROR', message: e.message });
    }
});

// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Backend API Server running on port ${PORT}`);
});
