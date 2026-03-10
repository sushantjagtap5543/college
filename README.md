# 🛰 GeoSurePath — Enterprise GPS SaaS Platform
> Strategic Asset Oversight Powered by Real-time Intelligence

[![GitHub](https://img.shields.io/badge/GitHub-sushantjagtap5543%2Fcollege-blue)](https://github.com/sushantjagtap5543/college)

---

## 🌐 Live Deployment

| Service | URL |
|:---|:---|
| **Portal (Frontend)** | `http://3.108.114.12` |
| **Backend API** | `http://3.108.114.12/api` |
| **Traccar Engine** | `http://3.108.114.12:8082` |

---

## 🔐 Default Credentials

### Platform Portal
| Role | Email | Password | Access Level |
|:---|:---|:---|:---|
| **Admin** | `admin@geosurepath.com` | `admin@123` | Full system control |
| **Demo Client** | Register at `/register` | Set by user | Fleet dashboard only |

### Traccar Engine
| Field | Value |
|:---|:---|
| URL | `http://3.108.114.12:8082` |
| Username | `admin` |
| Password | `admin` |

### Database (PostgreSQL)
| Field | Value |
|:---|:---|
| Host | `localhost` (inside Docker) |
| Database | `gps_saas` |
| Username | `gps_admin` |
| Password | `gps_strong_password` |
| Port | `5432` |

---

## 🔌 Server Ports Reference

| Port | Protocol | Purpose |
|:---|:---|:---|
| `80` | TCP | HTTP — Main Portal Frontend |
| `443` | TCP | HTTPS — SSL (when configured) |
| `8080` | TCP | Backend API Server |
| `8082` | TCP | Traccar Web UI & REST API |
| `5000` | TCP | GPS Device Ingestion (Primary) |
| `5023` | TCP | GT06 / Concox / WEtrack / JimiIoT |
| `5002` | TCP | TK103 / Coban Devices |
| `5055` | UDP | OsmAnd Protocol (Mobile tracking) |

---

## 📡 GPS Device Binding — How to Connect IMEI `869727079043558`

To connect your physical GPS tracker to the server, send SMS commands to the SIM inside the device:

### For GT06 / Concox / JimiIoT (Port **5023**)
```
SERVER,0,3.108.114.12,5023,0#
APN,<your_sim_apn>#
TIMER,10,60#
```

### For TK103 / Coban (Port **5002**)
```
adminip123456 3.108.114.12 5002
apn123456 <your_sim_apn>
```

### Common APNs (India)
| Operator | APN |
|:---|:---|
| Jio | `jionet` |
| Airtel | `airtelgprs.com` |
| Vi (Vodafone) | `portalnmms` |
| BSNL | `bsnlnet` |

> **Tip:** After sending APN command, restart the device. Within 60 seconds it should appear on the map.

---

## 🗺 Role-Wise Feature Guide

### 👑 Admin Role
| Feature | Where to Find | Description |
|:---|:---|:---|
| Overview KPIs | Dashboard tab | Total clients, hardware, live streams |
| New Hardware Alert | Dashboard banner | Auto-detects unregistered IMEIs |
| Client Management | Customers tab | Add/block/update client accounts |
| Subscription Control | Customers → Edit | Set plan expiry dates |
| Hardware Stock | Stock tab | Add IMEIs, protocols, SIM numbers |
| Asset Provisioning | Stock → Assign | Link IMEI → Vehicle → Client |
| GPRS Command Templates | Device Setup tab | Add/edit ignition commands per protocol |
| Remote Commands | Remote Cmds tab | Send live ignition ON/OFF to vehicles |
| Payments/Revenue | Payments tab | Monthly billing & revenue reports |
| Live Alert Feed | Live Alerts tab | Real-time overspeed & geofence events |
| System Health | System Health tab | Server uptime, DB, Redis status |
| Backup | Maintenance tab | Trigger Google Drive backup |

### 🚗 Client (Fleet Owner) Role
| Feature | Where to Find | Description |
|:---|:---|:---|
| Live Map | Dashboard → Spectrum View | Real-time vehicle positions |
| Vehicle List | Left sidebar | Status: Moving / Idle / Stopped |
| Trip Reports | Reports section | Per-vehicle trip history |
| Stops Report | Reports section | Idle/parking locations |
| Geofence Drawing | Map → Draw Zone | Create alert zones |
| Speed Alerts | Alerts → Create Rule | Overspeed notifications |
| Engine ON/OFF | Vehicle panel button | Remote ignition with PIN security |
| History Playback | Vehicle → Timeline | Replay route history on map |
| Notifications | Bell icon (top bar) | Real-time alerts feed |

---

## 🚀 Deployment Guide (AWS Lightsail)

### Quick Deploy (Automated)
```bash
# 1. SSH into your Lightsail instance
ssh ubuntu@3.108.114.12

# 2. Clone the repository
git clone https://github.com/sushantjagtap5543/college.git /opt/gps-platform
cd /opt/gps-platform

# 3. Run the master install script
sudo bash install.sh
```

### Manual Update (After Code Push)
```bash
cd /opt/gps-platform
git pull origin main
docker-compose build --pull
docker-compose up -d --remove-orphans
```

---

## 💻 Local Development Setup

### Prerequisites
- Docker Desktop (running)
- Node.js 18+
- Git

### Steps
```bash
# 1. Clone the repo
git clone https://github.com/sushantjagtap5543/college.git
cd college

# 2. Start all services via Docker
docker-compose up -d

# 3. Load database schema (first time only)
docker exec -i gps_postgres psql -U gps_admin -d gps_saas < database/schema.sql

# 4. Run Frontend (dev mode)
cd frontend
npm install
npm run dev  # Opens at http://localhost:3000

# 5. Run Backend (dev mode, separate terminal)
cd backend
npm install
npm run dev  # Runs at http://localhost:8080
```

---

## 🏗 System Architecture

```
Browser / Mobile App
        │
        ▼
   Nginx (port 80)
   ┌────┴───────────┐
   │                │
   ▼                ▼
Frontend        Backend API
(React/Vite)   (Node.js:8080)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   PostgreSQL     Redis       Traccar
   (gps_saas)  (pub/sub)   (port:8082)
                                │
                        GPS TCP Server
                        (port 5000/5023)
                                │
                        Physical GPS Devices
                        (GT06, TK103, etc.)
```

---

## 📦 Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18, Vite, Leaflet, Framer Motion, Recharts |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL 15 + PostGIS |
| Cache/PubSub | Redis 7 |
| GPS Engine | Traccar (self-hosted) |
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Deployment | AWS Lightsail (Ubuntu 22.04) |

---

## 📋 Firewall Ports to Open (AWS Lightsail)

Go to **Lightsail → Instance → Networking → IPv4 Firewall** and add:

| Port | Type |
|:---|:---|
| 80 | TCP |
| 443 | TCP |
| 8082 | TCP |
| 5000 | TCP |
| 5023 | TCP |
| 5002 | TCP |
| 5055 | UDP |

---

## 🩺 Common Issues & Solutions

| Issue | Likely Cause | Fix |
|:---|:---|:---|
| Map not loading | Missing IMEI in DB | Add IMEI via Admin → Stock |
| Device not updating | Wrong APN or server IP | Re-send SERVER command via SMS |
| Login fails | Wrong credentials | Use `admin@geosurepath.com / admin@123` |
| No live data | Redis/Backend down | Run `docker-compose ps` to check |
| Engine command fails | Device offline | Ensure device is connected (check TCP logs) |

---

*GeoSurePath — Strategic Asset Oversight Intelligence · v3.0*
