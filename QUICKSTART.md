# 🚀 QUICK START GUIDE - GPS Tracker

## Installation (5 minutes)

### Step 1: Extract Files
```bash
unzip gps-tracker-project.zip
cd gps-tracker-project
```

### Step 2: Install (Automatic)
```bash
chmod +x install.sh
./install.sh
```

**OR Manual Installation:**
```bash
npm install
```

### Step 3: Start Server
```bash
npm start
```

## 🌐 Access

- **Web Dashboard**: http://localhost:3000
- **GPS Port**: 5000

## 🧪 Test Without GPS Device

```bash
# In a new terminal
node test-gps.js
```

This will send test locations to the server!

## 📱 Configure Your GPS Tracker

1. Get your server's public IP:
   - Visit: http://whatismyip.com
   - Or run: `curl ifconfig.me`

2. In your GPS tracker settings:
   - **Server/Domain**: YOUR_PUBLIC_IP
   - **Port**: 5000
   - **Protocol**: TCP

3. Common GPS tracker commands:
   - **TK102**: `adminip123456 YOUR_IP 5000`
   - **GT06**: Use mobile app
   - **Others**: Check device manual

## 📊 Supported Data Formats

Your server accepts:

**JSON (Recommended):**
```json
{"imei":"123456","lat":37.7749,"lon":-122.4194,"speed":45,"altitude":120}
```

**CSV:**
```
123456,37.7749,-122.4194,45,120
```

**NMEA:**
```
$GPRMC,123519,A,3748.494,N,12241.164,W,45.5,054.7,191194,020.3,E*68
```

## ⚡ Testing with Command Line

**Using netcat (Linux/Mac):**
```bash
echo '{"imei":"TEST","lat":37.7749,"lon":-122.4194}' | nc localhost 5000
```

**Using telnet (Windows):**
```cmd
telnet localhost 5000
{"imei":"TEST","lat":37.7749,"lon":-122.4194}
```

## 🔧 Port Forwarding (For Remote Access)

If testing from external GPS device:

1. **Router Setup:**
   - Login to router
   - Forward port 5000 to your computer's local IP

2. **Firewall:**
   ```bash
   # Linux
   sudo ufw allow 5000
   
   # Windows: Allow in Windows Firewall
   ```

## 🎯 What You'll See

✅ GPS coordinates updating in real-time
✅ Interactive map with marker
✅ Speed, altitude, and IMEI information
✅ Last update timestamp
✅ Connection status

## 📝 For Your College Report

**Technologies Used:**
- Backend: Node.js, Express
- Real-time: Socket.io, WebSockets
- Frontend: HTML5, CSS3, JavaScript
- Maps: Leaflet.js, OpenStreetMap
- Protocols: TCP/IP, NMEA, JSON

**Features Implemented:**
- TCP server for GPS data reception
- Real-time location updates
- Multi-format GPS data parsing
- Interactive web dashboard
- RESTful API endpoints
- WebSocket communication

## 🐛 Common Issues

**Port already in use:**
```bash
# Change ports in server.js:
const WEB_PORT = 3001;  // Change from 3000
const GPS_PORT = 5001;  // Change from 5000
```

**GPS device not connecting:**
- Check firewall settings
- Verify IP address is correct
- Test with simulated data first
- Check GPS device has internet

**No location updates:**
- Check server console for incoming data
- Verify GPS data format
- Test with test-gps.js script

## 📞 Support

Check the full README.md for detailed documentation!

---

**Good luck with your project!** 🎓✨
