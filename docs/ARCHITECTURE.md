# Live GPS Platform Architecture

## 1. TCP/UDP GPS Ingestion Server
**Goal**: Handle high-throughput connections, parse protocol hex streams, and dispatch data.

### Workflow:
1. TCP Socket listens on Port (e.g., `5000` for GT06).
2. Device connects and sends Login Packet. Server verifies IMEI and responds ACK.
3. Device sends Location Packets. Server parses Latitude, Longitude, Heading, Speed.
4. Server updates Redis `live_devices` hash.
5. Server flushes data to PostgreSQL `gps_live_data` (UPSERT).
6. Server pushes data onto an internal MQ or saves directly to PostgreSQL `gps_history` in batches.
7. Server emits `device_update` to the WebSocket gateway to push directly to active users.

## 2. Command Engine Design
**Goal**: Abstract the messy hardware protocols. Let UI say "IGNITION_OFF".

### Workflow:
1. UI calls `POST /commands/send { command: "IGNITION_OFF" }`. Backend validates OTP.
2. Backend checks DB `device_command_map` for the specific model's syntax (e.g. `RELAY,1#`).
3. Backend checks vehicle speed (Safety Rule: Speed must be < 5km/h for ignition cutoff).
4. Backend pushes to Redis list: `cmd_queue:{imei}`.
5. TCP Server reads queue when device sends heartbeats, then dispatches hex command.
6. DB `command_logs` marked `PENDING`. On device ACK, marked `ACK`.

## 3. Alert & Notification Engine
**Goal**: Detect situations live as coordinates ingest.

### Workflow:
1. Dedicated worker process "Alert Engine" subscribes to live GPS ingest stream.
2. It fetches cached rules for the device (Overspeed > 80kmh, Geofence XYZ IN/OUT).
3. If Overspeed Rule tripped: It checks Redis "cooldown" key. If not cooling down, triggers Alert.
4. Saves Alert to DB `alerts` table.
5. Pushes JSON via WebSocket to Web Dashboard.
6. Pushes to FCM (Firebase Cloud Messaging) for Android App Push.

## 4. WebSocket Streaming
**Goal**: Real-time map updates (No Need to Refresh).

1. Client connects via Web UI to `wss://api.domain.com/ws`.
2. Authenticates via JWT in WS handshake.
3. Subscribes to rooms: `room_client_{client_id}`.
4. Core backend broadcasts latest coordinates to `room_client_{client_id}`.
5. Map updates Smooth Marker position via interpolation over the last heading direction.
