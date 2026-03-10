# GeoSurePath - GPS Tracking Platform
Strategic Asset Oversight Powered by Traccar Intelligence.

GeoSurePath is a premium, enterprise-grade GPS SaaS platform designed to offer high-fidelity asset intelligence. The system is rebuilt to serve as a unified, high-performance interface for the Traccar engine, featuring real-time tracking, analytical reporting, and autonomous alerting.

## 🛠 Unified Architecture

The platform follows a three-tier "Forward & Proxy" architecture:
- **Frontend (React):** A premium geospatial dashboard. All data is proxied through our backend—no direct Traccar calls, ensuring security and CORS compliance.
- **Backend (Node.js):** The "Intelligence Hub". It handles authentication, provisions users in Traccar, proxies analytical reports (Trips/Stops), and receives real-time event webhooks.
- **TCP Server:** A high-performance ingestion engine that processes incoming GPS device data (Concox/GT06) and forwards it directly to Traccar for analytical parity.

## 🔗 Traccar Integration Details

### Proxy Layer
All analytical engine features are proxied securely:
- **Reports:** [Trips, Stops, Summary] fetched from Traccar and normalized for the portal.
- **Geofences:** Real-time drafting and syncing between the map and the Traccar engine.
- **Commands:** Proxy for GPRS commands (Immobilization, Sound siren) to the devices.

### Auto-Provisioning
Registering a new account in GeoSurePath automatically:
1. Creates a local account for metadata and billing.
2. Provisions a corresponding User in the Traccar engine.
3. Maps entered Device IMEIs to Traccar devices and links them to the user.

## 🚦 Setup & Verification

### 1. Requirements
- **PostgreSQL 14+** (with PostGIS extension)
- **Redis 6+** (for live pub/sub state)
- **Traccar Engine** (accessible on localhost:8082 or via .env)

### 2. Quick Start
1. **Database:** Import `database/schema.sql` to your Postgres instance.
2. **Backend:** Configure `backend/.env` and run `npm start`.
3. **TCP Server:** Configure `tcp-server/.env` and run `npm start`.
4. **Frontend:** Run `npm run dev` or build for production (`dist/`).

### 3. Production Deployment (AWS/Ubuntu)
- A production-ready `nginx.conf.example` is provided in the `docs/` folder.
- Use `install.sh` for automated setup on Lightsail/EC2.

## 🔐 Credentials (Local Default)
- **Platform Admin:** `admin@geosurepath.com` / `admin@123`
- **Traccar Admin:** `admin` / `admin` (Base URL: `http://localhost:8082`)

---
*GeoSurePath - Strategic Asset Oversight.*
