# GeoSurePath - GPS Tracking Platform

A comprehensive enterprise-grade platform for real-time asset intelligence, providing zero-latency vehicle tracking, robust telemetry data management, and secure administrative controls.

## System Architecture

The GeoSurePath platform consists of:
- **Frontend Dashboard:** A high-performance React application utilizing TailwindCSS for styling and Leaflet for geospatial visualization.
- **Backend API:** An Express/Node.js service for command queuing, device management, billing controls, and history curation.
- **Database:** PostgreSQL handling primary relationships (clients, devices, commands), postGIS geofencing data, and long-term telemetry storage.

## Authentication & Credentials

**Administrator Access:**
- Role: Platform Admin
- Function: Fleet provisioning, global oversight, billing management.
- URL: `http://3.108.114.12`
- Email: `admin@geosurepath.com`
- Password: `admin@123`

**Traccar Admin Access (Telemetry Core):**
- URL: `http://3.108.114.12:8082`
- Admin User: `admin`
- Admin Pass: `admin`

**Client Test Registration:**
- Demo IMEI for testing: `869727079043558` (Pre-registered in both Traccar and Platform)
- Client Login: Register a new account or use existing `user@example.com` (if seeded).
- Mock OTP: `1234`

## Production Deployment Info (AWS Lightsail)

- **Static IP:** `3.108.114.12`
- **Location:** AWS Mumbai (ap-south-1)
- **Deployment Mode:** Dockerized Multi-Service Architecture
- **Infrastructure:** Ubuntu 22.04 LTS, 2GB RAM, 2GB Swap enabled.

### GPS Device Communications
- **Target IP:** `3.108.114.12`
- **Port (GT06/Concox):** `5023`
- **Port (Protocols):** `5000` (Main), `5055` (UDP)

## Operational Workflows

### 1. New Client Registration
1. Access `http://3.108.114.12` -> Register.
2. Use Mock OTP `1234` for mobile verification.
3. Add Device `869727079043558` to your fleet.

### 2. Live Tracking
- Live tracking auto-refreshes via WebSocket on port `8080`.
- Dark/Light mode is fully synchronized with system settings.

### 3. Data Pruning & Backups
- GPS data is retained on-server for **180 days**.
- Nightly backups transfer data to the configured Google Drive folder.
- Non-GPS data is NOT pruned (only location telemetry).

## Maintenance
To clean and redeploy:
```bash
cd /opt/geosurepath
sudo git pull origin main
sudo bash install.sh
```

---
*GeoSurePath - Strategic Asset Oversight.*
