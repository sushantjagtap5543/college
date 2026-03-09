# GeoSurePath GPS Tracking Portal — Client User Manual

## Logging In
1. Open the portal URL in any browser
2. Enter your Email and Password (provided by admin)
3. Click **Login**

> If you forget your password, contact your administrator — they can see your credentials in the admin panel.

---

## Dashboard
After login, you land on your personal dashboard:

### Top KPI Widgets
8 cards showing your fleet summary:
- Travel Distance, Trips, Driving Duration, Idle Duration, Stop Duration, Inactive Duration
- Live/Running/Stopped/Offline vehicle counts

### Live Map Overview
- Miniature live map showing all your vehicles
- Click **Open Full Map →** to open the full live tracking screen

### Renewal Reminders
- Summary of upcoming document renewals (Insurance, PUC, License, etc.)

### Fleet Idling / Utilisation Charts
- Bar charts showing fleet utilisation trends by week/month/6 months

---

## My Fleet Management
At the bottom of the dashboard, manage your vehicles:

### Add a New Vehicle
1. Click **Add New Vehicle**
2. Enter: Device IMEI, Vehicle Name, Plate Number
3. Click **Register Vehicle**
4. Your vehicle will appear on the map once the GPS device is active

### Remove a Vehicle
- Click **Remove** next to any vehicle in the list

---

## Live Map (Full Screen)
Navigate via the sidebar: **Live Map**
- All your vehicles shown on a dark map
- Hover/click a vehicle marker to see details (speed, status, last update)
- Vehicle icons rotate to match heading direction
- Multiple vehicle types supported: Car, Truck, Bus, Bike, JCB, etc.

---

## History / Trip Replay
- Navigate to **History** in the sidebar
- Select vehicle and date range
- See the exact route traveled with timestamps and stop points

---

## Geofences
Navigate to **Geofences**:
- **Draw a Zone:** Click-drag on map to define a geofence area
- Receive alerts when a vehicle enters or exits the zone
- Alert log shows geofence breach time, vehicle, and location

---

## Alerts
Navigate to **Alerts** in the sidebar:
- See all alerts for your vehicles: Geofence, Speed, Ignition events
- Alerts are color-coded by severity

---

## Settings
- Update your profile name and password
- Choose theme (Light/Dark mode)
- View audit log of your account actions

---

## Vehicle Icon Customization
Your portal supports hundreds of custom vehicle icons:
- Icons are stored in `/frontend/public/vehicleTypes/`
- The file name format: `<type>-<color>.svg` (e.g., `car-blue.svg`)
- To replace any icon, overwrite the SVG file — changes reflect everywhere automatically
- Contact your admin to update the icon set

---

## Getting Help
Contact your system administrator for:
- Adding new vehicles
- Resetting passwords
- Billing issues
- Device problems
