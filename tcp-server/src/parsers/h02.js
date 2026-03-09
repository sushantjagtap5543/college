/**
 * H02 Protocol Parser
 * Supports: Login (*HQ,IMEI,V1...), Location (*HQ,IMEI,V1,TIME,A,LAT,N,LNG,E...)
 */
class H02Parser {
    static parse(buffer) {
        const str = buffer.toString('ascii');
        if (!str.startsWith('*HQ')) return { valid: false, reason: 'Invalid H02 start' };

        const parts = str.replace('#', '').split(',');
        const imei = parts[1];
        const type = parts[2];

        if (type === 'V1') {
            if (parts.length < 11) {
                return { valid: true, type: 'LOGIN', imei, serial: 1 };
            }

            // Location: *HQ,IMEI,V1,TIME,A,LAT,N,LNG,E,SPEED,COURSE,DATE...
            const timeStr = parts[3];   // HHMMSS
            const status = parts[4];    // A=Valid, V=Invalid
            const latStr = parts[5];    // DDMM.MMMM
            const ns = parts[6];        // N/S
            const lngStr = parts[7];    // DDDMM.MMMM
            const ew = parts[8];        // E/W
            const speedStr = parts[9];  // knots? or km/h? Usually knots in H02
            const courseStr = parts[10];
            const dateStr = parts[11];  // DDMMYY

            if (status !== 'A') return { valid: true, type: 'LOCATION_INVALID', imei };

            const lat = this._convertCoordinate(latStr, ns);
            const lng = this._convertCoordinate(lngStr, ew);
            const speed = parseFloat(speedStr) * 1.852; // Convert knots to km/h
            const heading = parseInt(courseStr);

            const year = 2000 + parseInt(dateStr.substring(4, 6));
            const month = parseInt(dateStr.substring(2, 4));
            const day = parseInt(dateStr.substring(0, 2));
            const hour = parseInt(timeStr.substring(0, 2));
            const min = parseInt(timeStr.substring(2, 4));
            const sec = parseInt(timeStr.substring(4, 6));
            const timestamp = new Date(Date.UTC(year, month - 1, day, hour, min, sec)).toISOString();

            return {
                valid: true,
                type: 'LOCATION',
                protocol: 'H02',
                imei,
                lat,
                lng,
                speed,
                heading,
                timestamp,
                gpsFixed: true
            };
        }

        return { valid: true, type: 'UNKNOWN', protocol: 'H02', imei };
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

module.exports = H02Parser;
