const net = require('net');

/**
 * Mock GPS Device Simulator (GT06 Protocol)
 * Usage: node mock_device.js <IMEI> [PORT] [HOST]
 */

const IMEI = process.argv[2] || '869727079043556';
const PORT = parseInt(process.argv[3]) || 5000;
const HOST = process.argv[4] || 'localhost';

function buildLogin(imei) {
    const imeiHex = imei.length === 15 ? '0' + imei : imei;
    const data = Buffer.from('01' + imeiHex + '0001', 'hex');
    return wrapPacket(data);
}

function buildHeartbeat() {
    return wrapPacket(Buffer.from('130001', 'hex'));
}

function wrapPacket(data) {
    const start = Buffer.from([0x78, 0x78]);
    const stop = Buffer.from([0x0D, 0x0A]);
    const len = Buffer.from([data.length + 5]); // protocol + data + serial(2) + crc(2)

    // Serial hi/lo
    const serial = Buffer.from([0x00, 0x01]);

    const packetToCRC = Buffer.concat([len, data, serial]);

    // Simplified CRC-ITU calculation
    let crc = 0xFFFF;
    for (const b of packetToCRC) {
        crc ^= b;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
        }
    }
    const crcBuf = Buffer.alloc(2);
    crcBuf.writeUInt16BE(crc, 0);

    return Buffer.concat([start, packetToCRC, crcBuf, stop]);
}

const client = new net.Socket();

client.connect(PORT, HOST, () => {
    console.log(`[CONNECTED] Simulating device IMEI: ${IMEI} on ${HOST}:${PORT}`);

    const login = buildLogin(IMEI);
    console.log(`[SEND] Login Packet: ${login.toString('hex').toUpperCase()}`);
    client.write(login);

    // Send Heartbeat every 15 seconds to check for commands
    setInterval(() => {
        const hb = buildHeartbeat();
        console.log(`[SEND] Heartbeat Packet: ${hb.toString('hex').toUpperCase()}`);
        client.write(hb);
    }, 15000);
});

client.on('data', (data) => {
    console.log(`[RECV] Received from server: ${data.toString('hex').toUpperCase()}`);
    console.log(`[INFO] (ASCII): ${data.toString('ascii')}`);
});

client.on('close', () => console.log('[CLOSED] Connection closed'));
client.on('error', (err) => console.error('[ERROR]', err.message));
