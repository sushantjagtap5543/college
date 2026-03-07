# Live GPS SaaS Platform API Contract

Base URL: `/api/v1`
Authentication: JWT Bearer Token

## 1. Authentication Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| POST | `/auth/login` | User login | No | Returns JWT and Role |
| POST | `/auth/otp/send` | Request OTP for sensitive actions | Yes | Returns OTP reference |
| POST | `/auth/otp/verify` | Verify OTP for actions | Yes | E.g. IGNITION_OFF |

## 2. Admin Only Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| POST | `/admin/clients` | Create new client account | Yes (Super Admin) | |
| GET | `/admin/clients` | List all clients | Yes (Super Admin) | |
| GET | `/admin/system/health` | Current connected TCP, RAM, DB | Yes (Super Admin) | |
| POST | `/admin/devices` | Register a new device IMEI | Yes (Super Admin) | |
| PUT | `/admin/devices/:id/assign` | Assign device to a Client | Yes (Super Admin) | |

## 3. Vehicle & Device Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| GET | `/vehicles` | Get all assigned vehicles | Yes (Client/Admin) | |
| POST | `/vehicles` | Add new vehicle record | Yes (Client) | Binds to unassigned Device |
| GET | `/devices/:id/status` | Get live status & latest coords | Yes | |

## 4. History & Tracking Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| GET | `/tracking/history/:device_id` | Get coordinate trail for date range | Yes | Filters by timestamp |
| GET | `/tracking/trips/:device_id` | Auto-segmented trips for a day | Yes | |
| GET | `/tracking/route-replay/:device_id`| Stream points for UI playback | Yes | |

## 5. Geofence & Routefence Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| POST | `/geofences` | Create new polygon/circle | Yes (Client) | Uses PostGIS geom |
| GET | `/geofences` | Get client's geofences | Yes (Client) | |
| POST | `/routefences` | Define a new route trace corridor | Yes (Client) | |

## 6. Alerts & Notifications Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| POST | `/alerts/rules` | Create a new alert rule | Yes (Client) | e.g. Speed > 80 |
| GET | `/alerts` | Get latest alerts timeline | Yes (Client) | |
| PUT | `/alerts/:id/read` | Mark alert as read | Yes (Client) | |

## 7. Command Execution Endpoints
| HTTP Method | Endpoint | Description | Auth Required | Note |
|---|---|---|---|---|
| POST | `/commands/send` | Dispatch command to device | Yes | Payload: `{"device_id": UUID, "command": "IGNITION_OFF", "otp": "1234"}` |
| GET | `/commands/logs/:device_id` | Get command history & ACK status | Yes | |
