/**
 * H02 Protocol Parser Stub
 */
class H02Parser {
    static parse(buffer) {
        const str = buffer.toString('ascii');
        // *HQ,1234567890,V1...
        const parts = str.split(',');
        if (parts[0] === '*HQ' && parts[1]) {
            return { valid: true, type: 'LOGIN', imei: parts[1], serial: 1 };
        }
        return { valid: false, reason: 'Invalid H02 format' };
    }
}

module.exports = H02Parser;
