# GEOSUREPATH - GPS Tracking & Fleet Management Platform

A professional, fully-featured, high-performance SaaS platform for real-time GPS tracking and comprehensive fleet management. Built to handle enterprise-level telemetry with extensive modules including live tracking, historical playback, geofencing, remote immobilization, and automated billing.

## 🚀 Quick Start & Deployment

### Dependencies
Ensure you have the following installed on your server or local machine:
- **Node.js**: v18+ 
- **PostgreSQL**: v13+ (Required for relational data)
- **Redis**: v6+ (Required for high-speed pub/sub and command queues)

### 1. Database Setup
1. Create a PostgreSQL database named `gps_live_tracking`.
2. Run the provided schema file to initialize the tables:
   ```bash
   psql -U postgres -d gps_live_tracking -f database/schema.sql
   ```

### 2. Environment Variables (.env)
Create a `.env` file in the `backend/` directory with the following variables:
```env
PORT=8080
DB_USER=postgres
DB_HOST=localhost
DB_NAME=gps_live_tracking
DB_PASSWORD=your_secure_password
DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_super_secret_jwt_key
```

Create a `.env` file in the `tcp-server/` directory:
```env
TCP_PORT=5023
DB_USER=postgres
DB_HOST=localhost
DB_NAME=gps_live_tracking
DB_PASSWORD=your_secure_password
DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Starting the Services

**A. Start the TCP Server (GPS Hardware Ingestion)**
```bash
cd tcp-server
npm install
npm run start
```
*Listens on port 5023 for incoming device connections.*

**B. Start the Backend API & WebSockets**
```bash
cd backend
npm install
npm run start
```
*Listens on port 8080.*

**C. Start the Frontend Application**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
*Listens on port 5173 (Vite default).*

---

## 🏗 System Architecture

GEOSUREPATH operates on a modern microservices-inspired architecture:

1. **Frontend (React + Vite + Leaflet)**: A highly interactive, dark/light mode SPA with draggable panels and real-time map updates via WebSockets.
2. **Backend (Node.js + Express + Socket.IO)**: Serves REST APIs for authentication, CRUD operations, reporting, and broadcasts live telemetry from Redis to the frontend via WebSockets.
3. **TCP Server (Node.js `net` module)**: Dedicated, lightweight server bridging physical GPS hardware (e.g., GT06 protocol) to the software ecosystem. It parses raw hex streams, inserts permanent records into PostgreSQL, and pushes live states to Redis.
4. **Data Layer**:
   - **PostgreSQL**: Persistent storage for Users, Devices, Geofences, Alerts, and Historical GPS coordinates.
   - **Redis**: Ephemeral, ultra-fast storage for live vehicle states (`live:*`) and the device command queue (`cmd_queue:*`).

---

## 🛠 Feature Highlight: Remote Engine Blocking

To ensure reliable delivery of critical commands (like Engine Cut-Off), the flow is decoupled:
1. Admin triggers "Engine Block" on the frontend.
2. Backend API (`/api/commands/sms`) pushes the raw command (e.g., `RELAY,1#`) into a Redis List (`cmd_queue:{imei}`).
3. The TCP Server continuously monitors the Redis queue. When the target device sends its next heartbeat or location packet, the TCP Server pops the command and dispatches it directly over the active socket connection to the GPS hardware.

---

## 🛡️ Backup System
A Linux bash script is included (`geosurepath_backup.sh`) for automated database snapshots. It uses `pg_dump` and `rclone` to securely upload encrypted, compressed backups to Google Drive.

Usage:
```bash
chmod +x geosurepath_backup.sh
./geosurepath_backup.sh
```
*We recommend setting up a daily CRON job for this script.*
