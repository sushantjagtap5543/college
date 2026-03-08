const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Service to handle database backups and archival to Google Drive.
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in environment.
 */
class GoogleDriveService {
    constructor() {
        this.auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
            ['https://www.googleapis.com/auth/drive']
        );
        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    /**
     * Upload a file to a specific Google Drive folder.
     */
    async uploadFile(filePath, folderId) {
        try {
            const fileMetadata = {
                name: path.basename(filePath),
                parents: folderId ? [folderId] : []
            };
            const media = {
                body: fs.createReadStream(filePath)
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });

            console.log(`[Google Drive] File uploaded successfully. ID: ${response.data.id}`);
            return response.data;
        } catch (err) {
            console.error('[Google Drive] Upload failed:', err.message);
            throw err;
        }
    }

    /**
     * Search for archived history files.
     */
    async findArchives(query) {
        try {
            const response = await this.drive.files.list({
                q: `name contains '${query}' and trashed = false`,
                fields: 'files(id, name, webContentLink)'
            });
            return response.data.files;
        } catch (err) {
            console.error('[Google Drive] Search failed:', err.message);
            return [];
        }
    }
}

module.exports = new GoogleDriveService();
