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
- Note: Use "Force Admin Login" from the main login screen to bypass email/password for testing.

**Client Access:**
- Role: Client (Asset Owner)
- Function: Live tracking, history playback, localized geofence creation, receiving alerts.
- Creation: Clients register via the `/register` endpoint (Start by clicking "Create an Account"). Registration requires a mock SMS OTP verification.

## Deployment Ports

Ensure the following ports are open and services are actively running:
- **Frontend (React/Vite):** `http://localhost:5173`
- **Backend API (Node.js):** `http://localhost:8080` (or as configured in `.env`)
- **Traccar Core Server:** `http://localhost:8082` (Backend telemetry ingestion)
- **PostgreSQL Database:** `5432`

## Operational Workflows

### 1. Client Registration & Onboarding
1. Navigate to the main Login page and click **Create an Account**.
2. Enter personal credentials and exact Indian Vehicle Registration Plates (e.g. MH 12 AB 1234).
3. Connect a specific GPS tracking unit by its 15-digit Hardware UUID (IMEI).
4. Initiate the Mobile Verification sequence (Use Mock OTP: `1234`).
5. Account is created. Wait for Administrator to activate the subscription if blocked.

### 2. Device Management & Billing (Admin)
1. Log in via "Force Admin Login".
2. Navigate to the **Accounts (Clients)** tab.
3. Review connected IoT devices and their Live Ecosystem Status.
4. **Extend Subscription:** Click the `+365 Days` button next to an account to rapidly add a year of subscription time to the client's profile.
5. **Data Pruning:** The system will automatically safely archive data older than 180 days to Google Drive every night at 1 AM.

### 3. Live Tracking & Geofencing (Client)
1. Log into your Client account.
2. The Live Map auto-updates every 10 seconds via WebSocket tracking.
3. Use the **Draw Shape** utility on the map to define custom geofences or route fences. Alerts trigger when connected IoT hardware breaches these borders.

### 4. History Playback (Client)
1. Open the Map View and click on a targeted Vehicle.
2. Define a strict search parameter using the Calendar Date Pickers (e.g. `2024-03-01 00:00` to `2024-03-01 23:59`).
3. The platform will reconstruct the exact path via polyline routing and dynamically update Vehicle Map Markers to display **Ignition State (ON/OFF)**.

### 5. Forgot Password Recovery
1. Use the "Forgot Password?" prompt on the Login view.
2. Enter registered email address to receive a secure Mock OTP (Default: `1234`).
3. Supply a new secure password. The system updates the encrypted hash as well as the readable text cache matrix.

## Troubleshooting
- **WebSocket Disconnection:** If live tracking is frozen, ensure Port 8080 allows socket upgrades.
- **Hardware UUID Registration Errors:** UUIDs must be strictly 15 integers.
- **Missing Telemetry in Playback:** Data older than 180 days is physically relocated to Google Drive, ensuring primary PostgreSQL clusters remain rapid for sub-6-month queries.

*GeoSurePath - Master the Grid.*
