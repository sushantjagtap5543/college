const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { google } = require('googleapis');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.DB_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

async function downloadFromDrive(fileId, destPath) {
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../google-service-account.json'),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const dest = fs.createWriteStream(destPath);
    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        res.data
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .pipe(dest);
    });
}

async function restore() {
    console.log('--- SYSTEM RESTORATION TOOL ---');
    const fileId = process.argv[2];
    if (!fileId) {
        console.error('Usage: node restore-from-gdrive.js <GOOGLE_DRIVE_FILE_ID>');
        process.exit(1);
    }

    const tempPath = path.join(__dirname, '../temp/restore_data.json');
    if (!fs.existsSync(path.join(__dirname, '../temp'))) fs.mkdirSync(path.join(__dirname, '../temp'));

    try {
        console.log(`Downloading file ${fileId}...`);
        await downloadFromDrive(fileId, tempPath);

        const content = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
        console.log('File loaded. Analyzing content...');

        if (content.type === 'INCREMENTAL') {
            console.log(`Restoring Incremental Data from ${content.date} (${content.count} records)...`);
            for (const row of content.data) {
                await pool.query(
                    `INSERT INTO gps_history (device_id, latitude, longitude, speed, timestamp, heading, ignition, attributes) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
                    [row.device_id, row.latitude, row.longitude, row.speed, row.timestamp, row.heading, row.ignition, row.attributes]
                );
            }
        } else if (content.users) {
            console.log('Restoring Full System Snapshot...');
            // Restore users, devices, etc.
            for (const table in content) {
                console.log(`Processing table: ${table}`);
                for (const row of content[table]) {
                    const keys = Object.keys(row).join(', ');
                    const values = Object.values(row);
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    await pool.query(`INSERT INTO ${table} (${keys}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
                }
            }
        } else {
            console.log('Generic GPS History import...');
            const data = Array.isArray(content) ? content : content.data;
            for (const row of data) {
                await pool.query(
                    `INSERT INTO gps_history (device_id, latitude, longitude, speed, timestamp, heading, ignition, attributes) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
                    [row.device_id, row.latitude, row.longitude, row.speed, row.timestamp, row.heading, row.ignition, row.attributes]
                );
            }
        }

        console.log('Restoration COMPLETE. Cleaning up...');
        fs.unlinkSync(tempPath);
        process.exit(0);
    } catch (err) {
        console.error('RESTORE FAILED:', err);
        process.exit(1);
    }
}

restore();
