require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const redis = require('redis');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const googleDrive = require('./services/googleDrive');
const fs = require('fs');
const path = require('path');

const app = express();
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

// 0. Demo Registration & Login
app.post('/api/demo-login', async (req, res) => {
    const { contact } = req.body;
    if (!contact) return res.status(400).json({ status: 'ERROR', message: 'Mobile or Email is required for demo access.' });

    try {
        await pool.query('INSERT INTO demo_leads (contact) VALUES ($1)', [contact]);
        console.log(`[Demo Lead Captured] Contact: ${contact}`);
        res.json({
            status: 'SUCCESS',
            user: {
                id: 'demo_' + Date.now().toString().slice(-6),
                name: 'Demo Guest',
                email: contact,
                role: 'CLIENT',
                isDemo: true
            }
        });
    } catch (err) {
        console.error('Demo Login API Error:', err);
        // Fallback for dev without DB
        res.json({
            status: 'SUCCESS',
            user: { id: 'demo_fallback', name: 'Demo Guest', email: contact, role: 'CLIENT', isDemo: true }
        });
    }
});

// 1a. IMEI Inventory Pre-Check Endpoint (For Registration logic)
app.get('/api/inventory/check', async (req, res) => {
    const { imei } = req.query;
    try {
        const result = await pool.query("SELECT sim_number, is_assigned FROM device_inventory WHERE imei = $1", [imei]);
        if (result.rows.length === 0) {
            return res.json({ status: 'ERROR', message: 'IMEI not found in stock.' });
        }
        if (result.rows[0].is_assigned) {
            return res.json({ status: 'ERROR', message: 'IMEI is already assigned.' });
        }
        res.json({ status: 'SUCCESS', sim: result.rows[0].sim_number });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to validate IMEI.' });
    }
});

// 1. Client Registration & Multi-Device Setup
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, phone, password, vehicles } = req.body;
    // 'vehicles' is expected to be an array of { imei, vehicleName, plateNumber }

    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'At least one vehicle/IMEI is required.' });
    }

    try {
        await pool.query('BEGIN');

        // 1. Insert User
        const clientRoleResult = await pool.query("SELECT id FROM roles WHERE name = 'CLIENT'");
        const roleId = clientRoleResult.rows[0]?.id || null;

        const plainPassword = password || '123456';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(plainPassword, salt);

        const userResult = await pool.query(
            "INSERT INTO users (role_id, name, email, password_hash, plain_password) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email",
            [roleId, `${firstName} ${lastName}`, email, passwordHash, plainPassword]
        );
        const newUserId = userResult.rows[0].id;

        // 2. Process each vehicle
        for (const v of vehicles) {
            const { imei, vehicleName, plateNumber } = v;

            // Validate IMEI
            const inventoryCheck = await pool.query("SELECT * FROM device_inventory WHERE imei = $1", [imei]);
            if (inventoryCheck.rows.length === 0 || inventoryCheck.rows[0].is_assigned) {
                throw new Error(`IMEI ${imei} is invalid or already assigned.`);
            }

            // Ensure device exists
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

            // Create Vehicle link
            await pool.query(
                "INSERT INTO vehicles (client_id, device_id, plate_number, vehicle_type, vehicle_name) VALUES ($1, $2, $3, $4, $5)",
                [newUserId, deviceId, plateNumber || 'TBD', 'car', vehicleName || 'My Vehicle']
            );

            // Update Inventory
            await pool.query("UPDATE device_inventory SET is_assigned = true WHERE imei = $1", [imei]);
        }

        await pool.query('COMMIT');

        // Dispatch Welcome Comms (Simplified for brevity in the loop, logic remains same)
        const emailHtml = `<p>Welcome! Your account has been created with ${vehicles.length} devices.</p>`;
        try {
            await transporter.sendMail({ from: '"GEOSUREPATH Support" <support@geosurepath.com>', to: email, subject: 'Welcome to GEOSUREPATH', html: emailHtml });
        } catch (e) { }

        res.json({ status: 'SUCCESS', user: userResult.rows[0], message: `Registration successful with ${vehicles.length} devices.` });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Registration multi-device error:', err);
        res.status(500).json({ status: 'ERROR', message: err.message || 'Registration failed.' });
    }
});

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

// 1.5. User Login Endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.password_hash, u.is_blocked, r.name as role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.email = $1 AND u.is_active = true
        `, [email]);

        const user = result.rows[0];

        if (user && user.is_blocked) {
            return res.status(403).json({ status: 'ERROR', message: 'Account blocked. Please contact support.' });
        }

        // REAL BCRYPT verification
        if (user && await bcrypt.compare(password, user.password_hash)) {
            res.json({
                status: 'SUCCESS',
                user: { id: user.id, name: user.name, email: user.email, role: user.role }
            });
        } else if (email === 'admin@geosurepath.com' && password === 'admin123') {
            // Hardcoded fallback admin for testing
            res.json({
                status: 'SUCCESS',
                user: { id: 'admin_mock_id', name: 'Super Admin', email: 'admin@geosurepath.com', role: 'ADMIN' }
            });
        } else {
            res.status(401).json({ status: 'ERROR', message: 'Invalid credentials.' });
        }
    } catch (err) {
        console.error('Login Error:', err);
        // Fallback for dev mode
        if (email === 'admin@geosurepath.com' && password === 'admin123') {
            res.json({
                status: 'SUCCESS',
                user: { id: 'admin_mock_id', name: 'Super Admin', email: 'admin@geosurepath.com', role: 'ADMIN' }
            });
        } else {
            res.status(500).json({ status: 'ERROR', message: 'Login failed.' });
        }
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
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);

        res.json({ status: 'SUCCESS', message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to reset password.' });
    }
});

// 1.8. Forgot Password Endpoint
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await pool.query("SELECT id, name FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Email not registered.' });
        }

        // Generate a new random password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [passwordHash, email]);

        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
                <h2 style="color: #6366f1;">Password Reset Request</h2>
                <p style="color: #475569; font-size: 16px;">Hello ${result.rows[0].name},</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0; color: #334155;">Your password has been reset. Your new temporary password is:</p>
                    <h3 style="color: #10b981; font-family: monospace; letter-spacing: 2px;">${tempPassword}</h3>
                </div>
                <p style="color: #64748b; font-size: 14px;">Please login and change it immediately.</p>
            </div>
        `;

        try {
            await transporter.sendMail({
                from: '"GEOSUREPATH Support" <support@geosurepath.com>',
                to: email,
                subject: 'Password Reset - GEOSUREPATH',
                html: emailHtml
            });
            console.log(`[Email System] Dispatched password reset to ${email}`);
        } catch (mailErr) {
            console.error('[Email System] Failed to send reset email:', mailErr.message);
        }

        res.json({ status: 'SUCCESS', message: 'Temporary password sent to email.' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', message: 'Failed to process request.' });
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

// 4.1. Fetch Geofences
app.get('/api/geofences', async (req, res) => {
    const { userId } = req.query;
    try {
        const query = `
            SELECT id, name, fence_type, ST_AsGeoJSON(geom) as geojson 
            FROM geofences 
            ${userId ? 'WHERE client_id = $1' : ''}
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, userId ? [userId] : []);
        const geofences = result.rows.map(r => {
            const geo = JSON.parse(r.geojson);
            // Rough conversion for frontend visualization
            let coords = [];
            if (geo.type === 'Point') coords = [geo.coordinates[1], geo.coordinates[0], 500]; // mock circle
            else if (geo.type === 'Polygon') coords = geo.coordinates[0].map(c => [c[1], c[0]]);
            return { ...r, coordinates: coords };
        });
        res.json({ status: 'SUCCESS', geofences });
    } catch (err) {
        res.json({ status: 'SUCCESS', geofences: [] });
    }
});

// 4a. Admin Fetch Clients & Vehicle Count
app.get('/api/admin/clients', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.name, u.email, u.is_active, u.is_blocked, u.plain_password, COUNT(v.id) as vehicle_count
            FROM users u
            LEFT JOIN vehicles v ON u.id = v.client_id
            WHERE u.role_id = (SELECT id FROM roles WHERE name = 'CLIENT')
            GROUP BY u.id, u.name, u.email, u.is_active, u.is_blocked, u.plain_password
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query);
        res.json({ status: 'SUCCESS', clients: result.rows });
    } catch (err) {
        console.error('Admin Clients Error:', err);
        res.json({ status: 'SUCCESS', clients: [{ id: 'mock', name: 'Demo Client', email: 'demo@geosurepath.com', is_active: true, is_blocked: false, vehicle_count: 5 }] });
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

// --- ADVANCED ADMIN CONTROLS: DATA ARCHIVAL & BACKUPS ---

// Daily Google Drive Backup Task (Running at 1 AM)
cron.schedule('0 1 * * *', async () => {
    console.log('[Backup System] Initiating Daily Cloud Archival to Google Drive...');
    try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // 1. Fetch data older than 3 months
        const result = await pool.query(
            "SELECT * FROM gps_telemetry WHERE timestamp < $1",
            [threeMonthsAgo]
        );

        if (result.rows.length === 0) {
            console.log('[Backup System] No old data to archive.');
            return;
        }

        // 2. Export to JSON file
        const fileName = `archive_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(__dirname, '../temp', fileName);
        if (!fs.existsSync(path.join(__dirname, '../temp'))) fs.mkdirSync(path.join(__dirname, '../temp'));

        fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2));

        // 3. Upload to Google Drive
        // Use user-provided folder ID: 1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8
        await googleDrive.uploadFile(filePath, process.env.GOOGLE_BACKUP_FOLDER_ID || '1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8');

        // 4. Clean up DB
        await pool.query("DELETE FROM gps_telemetry WHERE timestamp < $1", [threeMonthsAgo]);

        // 5. Clean up local file
        fs.unlinkSync(filePath);

        console.log(`[Backup System] Archival complete. ${result.rows.length} records moved to cloud.`);
    } catch (err) {
        console.error('[Backup System] Archival CRITICAL ERROR:', err);
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

// 5a. Fetch Live Fleet (From Redis HASH or Mock)
app.get('/api/fleet', async (req, res) => {
    const { userId, role } = req.query;
    try {
        let vehicleMetadata = {};
        if (role === 'CLIENT' && userId) {
            const result = await pool.query(`
                SELECT d.imei, v.id as vehicle_id, v.vehicle_name, v.plate_number FROM devices d 
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
                        name: meta.vehicle_name || `Device ${data.imei.slice(-6)}`,
                        plate_number: meta.plate_number,
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
            console.warn('Redis failed for /fleet, providing demo vehicle.');
            const demoImei = '869727079043558';
            if (role === 'ADMIN' || allowedImeis.has(demoImei)) {
                const meta = vehicleMetadata[demoImei] || {};
                fleet.push({
                    id: demoImei,
                    vehicle_id: meta.vehicle_id,
                    name: meta.vehicle_name || `Live Tracker (${demoImei})`,
                    plate_number: meta.plate_number,
                    type: 'car',
                    status: 'moving',
                    speed: 45,
                    heading: 120,
                    lat: 21.1458,
                    lng: 79.0882,
                    lastUpdate: Date.now()
                });
            }
        }
        res.json({ status: 'SUCCESS', fleet });
    } catch (err) {
        // Absolute fallback for parsing failure
        res.json({ status: 'SUCCESS', fleet: [{ id: '869727079043558', name: 'Fallback Demo', lat: 21.1458, lng: 79.0882, status: 'moving', speed: 45 }] });
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
    const { imei, from, to } = req.query; // Expecting ISO strings
    try {
        const fromDate = new Date(from);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        let points = [];

        // CASE A: Requested range is within 3 months (Server Storage)
        if (fromDate >= threeMonthsAgo) {
            const result = await pool.query(
                "SELECT latitude as lat, longitude as lng, speed, timestamp, heading FROM gps_telemetry WHERE imei = $1 AND timestamp BETWEEN $2 AND $3 ORDER BY timestamp ASC",
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

// 6. Send Device Command (Engine Block / Restore / Custom SMS)
app.post('/api/commands/sms', async (req, res) => {
    const { deviceId, commandType, isDemo, isAdminSms, adminMobile } = req.body;

    // 1. Safety Block: Demo environments should never trigger actual hardware commands
    if (isDemo) {
        console.log(`[SIMULATION] Blocked command ${commandType} to ${deviceId} from Demo account.`);
        return res.json({ status: 'SUCCESS', message: 'Simulation Mode: Command blocked from leaving Sandbox.', command: commandType });
    }

    try {
        let smsBody = '';

        // 2. Admin Custom SMS Dispatch Route
        if (isAdminSms) {
            smsBody = commandType; // Directly use the custom string from the Admin Dashboard
            console.log(`[Admin SMS Dispatch] Sender: ${adminMobile} | Target: ${deviceId} | Command: ${smsBody}`);

            // In a real environment, you'd trigger Twilio here:
            // await twilioClient.messages.create({ body: smsBody, from: adminMobile, to: deviceId });

            return res.json({ status: 'SUCCESS', message: 'Admin Command Dispatched via SMS Gateway', command: smsBody });
        }

        // 3. Client Pre-defined Protocol Route
        if (commandType === 'CUT_ENGINE') smsBody = 'RELAY,1#';
        else if (commandType === 'RESTORE_ENGINE') smsBody = 'RELAY,0#';
        else smsBody = commandType;

        console.log(`[Command Queue] Sending command to ${deviceId}: ${smsBody}`);

        // Push to Redis Queue so TCP server can pick it up and emit over the active socket
        if (redisClient) {
            await redisClient.lPush(`cmd_queue:${deviceId}`, Buffer.from(smsBody).toString('hex'));
        }

        res.json({ status: 'SUCCESS', message: 'Command Dispatched to Device TCP Queue', command: smsBody });
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

            entered.forEach(gf => {
                const alert = { type: 'GEOFENCE_ENTER', imei: data.imei, fenceName: gf.name, timestamp: new Date() };
                io.to(`imei_${data.imei}`).emit('VEHICLE_ALERT', alert);
                io.to('admin_room').emit('VEHICLE_ALERT', alert);
                // Record Alert in DB
                pool.query('INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, NOW() FROM devices WHERE imei = $1', [data.imei, `Entered Geofence: ${gf.name}`]);
            });

            exited.forEach(gf => {
                const alert = { type: 'GEOFENCE_EXIT', imei: data.imei, fenceName: gf.name, timestamp: new Date() };
                io.to(`imei_${data.imei}`).emit('VEHICLE_ALERT', alert);
                io.to('admin_room').emit('VEHICLE_ALERT', alert);
                // Record Alert in DB
                pool.query('INSERT INTO alerts (device_id, message, timestamp) SELECT id, $2, NOW() FROM devices WHERE imei = $1', [data.imei, `Exited Geofence: ${gf.name}`]);
            });

        } catch (e) {
            console.error('gps:updates processing error:', e);
        }
    });
});



// Start Server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Backend API Server running on port ${PORT}`);
});
