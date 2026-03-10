#!/bin/bash
# =============================================================================
# Strategic GPS Platform — AWS Lightsail Production Deployment Script
# Optimized for: 2GB RAM Instances (Ubuntu 22.04 LTS)
# =============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
info() { echo -e "${CYAN}[→] $1${NC}"; }
err()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

echo -e "${CYAN}"
echo "  SaaS GPS Tracking Platform"
echo "  Production Deployment Script (AWS Lightsail Optimized)"
echo -e "${NC}"

# ── 0. Root Check & Workspace ──────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Please run as root: sudo bash install.sh"

APP_DIR="/opt/gps-platform"
REPO_URL="https://github.com/sushantjagtap5543/college.git"

# ── 1. RAM Optimization (Swap Creation) ───────────────────────────────────────
# Critical for 2GB RAM instances during Vite/Docker builds
if [ ! -f /swapfile ]; then
    info "Creating 2GB Swap File for build stability..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    log "Swap file created and enabled"
else
    log "Swap file already exists"
fi

# ── 2. System Update & Dependencies ───────────────────────────────────────────
info "Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git nginx ufw build-essential
log "Base system ready"

# ── 3. Docker & Docker Compose ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "Installing Docker Engine..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
    log "Docker installed"
else
    log "Docker already installed"
fi

if ! command -v docker-compose &>/dev/null; then
    info "Installing Docker Compose..."
    LATEST_COMPOSE=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${LATEST_COMPOSE}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log "Docker Compose installed"
fi

# ── 4. Firewall Hardening ─────────────────────────────────────────────────────
info "Configuring UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp     # HTTP (Frontend)
ufw allow 443/tcp    # HTTPS
ufw allow 5000/tcp   # GPS Device Port (Main)
ufw allow 5055/udp   # GPS Device Port (UDP)
ufw allow 5023/tcp   # GT06 Protocol
ufw --force enable
log "Firewall hardened"

# ── 5. Repository Setup ───────────────────────────────────────────────────────
if [ -d "$APP_DIR" ]; then
    info "Updating existing codebase..."
    cd "$APP_DIR" && git pull
else
    info "Cloning production codebase to $APP_DIR..."
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ── 6. Environment Hardening ───────────────────────────────────────────────────
if [ ! -f "backend/.env" ]; then
    info "Generating Production Environment..."
    cat > "backend/.env" <<ENVEOF
POSTGRES_USER=gps_admin
POSTGRES_PASSWORD=$(openssl rand -base64 12)
POSTGRES_DB=gps_saas
DB_HOST=db
REDIS_HOST=redis
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
PORT=8080
PORTAL_NAME=GeoSurePath
ADMIN_EMAIL=cadmin@geosurepath.com
ADMIN_PASSWORD=admin@123
GOOGLE_BACKUP_FOLDER_ID=1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8
ENVEOF
    log "Environment generated at $APP_DIR/backend/.env"
fi

# ── 7. Deployment Orchestration ──────────────────────────────────────────────
info "Building and starting production containers..."
# We use build-stage inside Docker to save host memory
docker-compose build --pull
docker-compose up -d --remove-orphans

log "Services started successfully"

# ── 8. Nginx Reverse Proxy (Optimized for WebSockets) ────────────────────────
info "Configuring Nginx Reverse Proxy..."
SERVER_IP=$(curl -s http://checkip.amazonaws.com || echo "3.108.114.12")

cat > /etc/nginx/sites-available/gps-platform <<NGINXEOF
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://localhost:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }

    # Traccar Proxy (if using image)
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
log "Nginx Proxy Active"

# ── 9. Final Summary ──────────────────────────────────────────────────────────
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   GPS Platform Deployment Complete! 🚀                         ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "\nAccess URLs:"
echo -e "  Main Portal: http://${SERVER_IP}"
echo -e "  Admin Login: cadmin@geosurepath.com / admin@123"
echo -e "\nImportant Ports:"
echo -e "  5000 (TCP) -> Main GPS Gateway"
echo -e "  5023 (TCP) -> GT06 Gateway"
echo -e "  5055 (UDP) -> OsmAnd Gateway"
echo -e "\nMemory Info:"
free -h
echo -e "\n${YELLOW}NEXT STEPS:${NC}"
echo -e "1. Edit $APP_DIR/backend/.env with your SMTP/Twilio credentials."
echo -e "2. Install SSL using Certbot: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx"
echo ""
