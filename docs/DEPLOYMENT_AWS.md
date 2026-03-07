# AWS Lightsail Deployment, Security & Backup Strategy

## 1. Environment Provisioning (AWS Lightsail - Ubuntu 22.04 LTS)
Given the requirements: **2GB RAM Server Minimum** (Scaling to EC2 later).
1. Go to AWS Lightsail -> Create Instance -> Linux/Unix -> Ubuntu 22.04 LTS.
2. Select **$10/month** or **$20/month** (2GB/4GB RAM) tier.
3. Attach Static IP.
4. **Firewall Rules**:
    - **Port 80/443** (HTTP/HTTPS for Web and API)
    - **Port 5023/5001** (Custom Custom TCP ports for device ingestion)
    - **Port 22** (SSH for management)

## 2. Server Initialization Steps
SSH into the instance and run:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose nginx certbot python3-certbot-nginx -y
sudo usermod -aG docker ubuntu
```

## 3. Clone & Deploy
```bash
git clone https://your-repo/gps-light.git
cd gps-light
# Start services
docker-compose up -d --build
```

## 4. NGINX Reverse Proxy & SSL Setup
Set up NGINX to route domains properly.
- `app.yourdomain.com` -> routes to frontend Docker container (Port 3000).
- `api.yourdomain.com` -> routes to backend Docker container (Port 8080).

Issue SSL using Let's Encrypt:
```bash
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

## 5. Backup & Disaster Recovery
### Automated Backups
Create a daily cron job script for `pg_dump`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/gps_db"
DATE=$(date +"%Y%m%d_%H%M")
mkdir -p $BACKUP_DIR
docker exec gps_postgres pg_dump -U gps_admin gps_saas > $BACKUP_DIR/db_backup_$DATE.sql
# Optional: compress and push to AWS S3
gzip $BACKUP_DIR/db_backup_$DATE.sql
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://your-s3-backup-bucket/
```

### Restore Procedure
If the DB crashes, spin up the new environment and run:
```bash
gunzip db_backup_latest.sql.gz
docker exec -i gps_postgres psql -U gps_admin gps_saas < db_backup_latest.sql
```

## 6. Security Best Practices Included
1. **JWT & Passwords**: bcrypt hashing, HTTPS enforced in NGINX.
2. **OTP for Engine Blocking**: Required to prevent arbitrary ignition cutoffs via stolen sessions.
3. **Emergency Kill-Switch**: Super Admin has a master API toggle `emergency_mode=true` which globally prevents ANY device commands from exiting the server, locking down the fleet instantly.
4. **Database Exposure**: PostgreSQL and Redis ports (5432, 6379) are only open internally to Docker, NOT exposed to the public internet via the Lightsail firewall.
