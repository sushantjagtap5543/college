const GT06Parser = require('./gt06');
const TK103Parser = require('./tk103');
const H02Parser = require('./h02');

/**
 * ProtocolDetector
 * Identifies the protocol based on initial packet bytes.
 */
class ProtocolDetector {
    /**
     * Identify and parse the buffer.
     * @param {Buffer} buffer 
     */
    static detect(buffer) {
        if (!buffer || buffer.length < 2) return { valid: false, reason: 'Too short' };

        const b = buffer;
        const s1 = b[0];
        const s2 = b[1];

        // 1. GT06 (0x78 0x78 or 0x79 0x79)
        if ((s1 === 0x78 && s2 === 0x78) || (s1 === 0x79 && s2 === 0x79)) {
            return { protocol: 'GT06', parsed: GT06Parser.parse(buffer) };
        }

        // 2. TK103 (Starts with '(' or '##')
        if (s1 === 0x28 || (s1 === 0x23 && s2 === 0x23)) {
            return { protocol: 'TK103', parsed: TK103Parser.parse(buffer) };
        }

        // 3. H02 (Starts with '*')
        if (s1 === 0x2A) {
            return { protocol: 'H02', parsed: H02Parser.parse(buffer) };
        }

        // 4. Teltonika (Starts with 0x00 0x00 0x00 0x00)
        if (buffer.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) {
            return { protocol: 'Teltonika', parsed: { valid: true, type: 'LOGIN', imei: 'TELTONIKA_AUTO' } };
        }

        return { protocol: 'UNKNOWN', valid: false };
    }
}

module.exports = ProtocolDetector;
