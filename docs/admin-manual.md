# GeoSurePath GPS Tracking Portal — Admin Manual

## Admin Login
- **URL:** `http://your-server:3000`
- **Email:** `admin@geosurepath.com`
- **Password:** `admin@123`

---

## Admin Dashboard — 7 Tabs

### 1. Overview
Real-time KPIs at a glance:
- Total Clients, Total Devices, Unassigned Devices, Live Moving Vehicles
- Mini live fleet map (click "Full Map" to open full screen)
- Fleet status summary: Moving / Idle / Stopped

### 2. Business Reports
Revenue and billing insights:
- Estimated MRR and ARR based on vehicle counts per client
- Monthly new client registration bar chart
- **Billing Reference Table** — shows each client's registration date + one year as indicative next billing date
  - Days left indicator: Green (>30 days), Amber (<30 days), Red (Overdue)
- Note: Billing is reference-only. No payment data is stored.

### 3. Alerts Log
All system alerts in one filterable table:
- Filter by alert type (GEOFENCE, SPEED, etc.)
- Shows: Timestamp, IMEI, Vehicle Name, Plate Number, Alert Message
- Search also works by pressing Enter

### 4. System Health
Server and infrastructure metrics:
- Server uptime, memory usage, Redis status, DB size, Node.js version
- Last backup timestamp
- Database record counts (clients, devices, vehicles, alerts, geofences)
- Link to Google Drive archive folder

### 5. Backup (Cloud)
Data retention and archival:
- **Policy:** Server keeps 3 months of GPS telemetry
- Older data is automatically archived to Google Drive daily at 1:00 AM
- **Trigger Manual Backup:** Click "Trigger Manual Backup" to run immediately
- Shows last backup time and Drive link
- **Drive Folder:** [GPS Backup on Google Drive](https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8)
- SMS Command Dispatch panel also lives here (send commands to GPS device SIMs)

### 6. Clients
Full client account management:
- View all clients with vehicle count, plain password (for sharing), registration date, next billing, and active/blocked status
- **Block/Unblock** any client account instantly
- **Assign Device:** Link a free IMEI from inventory to a client account with plate number

### 7. Devices (Inventory)
GPS device hardware management:
- Full IMEI inventory with assignment status (FREE / ASSIGNED) and date added
- **Add Device:** Enter IMEI (and optional SIM number) to add to inventory
- Once added, device can be assigned to a client from the Clients tab

---

## SMS Commands (Device Control)
Use the SMS Dispatch panel (Backup tab) to send relay commands:
| Command       | Effect                    |
|---------------|---------------------------|
| `RELAY,1#`    | Cut engine (Ignition OFF) |
| `RELAY,0#`    | Restore engine (Ignition ON) |
| Custom CMD    | Any device-supported command |

PIN confirmation is required at device level before ignition commands are accepted.

---

## Data Backup Access
To read older GPS data archived to Google Drive:
1. Open the Drive folder link from the Backup tab
2. Each file is a JSON export of GPS telemetry
3. Files are named by date range and IMEI prefix

---

## Key Backend APIs
| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/system-health` | GET | Server statistics |
| `/api/admin/backup/status` | GET | Last backup info |
| `/api/admin/backup/trigger` | POST | Trigger manual backup |
| `/api/admin/revenue` | GET | Revenue/billing stats |
| `/api/admin/alerts/all` | GET | All alerts (filterable) |
| `/api/admin/clients` | GET | All clients |
| `/api/admin/inventory` | GET | Device inventory |
| `/api/admin/inventory` | POST | Add device |
| `/api/admin/assign-device` | POST | Assign to client |
| `/api/admin/toggle-block/:id` | POST | Block/unblock client |
