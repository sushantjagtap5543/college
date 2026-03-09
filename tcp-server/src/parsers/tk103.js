/**
 * TK103 Protocol Parser
 * Supports: Login (BP05), Location (BR00 or location strings)
 */
class TK103Parser {
    static parse(buffer) {
        const str = buffer.toString('ascii').replace(/^\(/, '').replace(/\)$/, '');

        // Match IMEI (12-15 digits)
        const imeiMatch = str.match(/^(\d{12,15})/);
        if (!imeiMatch) return { valid: false, reason: 'Invalid TK103 start' };

        const imei = imeiMatch[1];
        const content = str.substring(imei.length);

        // Check for BP05 (Login/Heartbeat)
        if (content.startsWith('BP00') || content.startsWith('BP05')) {
            return { valid: true, type: 'LOGIN', imei, serial: 1 };
        }

        // Location data often follows BR00 or is a raw delimited string
        // (123456789012345BR00150210A2234.1234N11405.1234E000.0150210000.00...)
        const locMatch = content.match(/(BR00|BO01)?(\d{6})([AV])(\d{4}\.\d{4})([NS])(\d{5}\.\d{4})([EW])(\d{3}\.\d)(\d{6})(\d{3}\.\d)?/);

        if (locMatch) {
            const dateStr = locMatch[2];    // YYMMDD
            const status = locMatch[3];     // A/V
            const latStr = locMatch[4];     // DDMM.MMMM
            const ns = locMatch[5];
            const lngStr = locMatch[6];     // DDDMM.MMMM
            const ew = locMatch[7];
            const speedStr = locMatch[8];
            const timeStr = locMatch[9];    // HHMMSS
            const courseStr = locMatch[10];

            if (status !== 'A') return { valid: true, type: 'LOCATION_INVALID', imei };

            const lat = this._convertCoordinate(latStr, ns);
            const lng = this._convertCoordinate(lngStr, ew);
            const speed = parseFloat(speedStr) * 1.852;
            const heading = courseStr ? parseFloat(courseStr) : 0;

            const year = 2000 + parseInt(dateStr.substring(0, 2));
            const month = parseInt(dateStr.substring(2, 4));
            const day = parseInt(dateStr.substring(4, 6));
            const hour = parseInt(timeStr.substring(0, 2));
            const min = parseInt(timeStr.substring(2, 4));
            const sec = parseInt(timeStr.substring(4, 6));
            const timestamp = new Date(Date.UTC(year, month - 1, day, hour, min, sec)).toISOString();

            return {
                valid: true,
                type: 'LOCATION',
                protocol: 'TK103',
                imei,
                lat,
                lng,
                speed,
                heading,
                timestamp,
                gpsFixed: true
            };
        }

        return { valid: true, type: 'UNKNOWN', protocol: 'TK103', imei };
    }

    static _convertCoordinate(str, hemisphere) {
        if (!str) return 0;
        const dotIdx = str.indexOf('.');
        const degreesStr = str.substring(0, dotIdx - 2);
        const minutesStr = str.substring(dotIdx - 2);
        let degrees = parseFloat(degreesStr) + (parseFloat(minutesStr) / 60.0);
        if (hemisphere === 'S' || hemisphere === 'W') degrees = -degrees;
        return parseFloat(degrees.toFixed(6));
    }
}

module.exports = TK103Parser;
