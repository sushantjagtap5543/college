/**
 * TK103 Protocol Parser Stub
 */
class TK103Parser {
    static parse(buffer) {
        const str = buffer.toString('ascii');
        // Basic identification: (012345678901234BP05...)
        const match = str.match(/\(?(\d{12,15})/);
        if (match) {
            return { valid: true, type: 'LOGIN', imei: match[1], serial: 1 };
        }
        return { valid: false, reason: 'Invalid TK103 format' };
    }
}

module.exports = TK103Parser;
