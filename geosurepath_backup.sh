#!/bin/bash
# geosurepath_backup.sh
# Daily PostgreSQL Backup and Google Drive Upload Script
# Prerequisites: PostgreSQL, gzip, and rclone (configured for gdrive)

# Configuration
DB_NAME="gps_live_tracking" # Update to your production DB name if different
DB_USER="postgres"
BACKUP_DIR="/var/backups/geosurepath"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/${DB_NAME}_backup_$DATE.sql.gz"
RETENTION_DAYS=7

# GDrive remote name configured in rclone (e.g., via `rclone config`)
RCLONE_REMOTE="gdrive:geosurepath_backups"

# 1. Ensure backup directory exists locally
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting GEOSUREPATH database backup for $DB_NAME..."

# 2. Dump database and compress
# Note: You may need a .pgpass file or PGPASSWORD environment variable set for passwordless pg_dump
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILENAME"

if [ $? -eq 0 ]; then
    echo "[$(date)] Local backup successful: $FILENAME"
    
    # 3. Upload to Google Drive via rclone
    echo "[$(date)] Uploading to Google Drive..."
    rclone copy "$FILENAME" "$RCLONE_REMOTE"
    
    if [ $? -eq 0 ]; then
        echo "[$(date)] Cloud upload successful."
        
        # 4. Clean up older local backups (keep last N days)
        find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
        echo "[$(date)] Local backups older than $RETENTION_DAYS days cleaned."
    else
        echo "[$(date)] ERROR: Cloud upload failed! Please check rclone configuration."
        exit 1
    fi
else
    echo "[$(date)] ERROR: Database backup failed!"
    exit 1
fi

echo "[$(date)] Backup workflow completed successfully."
