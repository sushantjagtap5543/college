#!/bin/bash
# =============================================================================
# GeoSurePath — CLEAN SLATE NUCLEAR DEPLOY SCRIPT
# Run on AWS Lightsail Ubuntu 22.04 instance
# Usage: sudo bash clean_deploy.sh
# =============================================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
info() { echo -e "${CYAN}[→] $1${NC}"; }
err()  { echo -e "${RED}[✗] $1${NC}"; }

echo -e "${RED}"
echo "  ██████╗██╗     ███████╗ █████╗ ███╗   ██╗"
echo "  ██╔════╝██║     ██╔════╝██╔══██╗████╗  ██║"
echo "  ██║     ██║     █████╗  ███████║██╔██╗ ██║"
echo "  ██║     ██║     ██╔══╝  ██╔══██║██║╚██╗██║"
echo "  ╚██████╗███████╗███████╗██║  ██║██║ ╚████║"
echo "   ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝"
echo -e "${CYAN}  GeoSurePath — Nuclear Clean + Fresh Deploy${NC}"
echo ""

[ "$EUID" -ne 0 ] && { err "Run as root: sudo bash clean_deploy.sh"; exit 1; }

APP_DIR="/opt/gps-platform"
REPO_URL="https://github.com/sushantjagtap5543/college.git"

# ── PHASE 1: NUCLEAR CLEAN ────────────────────────────────────────────────────
info "PHASE 1: Stopping and removing ALL Docker containers, images, and volumes..."

# Stop all running containers
docker stop $(docker ps -aq) 2>/dev/null && log "All containers stopped" || warn "No running containers to stop"

# Remove all containers
docker rm -f $(docker ps -aq) 2>/dev/null && log "All containers removed" || warn "No containers to remove"

# Remove all images
docker rmi -f $(docker images -aq) 2>/dev/null && log "All images removed" || warn "No images to remove"

# Remove all volumes (⚠️ WIPES ALL DATA including Postgres DB)
docker volume rm $(docker volume ls -q) 2>/dev/null && log "All volumes removed (DB wiped)" || warn "No volumes to remove"

# Remove all networks
docker network prune -f 2>/dev/null && log "Networks pruned" || true

# Clean Docker system completely
docker system prune -a --volumes -f 2>/dev/null && log "Docker system fully cleaned" || true

# ── PHASE 2: REMOVE OLD CODE ──────────────────────────────────────────────────
info "PHASE 2: Removing old application code..."
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    log "Old app directory removed: $APP_DIR"
fi

# ── PHASE 3: FRESH CLONE ──────────────────────────────────────────────────────
info "PHASE 3: Cloning latest code from GitHub..."
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
log "Repository cloned successfully"
echo "Latest commit: $(git log --oneline -1)"

# ── PHASE 4: ENVIRONMENT SETUP ────────────────────────────────────────────────
info "PHASE 4: Creating production environment file..."
cat > "backend/.env" <<ENVEOF
PORT=8080
NODE_ENV=production
POSTGRES_USER=gps_admin
POSTGRES_PASSWORD=gps_strong_password
POSTGRES_DB=gps_saas
DB_HOST=db
DB_PORT=5432
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_EMAIL=admin@geosurepath.com
ADMIN_PASSWORD=admin@123
PORTAL_NAME=GeoSurePath
TRACCAR_URL=http://traccar:8082
TRACCAR_USER=admin
TRACCAR_PASS=admin
GOOGLE_BACKUP_FOLDER_ID=1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8
SIMULATE=true
ENVEOF
log "Environment file created"

# ── PHASE 5: DOCKER BUILD + LAUNCH ───────────────────────────────────────────
info "PHASE 5: Building and launching services (this takes 5-10 minutes)..."
docker-compose build --no-cache --pull
docker-compose up -d
log "All containers started"

# ── PHASE 6: WAIT FOR DB READINESS ───────────────────────────────────────────
info "PHASE 6: Waiting for PostgreSQL to be ready..."
sleep 15
MAX_TRIES=20
TRIES=0
until docker exec gps_postgres pg_isready -U gps_admin -d gps_saas 2>/dev/null; do
    TRIES=$((TRIES + 1))
    if [ $TRIES -ge $MAX_TRIES ]; then
        warn "PostgreSQL not ready after ${MAX_TRIES} attempts, continuing anyway..."
        break
    fi
    info "Waiting for PostgreSQL... attempt $TRIES/$MAX_TRIES"
    sleep 5
done
log "PostgreSQL is ready!"

# ── PHASE 7: LOAD SCHEMA ──────────────────────────────────────────────────────
info "PHASE 7: Loading V3 database schema..."
docker exec -i gps_postgres psql -U gps_admin -d gps_saas < database/schema.sql
log "Schema loaded successfully"

# ── PHASE 8: NGINX SETUP ──────────────────────────────────────────────────────
info "PHASE 8: Configuring Nginx reverse proxy..."

# Install Nginx if not present
which nginx || apt-get install -y nginx

cat > /etc/nginx/sites-available/gps-platform <<NGINXEOF
server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://localhost:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # Traccar API proxy
    location /traccar/ {
        proxy_pass http://localhost:8082/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/gps-platform /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
log "Nginx configured and reloaded"

# ── PHASE 9: FIREWALL ─────────────────────────────────────────────────────────
info "PHASE 9: Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8082/tcp
ufw allow 5000/tcp
ufw allow 5023/tcp
ufw allow 5002/tcp
ufw allow 5055/udp
ufw --force enable
log "Firewall configured"

# ── PHASE 10: HEALTH VERIFICATION ────────────────────────────────────────────
info "PHASE 10: Running live health check..."
sleep 10

echo ""
echo -e "${CYAN}=== CONTAINER STATUS ===${NC}"
docker-compose ps

echo ""
echo -e "${CYAN}=== BACKEND HEALTH ===${NC}"
curl -sf http://localhost:8080/api/v1/health 2>/dev/null && echo "" || warn "Backend not responding yet (may still be starting)"

echo ""
echo -e "${CYAN}=== FRONTEND STATUS ===${NC}"
curl -sf -o /dev/null -w "Frontend HTTP Status: %{http_code}\n" http://localhost:3000 2>/dev/null || warn "Frontend not responding yet"

echo ""
echo -e "${CYAN}=== TRACCAR STATUS ===${NC}"
curl -sf -o /dev/null -w "Traccar HTTP Status: %{http_code}\n" http://localhost:8082 2>/dev/null || warn "Traccar not responding yet"

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  🚀 GeoSurePath Successfully Deployed!                        ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "  Portal:      ${CYAN}http://3.108.114.12${NC}"
echo -e "  API:         ${CYAN}http://3.108.114.12:8080/api/v1/health${NC}"
echo -e "  Traccar:     ${CYAN}http://3.108.114.12:8082${NC}"
echo ""
echo -e "  Admin Login: ${YELLOW}admin@geosurepath.com${NC} / ${YELLOW}admin@123${NC}"
echo -e "  Traccar:     ${YELLOW}admin${NC} / ${YELLOW}admin${NC}"
echo ""
echo -e "  GPS Server:  ${CYAN}3.108.114.12:5023${NC} (GT06/Concox)"
echo -e "  IMEI Added:  ${CYAN}869727079043558${NC}"
echo ""
echo -e "${YELLOW}  SMS to GPS device SIM card:${NC}"
echo -e "  SERVER,0,3.108.114.12,5023,0#"
echo -e "  APN,<your_apn>#"
echo ""
echo -e "${YELLOW}  Check live logs: docker-compose logs -f backend${NC}"
