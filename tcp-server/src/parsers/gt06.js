/**
 * GT06 / GT06N Real Binary Protocol Parser
 * Phase 6 - Production-grade implementation
 * Supports: Login (0x01), Location (0x12/0x22), Heartbeat (0x13)
 *
 * GT06 Packet Structure (short):
 *   78 78  [length]  [protocol]  [data...]  [serial_hi] [serial_lo]  [crc_hi] [crc_lo]  0D 0A
 *
 * GT06 Packet Structure (long, 0x79 0x79):
 *   79 79  [len_hi] [len_lo]  [protocol]  [data...]  [serial_hi] [serial_lo]  [crc_hi] [crc_lo]  0D 0A
 */
class GT06Parser {
    /**
     * Parse a raw buffer received from a GT06 device.
     * @param {Buffer} buffer - raw bytes from the TCP socket
     * @returns {Object} parsed result
     */
    static parse(buffer) {
        if (!buffer || buffer.length < 6) {
            return { valid: false, reason: 'Buffer too short' };
        }

        const b = buffer;
        const start1 = b[0];
        const start2 = b[1];

        let isLong = false;
        let headerOffset = 0;

        if (start1 === 0x78 && start2 === 0x78) {
            // Short packet: 0x78 0x78
            isLong = false;
            headerOffset = 2;
        } else if (start1 === 0x79 && start2 === 0x79) {
            // Long packet: 0x79 0x79
            isLong = true;
            headerOffset = 2;
        } else {
            return { valid: false, reason: `Invalid start bytes: ${start1.toString(16)} ${start2.toString(16)}` };
        }

        let length, protocolByte, dataStart;

        if (!isLong) {
            // Short: next byte is full packet length (from protocol byte to CRC, not including start or length byte)
            length = b[headerOffset];
            protocolByte = b[headerOffset + 1];
            dataStart = headerOffset + 2;
        } else {
            // Long: next two bytes are length
            length = (b[headerOffset] << 8) | b[headerOffset + 1];
            protocolByte = b[headerOffset + 2];
            dataStart = headerOffset + 3;
        }

        // Extract serial number (2 bytes before CRC, which is 2 bytes before stop bytes 0D 0A)
        const stopIdx = b.length - 2; // 0D 0A
        const crcIdx = stopIdx - 2;   // CRC bytes
        const serialIdx = crcIdx - 2; // serial bytes

        let serialNo = 0;
        if (serialIdx >= dataStart) {
            serialNo = (b[serialIdx] << 8) | b[serialIdx + 1];
        }

        switch (protocolByte) {
            case 0x01:
                return GT06Parser._parseLogin(b, dataStart, serialNo);
            case 0x12:
                return GT06Parser._parseLocation(b, dataStart, serialNo, 0x12);
            case 0x22:
                return GT06Parser._parseLocation(b, dataStart, serialNo, 0x22);
            case 0x13:
                return { valid: true, type: 'HEARTBEAT', serial: serialNo };
            default:
                return { valid: true, type: 'UNKNOWN', protocol: `0x${protocolByte.toString(16).toUpperCase()}`, serial: serialNo };
        }
    }

    /**
     * Parse Login Packet (Protocol 0x01)
     * Data: 8 bytes BCD IMEI (15 digits packed as 8 bytes, first nibble ignored)
     */
    static _parseLogin(buf, dataStart, serial) {
        // IMEI is encoded as 8 bytes of BCD (15 hex digits, padded with leading 0)
        // e.g. IMEI 869727079043556 → 08 69 72 70 79 04 35 56
        const imeiBytes = buf.slice(dataStart, dataStart + 8);
        let imei = '';
        for (let i = 0; i < imeiBytes.length; i++) {
            const hi = (imeiBytes[i] >> 4) & 0x0F;
            const lo = imeiBytes[i] & 0x0F;
            imei += hi.toString() + lo.toString();
        }
        // Remove leading zero that was used for padding (IMEI is 15 digits)
        if (imei.length === 16 && imei[0] === '0') {
            imei = imei.substring(1);
        }

        return { valid: true, type: 'LOGIN', imei, serial };
    }

    /**
     * Parse Location Packet (Protocol 0x12 or 0x22)
     *
     * Byte layout inside data area:
     *   [0]    Year   (BCD, 2-digit, e.g. 0x26 = 2026)
     *   [1]    Month  (BCD)
     *   [2]    Day    (BCD)
     *   [3]    Hour   (BCD)
     *   [4]    Minute (BCD)
     *   [5]    Second (BCD)
     *   [6]    Quantity of GPS satellites (upper 4 bits) + remaining data flag (lower 4 bits)
     *   [7-10] Latitude  (uint32, degrees * 1,800,000)
     *   [11-14] Longitude (uint32, degrees * 1,800,000)
     *   [15]   Speed     (uint8, km/h)
     *   [16-17] Course/Heading (uint16, lower 10 bits = heading 0-359; upper 6 bits = flags)
     *           Bit 3 of high byte: 1=realtime, 0=re-upload
     *           Bit 2: 1=GPS fixed, 0=not fixed
     *           Bit 1: 1=East, 0=West
     *           Bit 0: 1=North, 0=South
     */
    static _parseLocation(buf, dataStart, serial, protocol) {
        if (buf.length < dataStart + 18) {
            return { valid: false, reason: 'Location packet too short' };
        }

        const bcdDecode = (byte) => ((byte >> 4) * 10) + (byte & 0x0F);

        const year = 2000 + bcdDecode(buf[dataStart]);
        const month = bcdDecode(buf[dataStart + 1]);
        const day = bcdDecode(buf[dataStart + 2]);
        const hour = bcdDecode(buf[dataStart + 3]);
        const minute = bcdDecode(buf[dataStart + 4]);
        const second = bcdDecode(buf[dataStart + 5]);

        const satCount = (buf[dataStart + 6] >> 4) & 0x0F;

        // Latitude: 4 bytes big-endian unsigned int
        const latRaw = (buf[dataStart + 7] << 24) | (buf[dataStart + 8] << 16) |
            (buf[dataStart + 9] << 8) | buf[dataStart + 10];

        // Longitude: 4 bytes big-endian unsigned int
        const lngRaw = (buf[dataStart + 11] << 24) | (buf[dataStart + 12] << 16) |
            (buf[dataStart + 13] << 8) | buf[dataStart + 14];

        const speed = buf[dataStart + 15]; // km/h

        // Course: 2 bytes
        const courseByte0 = buf[dataStart + 16];
        const courseByte1 = buf[dataStart + 17];

        // Upper 6 bits of courseByte0 are flags; lower 2 bits + courseByte1 = heading
        const flags = (courseByte0 >> 2) & 0x3F;
        const heading = ((courseByte0 & 0x03) << 8) | courseByte1;

        // E/W and N/S flags
        const isEast = !!(flags & 0x08);
        const isNorth = !!(flags & 0x04);
        const isFixed = !!(flags & 0x10);

        // Convert raw values to decimal degrees (divide by 1,800,000)
        let lat = latRaw / 1800000.0;
        let lng = lngRaw / 1800000.0;

        if (!isNorth) lat = -lat;
        if (!isEast) lng = -lng;

        const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

        return {
            valid: true,
            type: 'LOCATION',
            protocol: `0x${protocol.toString(16).toUpperCase()}`,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
            speed,
            heading,
            satellites: satCount,
            gpsFixed: isFixed,
            timestamp: timestamp.toISOString(),
            serial
        };
    }

    /**
     * Build a proper GT06 ACK/response packet.
     * Format: 78 78 05 {protocolByte} {serialHi} {serialLo} {crcHi} {crcLo} 0D 0A
     */
    static getResponse(type, serialNumber) {
        let protocolByte;
        if (type === 'LOGIN') {
            protocolByte = 0x01;
        } else if (type === 'HEARTBEAT') {
            protocolByte = 0x13;
        } else {
            return null;
        }

        const serialHi = (serialNumber >> 8) & 0xFF;
        const serialLo = serialNumber & 0xFF;

        // CRC is calculated over: length, protocol, serial bytes
        // Using CRC-16/IBM (polynomial 0xA001, initial value 0xFFFF)
        const dataForCrc = [0x05, protocolByte, serialHi, serialLo];
        const crc = GT06Parser._crc16(dataForCrc);
        const crcHi = (crc >> 8) & 0xFF;
        const crcLo = crc & 0xFF;

        return Buffer.from([0x78, 0x78, 0x05, protocolByte, serialHi, serialLo, crcHi, crcLo, 0x0D, 0x0A]);
    }

    /**
     * CRC-16/IBM (used by GT06 protocol)
     * Polynomial: 0x8005 | Initial: 0x0000 | Input/Output reflected (→ use 0xA001)
     */
    static _crc16(bytes) {
        let crc = 0xFFFF;
        for (const byte of bytes) {
            crc ^= byte;
            for (let i = 0; i < 8; i++) {
                if (crc & 1) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        return crc & 0xFFFF;
    }

    /**
     * Find the end of the first complete GT06 packet in a buffer.
     * Returns the index of 0x0A in the 0D 0A stop sequence, or -1 if no complete packet found.
     * @param {Buffer} buf
     * @returns {number}
     */
    static findPacketEnd(buf) {
        for (let i = 0; i < buf.length - 1; i++) {
            if (buf[i] === 0x0D && buf[i + 1] === 0x0A) {
                return i + 1;
            }
        }
        return -1;
    }
}

module.exports = GT06Parser;
