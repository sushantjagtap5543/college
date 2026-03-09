# GeoSurePath GPS Platform — Complete Feature List

## 🗺️ Live Tracking
| Feature | Details |
|---|---|
| Real-time GPS position | Updates every 1–5 seconds via WebSocket |
| Heading-aware vehicle icons | SVG icon rotates to match vehicle direction |
| Multi-vehicle types | Car, Truck, Bus, Bike, JCB, Auto, Van — custom per fleet |
| Cluster mode | Auto-groups nearby vehicles at low zoom |
| Vehicle details popup | Speed, status, plate, IMEI, last update on click |
| Dark map theme | Carto dark base tiles |
| Admin live overview map | Mini map in Overview tab showing entire fleet |

## 📊 Dashboard (Client)
| Feature | Details |
|---|---|
| 8 KPI widgets | Distance, Trips, Driving Duration, Idle, Stop, Inactive, Avg/Max Speed |
| Fleet status cards | Live/Moving/Idle/Stopped/Offline counts |
| Live map preview | Mini iframe-style map, click to open full screen |
| Renewal reminders | Insurance, PUC, License document expiry alerts |
| Fleet idling chart | Bar chart: Weekly/Monthly/6-Month utilisation |

## 📍 History / Trip Replay
| Feature | Details |
|---|---|
| Date range selector | Pick from-to datetime |
| Animated route playback | Animated marker follows historical path |
| Speed-based status coloring | Green (moving), Amber (idle), Red (stop) |
| Playback speed control | 1x / 2x / 4x |
| Trip detail table | Per-point: timestamp, speed, lat/lng |
| Cloud archive fallback | Routes older than 3 months served from Google Drive |

## 🚧 Geofence Management
| Feature | Details |
|---|---|
| Draw polygon zones | Click-drag on map |
| Named geofences | Save with label |
| Geofence enter/exit alerts | Real-time via WebSocket |
| Alert recorded in DB | Stored per IMEI in `alerts` table |
| Admin visibility | Admin sees all geofence alerts in Alerts tab |

## 🚨 Alerts & Notifications
| Alert Type | Trigger |
|---|---|
| **Overspeed** | Vehicle exceeds per-vehicle configured speed limit (default: 80 km/h) |
| **Geofence Enter** | Vehicle enters a defined zone |
| **Geofence Exit** | Vehicle exits a defined zone |
| **Ignition ON/OFF** | Device-reported ignition state change |
| **Low Battery** | Device reports battery below threshold |
| **Tamper Alert** | Device-level tamper detection |
| **Route Deviation** | Vehicle leaves expected route |

Alert cooldown: 5 minutes per vehicle per alert type (overspeed).  
Alerts broadcast via **Socket.IO** to client and admin in real-time.  
Alerts stored in PostgreSQL `alerts` table.

## 🏎️ Speed Limit Control (New)
| Feature | Details |
|---|---|
| Per-vehicle speed limit | Each vehicle has its own configurable limit |
| Default limit | **80 km/h** |
| Client can set limit | Via vehicle settings or SMS command |
| Admin can override | Admin → Vehicles & Speed tab → Edit Limit inline |
| Overspeed alert | Fires if vehicle exceeds configured limit |
| Alert cooldown | 5 minutes per vehicle to prevent spam |
| Range | 10 km/h — 300 km/h |

## 🖥️ Admin Control Panel — 8 Tabs

### 1. Overview
- KPI cards: Total Clients, Total Devices, Unassigned, Live Moving
- Mini live fleet map with cluster markers
- Fleet status breakdown: Moving / Idle / Stopped

### 2. Business Reports
- MRR (Monthly Recurring Revenue) estimate
- ARR (Annual Recurring Revenue) estimate
- Monthly new client registration bar chart (with data labels)
- Client billing reference table:
  - Registration date → +1 year = indicative billing due
  - Days-left badge: Green (>30d), Amber (<30d), Red (Overdue)

### 3. Alerts Log
- Full paginated table of all system alerts
- Filter by type: GEOFENCE, SPEED, OVERSPEED, etc.
- Columns: Timestamp, IMEI, Vehicle Name, Plate, Alert Message

### 4. System Health
- Server uptime, memory usage (MB)
- Redis connection status
- PostgreSQL database size
- DB record counts: clients, devices, vehicles, alerts, telemetry
- Node.js version
- Last backup timestamp
- Google Drive archive folder link

### 5. Backup (Cloud)
- Current retention policy (3 months on server)
- Last backup date/time
- Manual backup trigger → archives to Google Drive
- Auto backup: Daily at 1:00 AM (cron job)
- Drive folder: https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8
- Server retains only 3 backups; older data moves to Drive

### 6. Clients
- Full client table: name, email, vehicle count, password, registration date
- Indicative next billing date (reg + 1 year)
- Account status: ACTIVE / BLOCKED badge
- **Block / Unblock** any client account
- **Assign Device**: Link free IMEI from inventory to client with plate number

### 7. Vehicles & Speed Limits *(New)*
- All active vehicles across all clients
- Per-vehicle speed limit (editable inline by clicking value)
- Admin can override any vehicle's speed limit
- Saves immediately via API

### 8. Devices (Inventory)
- Full IMEI inventory table: IMEI, SIM, assignment status, date added
- FREE / ASSIGNED badge per device
- **Add Device**: Enter IMEI (+ optional SIM) to add to inventory

## 📡 SMS Commands & Device Control
| Command | Effect |
|---|---|
| `RELAY,1#` | Cut ignition (engine off) |
| `RELAY,0#` | Restore ignition (engine on) |
| Any custom string | Dispatched via Twilio to device SIM |
| Admin dispatch panel | In Backup tab — admin mobile, target SIM, command string |
| Safety block | Demo accounts cannot trigger real hardware commands |

## ⚙️ Settings (Client)
| Feature | Details |
|---|---|
| Profile update | Name, email |
| Password reset | Current + new password required |
| Appearance | Light/Dark mode toggle |
| Security | Session info, logout from all devices |
| Audit log | History of account actions |

## 🔐 Authentication & Security
| Feature | Details |
|---|---|
| bcrypt password hashing | Salt rounds = 10 |
| Role-based access | ADMIN vs CLIENT routes |
| Account blocking | Admin can block any client (login denied) |
| Demo access | Guest session with limited features |
| Forgot password | Generates temp password + sends via SMTP |

## 📦 Device & Fleet Management (Client)
| Feature | Details |
|---|---|
| Add new vehicle | IMEI + name + plate number |
| Remove vehicle | Soft-delete (is_active = false) |
| Custom SVG icons | Replace SVG in `/vehicleTypes/` folder to update everywhere |
| Multi-vehicle | Unlimited vehicles per account |

## ☁️ Data & Backup
| Feature | Details |
|---|---|
| Server data retention | 3 months of GPS telemetry |
| Auto-archive | Daily 1:00 AM → Google Drive JSON export |
| Manual backup | Admin → Backup → Trigger Manual Backup |
| History API | Transparent: fetches from DB if <3m, from Drive if older |
| Drive folder | https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8 |

## 🌐 Backend APIs Summary
| Endpoint | Method | Description |
|---|---|---|
| `/api/login` | POST | Authenticate user |
| `/api/register` | POST | Register new client with vehicles |
| `/api/fleet` | GET | Live fleet positions (Redis-backed) |
| `/api/vehicles` | GET | All client vehicles with speed limits |
| `/api/vehicles/:id/speed-limit` | PATCH | Client: update speed limit |
| `/api/alerts` | GET | Client alerts |
| `/api/geofences` | GET/POST | Fetch/save geofences |
| `/api/history` | GET | GPS telemetry history / Drive fallback |
| `/api/commands/sms` | POST | Send device command |
| `/api/admin/clients` | GET | All clients |
| `/api/admin/clients/toggle-block` | POST | Block/unblock client |
| `/api/admin/vehicles` | GET | All vehicles with speed limits |
| `/api/admin/vehicles/:id/speed-limit` | PATCH | Admin: override speed limit |
| `/api/admin/system-health` | GET | Server metrics |
| `/api/admin/backup/status` | GET | Backup info |
| `/api/admin/backup/trigger` | POST | Manual backup to Drive |
| `/api/admin/revenue` | GET | Revenue/billing statistics |
| `/api/admin/alerts/all` | GET | All alerts across all clients |
| `/api/inventory` | POST | Add device to inventory |
| `/api/admin/devices/assign` | POST | Assign device to client |
