require('dotenv').config();
const net = require('net');
const redis = require('redis');
const GT06Parser = require('./parsers/gt06');
const ProtocolDetector = require('./parsers/ProtocolDetector');
const RulesEngine = require('./RulesEngine');
const { Pool } = require('pg');

// Connect to Postgres
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432,
});

// Per user requirement: TCP server ingests real GPS hex data on port 5000
const PORT = process.env.TCP_PORT || 5000;

// Connect to Redis for live tracking state and pub/sub broadcasting
const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`,
});
const redisPub = redisClient.duplicate(); // Separate client for publishing

redisClient.on('error', (err) => console.error('[Redis] Client Error:', err));
redisPub.on('error', (err) => console.error('[Redis] Publisher Error:', err));

Promise.all([redisClient.connect(), redisPub.connect()])
    .then(() => console.log('[Redis] Connected (client + publisher)'))
    .catch((err) => console.error('[Redis] Connection Error:', err));

const server = net.createServer((socket) => {
    let deviceImei = null;
    let dataBuffer = Buffer.alloc(0); // accumulate fragmented TCP data

    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[CONNECT] New device connection from ${remoteAddr}`);

    socket.on('data', async (chunk) => {
        // Accumulate chunks (TCP may fragment packets)
        dataBuffer = Buffer.concat([dataBuffer, chunk]);

        // Process all complete packets in the buffer
        while (dataBuffer.length >= 6) {
            // Find packet end marker: 0D 0A
            const endIdx = GT06Parser.findPacketEnd(dataBuffer);
            if (endIdx === -1) break; // No complete packet yet

            const packetBuf = dataBuffer.slice(0, endIdx + 2);
            dataBuffer = dataBuffer.slice(endIdx + 2); // Consume processed bytes

            await handlePacket(socket, packetBuf, remoteAddr);
        }
    });

    const handlePacket = async (socket, packetBuf, remoteAddr) => {
        const hexStr = packetBuf.toString('hex').toUpperCase();

        // Detect protocol before parsing so we know which parser to use
        const detection = ProtocolDetector.detect(packetBuf);
        const parsed = (detection && detection.parsed)
            ? detection.parsed
            : GT06Parser.parse(packetBuf);

        if (!parsed || !parsed.valid) {
            console.warn(`[WARN] ${remoteAddr} → Invalid packet: ${parsed ? parsed.reason : 'parse failed'} | Protocol: ${(detection && detection.protocol) || 'unknown'} | Raw: ${hexStr.substring(0, 40)}`);
            return;
        }

        if (parsed.type === 'LOGIN') {
            deviceImei = parsed.imei;
            console.log(`[LOGIN] Device connected: IMEI=${deviceImei} | Protocol: ${detection.protocol || 'GT06'} from ${remoteAddr}`);

            // Auto-update protocol and model in DB
            try {
                const proto = detection.protocol || 'GT06';
                await pool.query(
                    "UPDATE device_inventory SET protocol = $1 WHERE imei = $2 AND (protocol IS NULL OR protocol = 'GT06')",
                    [proto, deviceImei]
                );
                const modelRes = await pool.query("SELECT id FROM device_models WHERE protocol = $1 LIMIT 1", [proto]);
                if (modelRes.rows.length > 0) {
                    await pool.query(
                        "UPDATE devices SET model_id = $1 WHERE imei = $2 AND model_id IS NULL",
                        [modelRes.rows[0].id, deviceImei]
                    );
                }
            } catch (e) { console.error('[DB] Auto-link Error:', e.message); }

            // Send proper ACK based on protocol
            const ack = GT06Parser.getResponse('LOGIN', parsed.serial || 1);
            if (ack && (detection.protocol === 'GT06' || !detection.protocol)) {
                socket.write(ack);
                console.log(`[ACK] Login ACK sent to ${deviceImei}`);
            }
        }
        else if (parsed.type === 'LOCATION') {
            if (!deviceImei) {
                console.warn(`[WARN] ${remoteAddr} → Location before login — ignoring`);
                return;
            }

            console.log(`[LOCATION] ${deviceImei} | Lat: ${parsed.lat}, Lng: ${parsed.lng} | Speed: ${parsed.speed} km/h | Heading: ${parsed.heading}° | Fix: ${parsed.gpsFixed} | Sats: ${parsed.satellites} | Time: ${parsed.timestamp}`);

            const locationData = {
                imei: deviceImei,
                lat: String(parsed.lat),
                lng: String(parsed.lng),
                speed: String(parsed.speed),
                heading: String(parsed.heading),
                satellites: String(parsed.satellites),
                gps_fixed: parsed.gpsFixed ? '1' : '0',
                device_timestamp: parsed.timestamp,
                last_update: String(Date.now()),
            };

            try {
                // PostgreSQL: Resolve Device UUID from IMEI
                const deviceRes = await pool.query('SELECT id FROM devices WHERE imei = $1', [deviceImei]);
                if (deviceRes.rows.length > 0) {
                    const deviceId = deviceRes.rows[0].id;
                    const isIgnitionOn = parsed.acc === 1 || parsed.speed > 0; // fallback proxy for acc

                    // Upsert Live Data: Only update if the incoming packet is newer or same age as current live record
                    await pool.query(`
                        INSERT INTO gps_live_data (device_id, latitude, longitude, speed, heading, ignition, timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (device_id) DO UPDATE SET
                            latitude = EXCLUDED.latitude,
                            longitude = EXCLUDED.longitude,
                            speed = EXCLUDED.speed,
                            heading = EXCLUDED.heading,
                            ignition = EXCLUDED.ignition,
                            timestamp = EXCLUDED.timestamp
                        WHERE EXCLUDED.timestamp >= gps_live_data.timestamp
                    `, [deviceId, parsed.lat, parsed.lng, parsed.speed, parsed.heading, isIgnitionOn, parsed.timestamp]);

                    // Append to History
                    // Note: Ensure gps_history is partitioned or table exists.
                    await pool.query(`
                        INSERT INTO gps_history (device_id, latitude, longitude, speed, heading, ignition, timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [deviceId, parsed.lat, parsed.lng, parsed.speed, parsed.heading, isIgnitionOn, parsed.timestamp]);

                    // 4. Evaluate Alert Rules (Autonomous Rules Engine)
                    await RulesEngine.evaluate(deviceId, parsed.lat, parsed.lng, parsed.speed, isIgnitionOn, parsed.timestamp);
                }

                // 1. Store latest position in Redis Hash (for REST API reads)
                await redisClient.hSet(`live:${deviceImei}`, locationData);

                // 2. Publish to pub/sub channel for WebSocket broadcasting
                const pubMsg = JSON.stringify({
                    ...locationData,
                    lat: parsed.lat,
                    lng: parsed.lng,
                    speed: parsed.speed,
                    heading: parsed.heading,
                    isRealTime: parsed.isRealTime
                });
                await redisPub.publish('gps:updates', pubMsg);

                // 3. Forward to Traccar (OsmAnd protocol)
                try {
                    const traccarUrl = `http://localhost:8082/?id=${deviceImei}&lat=${parsed.lat}&lon=${parsed.lng}&speed=${parsed.speed * 0.539957}&timestamp=${encodeURIComponent(parsed.timestamp)}`;
                    fetch(traccarUrl).catch(e => { }); // Fire and forget
                } catch (traccarErr) { }

            } catch (dbErr) {
                console.error(`[Redis] Failed to store/publish for ${deviceImei}:`, err);
            }
        }
        else if (parsed.type === 'HEARTBEAT') {
            console.log(`[HEARTBEAT] From ${deviceImei || remoteAddr} | Protocol: ${(detection && detection.protocol) || 'GT06'}`);

            // Protocol-aware ACK
            const proto = (detection && detection.protocol) || 'GT06';
            const ack = (proto === 'GT06') ? GT06Parser.getResponse('HEARTBEAT', parsed.serial || 1) : null;
            if (ack) socket.write(ack);

            // Check for pending commands in queue (engine cut/restore)
            if (deviceImei) {
                try {
                    const cmd = await redisClient.lPop(`cmd_queue:${deviceImei}`);
                    if (cmd) {
                        console.log(`[COMMAND] Dispatching to ${deviceImei}: ${cmd}`);
                        const cmdBuf = Buffer.from(cmd, 'hex');
                        socket.write(cmdBuf);

                        // Update command_logs to SENT
                        try {
                            const devRes = await pool.query("SELECT id FROM devices WHERE imei = $1", [deviceImei]);
                            if (devRes.rows.length > 0) {
                                await pool.query(
                                    "UPDATE command_logs SET status = 'SENT', sent_at = NOW() WHERE id = (SELECT id FROM command_logs WHERE device_id = $1 AND status = 'PENDING' ORDER BY created_at ASC LIMIT 1)",
                                    [devRes.rows[0].id]
                                );
                            }
                        } catch (e) { console.error('[DB] Failed to update command log status:', e.message); }
                    }
                } catch (err) {
                    console.error(`[Redis] Command queue error for ${deviceImei}:`, err);
                }
            }
        }
        else if (parsed.type === 'UNKNOWN') {
            console.log(`[UNKNOWN] Protocol ${parsed.protocol} from ${deviceImei || remoteAddr}`);
        }
    };

    socket.on('close', () => {
        console.log(`[DISCONNECT] Device ${deviceImei || 'Unknown'} (${remoteAddr}) disconnected.`);
    });

    socket.on('error', (err) => {
        console.error(`[SOCKET ERROR] ${deviceImei || remoteAddr}: ${err.message}`);
    });

    socket.on('timeout', () => {
        console.warn(`[TIMEOUT] Socket timed out for ${deviceImei || remoteAddr}`);
        socket.destroy();
    });

    socket.setTimeout(120000); // 2-minute timeout
});

server.on('error', (err) => {
    console.error('[SERVER ERROR]:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[READY] TCP Server listening on port ${PORT} for GT06/GT06N devices`);
});
