# GeoSurePath — Enterprise User Manual

This manual provides a detailed walkthrough of the GeoSurePath GPS SaaS platform, organized by user roles and core features.

---

## 🔐 1. Access Credentials (Default)

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@geosurepath.com` | `admin@123` | Master infrastructure control |
| **Client (Demo)** | `client@demo.com` | `client123` | Fleet owner interface |

---

## 🛠 2. Admin Portal: Infrastructure Command
The Admin Portal is the "Nerve Center" for the enterprise. Access via: `http://<SERVER_IP>/admin`

### 📦 Inventory & Stock Management
*   **Hardware Mesh**: View all devices in the central warehouse.
*   **Authorize Node**: Register new IMEIs with their protocol (GT06, TK103, etc.).
*   **Newborn Detection**: If a device is powered on and connects to the server, a **Red Alert Banner** will notify you instantly to register the "Unlinked Hardware."

### 👥 Client & Ecosystem Control
*   **Client Management**: Create, edit, and block client accounts.
*   **Subscription Engine**: Manage expiry dates and billing status for প্রতিটি client.
*   **Asset Provisioning**: Link an IMEI from stock to a specific Client, assign a **Vehicle Number**, and a **Driver Name**.

### ⚡ GPRS Command Matrix
*   **Protocol Mapping**: Map specific hex/string commands (like `RELAY,1#`) to universal actions like `Engine Stop`.
*   **Live Queue**: View the status of command delivery from the log panel.

---

## 🛰 3. Client Portal: Fleet Intelligence
The Client Portal allows real-time operational oversight. Access via: `http://<SERVER_IP>/dashboard`

### 🗺 Real-time Operations (Spectrum View)
*   **Live Tracking**: High-fidelity map showing real-time location, speed, and status (Moving, Idle, Stopped).
*   **Engine Control**: Secure "Engine Cut" and "Restore" buttons protected by a **4-digit PIN**.
*   **Breadcrumb Trail**: View the current trip's path live on the map.

### 📊 Analytical Reports
*   **Trips Report**: Detailed breakdown of every start/stop location with duration and distance.
*   **Stops Report**: List of all points where the vehicle was stationary.
*   **Summary**: Daily/Weekly mileage and fuel consumption estimates.

### 🔔 Autonomous Alerting
*   **Geofencing**: Draw virtual zones (Zones of Interest). Get notified on entry/exit.
*   **Overspeed Alerts**: Set thresholds and receive browser notifications when exceeded.
*   **Ignition Alerts**: Be notified immediately if the vehicle is started/stopped.

---

## 📡 4. GPS Device Integration (Binding Commands)
To bind your physical GPS device to this server (`3.108.114.12`), send the following SMS commands to the SIM card inside the device:

### For GT06 / Concox / WEtrack (Port 5023)
1. **Point to Server**: `SERVER,0,3.108.114.12,5023,0#`
2. **Set APN**: `APN,<your_sim_apn>#`
3. **Set Interval**: `TIMER,10,60#` (10s when moving, 60s when parked)

### For TK103 / Coban (Port 5002)
1. **Admin Set**: `admin123456 <your_phone_number>`
2. **Point to Server**: `adminip123456 3.108.114.12 5002`
3. **Set APN**: `apn123456 <your_sim_apn>`

---

## 🔧 5. Troubleshooting & Maintenance
*   **System Health**: Admins can monitor Server Uptime and DB Health from the "Maintenance" tab.
*   **Automated Backups**: Downloads your entire fleet data to Google Drive daily.
*   **Socket Heartbeat**: The small green pulse in the dashboard indicates a live connection to the tracking stream.

---
*GeoSurePath - Strategic Asset Oversight Intelligence.*
