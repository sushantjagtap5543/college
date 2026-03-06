# GPS Tracker - College Project

A real-time GPS tracking system with web interface for monitoring GPS device locations on a map.

## 🌟 Features

- **Real-time GPS Tracking**: View live location updates on an interactive map
- **Web Dashboard**: Clean, responsive interface with GPS coordinates display
- **Multiple Protocol Support**: Supports JSON, NMEA (GPRMC), and CSV formats
- **WebSocket Updates**: Instant location updates without page refresh
- **Server Information**: Displays IP and port for easy GPS device configuration
- **Cross-platform**: Works on Linux, macOS, and Windows

## 📋 Prerequisites

- **Node.js** (v14 or higher) - JavaScript runtime
- **npm** - Node package manager (comes with Node.js)
- **GPS Tracker Device** - Any GPS device that can send data via TCP

## 🚀 Quick Start

### Option 1: Automatic Installation (Linux/macOS)

```bash
# Make install script executable
chmod +x install.sh

# Run installation
./install.sh

# Start the server
npm start
```

### Option 2: Manual Installation

```bash
# Install Node.js (if not installed)
# Visit: https://nodejs.org/

# Install dependencies
npm install

# Start the server
npm start
```

## 🖥️ Usage

1. **Start the Server**
   ```bash
   npm start
   ```

2. **Access Web Interface**
   - Open browser: `http://localhost:3000`
   - The dashboard will display your server IP and port

3. **Configure GPS Tracker**
   - Get your server's public IP address
   - Configure your GPS device with:
     - **Server IP**: Your public IP (shown on dashboard)
     - **Server Port**: `5000`
     - **Protocol**: TCP

4. **Send GPS Data**
   - Your GPS device will send location data to the server
   - The map will update in real-time!

## 📡 GPS Data Formats Supported

The server accepts multiple GPS data formats:

### 1. JSON Format (Recommended)
```json
{
  "imei": "123456789012345",
  "lat": 37.7749,
  "lon": -122.4194,
  "speed": 45.5,
  "altitude": 120
}
```

### 2. Simple CSV Format
```
IMEI,LATITUDE,LONGITUDE,SPEED,ALTITUDE
123456789012345,37.7749,-122.4194,45.5,120
```

### 3. NMEA GPRMC Format
```
$GPRMC,123519,A,3748.494,N,12241.164,W,45.5,054.7,191194,020.3,E*68
```

## 🧪 Testing with Simulated Data

You can test the system without a physical GPS device:

### Using netcat (Linux/macOS)
```bash
# Send JSON data
echo '{"imei":"TEST123","lat":37.7749,"lon":-122.4194,"speed":0,"altitude":0}' | nc localhost 5000

# Or simple CSV
echo 'TEST123,37.7749,-122.4194,0,0' | nc localhost 5000
```

### Using Python
```python
import socket
import json
import time

def send_gps_data(lat, lon):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('localhost', 5000))
    
    data = {
        "imei": "TEST123",
        "lat": lat,
        "lon": lon,
        "speed": 25.5,
        "altitude": 100
    }
    
    sock.send(json.dumps(data).encode())
    response = sock.recv(1024)
    print(f"Server response: {response.decode()}")
    sock.close()

# Send test location (San Francisco)
send_gps_data(37.7749, -122.4194)
```

### Using curl (HTTP alternative)
Create a simple HTTP endpoint tester:
```bash
# Install netcat if not available
# Then send data:
echo '{"imei":"TEST123","lat":37.7749,"lon":-122.4194}' | nc localhost 5000
```

## 🌐 Deploying on a Server

### For Public Access:

1. **Get a Server** (AWS, DigitalOcean, Heroku, etc.)

2. **Open Ports**
   - Port 3000 (Web Interface)
   - Port 5000 (GPS Data)

3. **Configure Firewall**
   ```bash
   # Ubuntu/Debian with ufw
   sudo ufw allow 3000
   sudo ufw allow 5000
   ```

4. **Run with PM2** (Production)
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start server
   pm2 start server.js --name gps-tracker
   
   # Auto-restart on reboot
   pm2 startup
   pm2 save
   ```

5. **Find Your Public IP**
   ```bash
   curl ifconfig.me
   ```

## 📁 Project Structure

```
gps-tracker-project/
├── server.js           # Main server file
├── package.json        # Dependencies
├── install.sh          # Installation script
├── README.md          # This file
└── public/
    └── index.html     # Web interface
```

## 🔧 Configuration

Edit `server.js` to change ports:

```javascript
const WEB_PORT = 3000;   // Web interface port
const GPS_PORT = 5000;   // GPS data port
```

## 🐛 Troubleshooting

### GPS Device Not Connecting
- Check firewall settings
- Verify GPS device has internet connection
- Confirm correct IP and port configuration
- Check server logs for connection attempts

### Web Interface Not Loading
- Ensure server is running: `npm start`
- Check if port 3000 is available
- Try accessing via IP: `http://YOUR_IP:3000`

### No Location Updates
- Verify GPS device is sending data
- Check GPS data format
- Monitor server console for incoming data
- Test with simulated data first

## 📱 GPS Tracker Configuration Examples

### Common GPS Tracker Settings:
- **APN**: Your network provider
- **Server IP**: Your public IP
- **Server Port**: 5000
- **Protocol**: TCP
- **Interval**: 30 seconds (recommended)

### Popular GPS Tracker Models:
- **TK102**: SMS command: `adminip123456 YOUR_IP 5000`
- **GT06**: Use mobile app to configure server
- **Concox**: Configure via web platform
- **Queclink**: Use GV300 configuration tool

## 🎓 College Project Notes

This project demonstrates:
- **Backend Development**: Node.js, Express, WebSocket
- **Frontend Development**: HTML, CSS, JavaScript
- **Real-time Communication**: Socket.io
- **TCP/IP Networking**: Raw socket communication
- **GPS Data Processing**: Multiple format parsing
- **Map Integration**: Leaflet.js for interactive maps
- **System Integration**: GPS hardware integration

## 📝 License

MIT License - Free for educational and commercial use

## 🤝 Contributing

This is a college project, but feel free to:
- Report bugs
- Suggest improvements
- Share your implementations

## 📧 Support

For issues or questions:
1. Check troubleshooting section
2. Review server logs
3. Test with simulated data
4. Verify GPS device manual

## 🎯 Future Enhancements

- [ ] Store location history in database
- [ ] Multiple device tracking
- [ ] Geofencing alerts
- [ ] Route playback
- [ ] Mobile app integration
- [ ] User authentication

---

**Made for educational purposes** 🎓

Good luck with your college project! 🚀
