const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const net = require('net');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Configuration
const WEB_PORT = 3000;
const GPS_PORT = 5000;

// Store latest GPS data and history
let latestGPSData = {
    latitude: 0,
    longitude: 0,
    timestamp: null,
    imei: null,
    speed: 0,
    altitude: 0
};

let historicalPath = [];
const MAX_HISTORY = 100;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get latest GPS data and history
app.get('/api/location', (req, res) => {
    res.json({
        latest: latestGPSData,
        path: historicalPath
    });
});

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected to WebSocket');

    // Send current location and history immediately
    socket.emit('locationUpdate', {
        latest: latestGPSData,
        path: historicalPath
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected from WebSocket');
    });
});

// GPS TCP Server to receive data from GPS tracker
const gpsServer = net.createServer((socket) => {
    console.log('GPS device connected from:', socket.remoteAddress);

    socket.on('data', (data) => {
        const dataStr = data.toString();
        console.log('Raw GPS data received:', dataStr);

        try {
            // Parse GPS data (this is a basic parser - adjust based on your GPS protocol)
            const parsedData = parseGPSData(dataStr);

            if (parsedData) {
                latestGPSData = {
                    ...parsedData,
                    timestamp: new Date().toISOString()
                };

                console.log('Parsed GPS data:', latestGPSData);

                // Add to history
                if (latestGPSData.latitude !== 0 && latestGPSData.longitude !== 0) {
                    historicalPath.push([latestGPSData.latitude, latestGPSData.longitude]);
                    if (historicalPath.length > MAX_HISTORY) {
                        historicalPath.shift();
                    }
                }

                // Broadcast to all connected web clients
                io.emit('locationUpdate', {
                    latest: latestGPSData,
                    path: historicalPath
                });

                // Send acknowledgment back to GPS device
                socket.write('OK\n');
            }
        } catch (error) {
            console.error('Error parsing GPS data:', error);
        }
    });

    socket.on('error', (err) => {
        console.error('GPS socket error:', err);
    });

    socket.on('end', () => {
        console.log('GPS device disconnected');
    });
});

// Parse GPS data - supports common formats
function parseGPSData(dataStr) {
    // Remove any whitespace
    const data = dataStr.trim();

    // Try to parse as JSON first
    if (data.startsWith('{')) {
        try {
            const json = JSON.parse(data);
            return {
                latitude: parseFloat(json.lat || json.latitude || 0),
                longitude: parseFloat(json.lon || json.longitude || json.lng || 0),
                imei: json.imei || 'unknown',
                speed: parseFloat(json.speed || 0),
                altitude: parseFloat(json.altitude || json.alt || 0)
            };
        } catch (e) {
            console.log('Not valid JSON');
        }
    }

    // Parse GPRMC NMEA format: $GPRMC,timestamp,status,lat,N/S,lon,E/W,speed,course,date,...
    if (data.includes('$GPRMC') || data.includes('GPRMC')) {
        const parts = data.split(',');
        if (parts.length >= 9) {
            const lat = convertNMEAtoDecimal(parts[3], parts[4]);
            const lon = convertNMEAtoDecimal(parts[5], parts[6]);

            if (lat !== null && lon !== null) {
                return {
                    latitude: lat,
                    longitude: lon,
                    imei: 'NMEA',
                    speed: parseFloat(parts[7] || 0) * 1.852, // Convert knots to km/h
                    altitude: 0
                };
            }
        }
    }

    // Parse simple comma-separated format: IMEI,LAT,LON,SPEED,ALTITUDE
    const parts = data.split(',');
    if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);

        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return {
                latitude: lat,
                longitude: lon,
                imei: parts[0] || 'unknown',
                speed: parseFloat(parts[3] || 0),
                altitude: parseFloat(parts[4] || 0)
            };
        }
    }

    console.log('Could not parse GPS data format');
    return null;
}

// Convert NMEA coordinates to decimal degrees
function convertNMEAtoDecimal(coord, direction) {
    if (!coord || !direction) return null;

    const coordFloat = parseFloat(coord);
    if (isNaN(coordFloat)) return null;

    // NMEA format: DDMM.MMMM for latitude, DDDMM.MMMM for longitude
    const degrees = Math.floor(coordFloat / 100);
    const minutes = coordFloat - (degrees * 100);
    let decimal = degrees + (minutes / 60);

    // Apply direction
    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

// Start GPS TCP server
gpsServer.listen(GPS_PORT, '0.0.0.0', () => {
    console.log(`GPS TCP Server listening on port ${GPS_PORT}`);
    console.log(`Configure your GPS tracker to send data to: <YOUR_SERVER_IP>:${GPS_PORT}`);
});

// Start web server
server.listen(WEB_PORT, () => {
    console.log(`Web server running on http://localhost:${WEB_PORT}`);
    console.log(`\nServer Information:`);
    console.log(`- Web Interface: http://localhost:${WEB_PORT}`);
    console.log(`- GPS Data Port: ${GPS_PORT}`);
    console.log(`\nConfigure your GPS tracker with:`);
    console.log(`- Server IP: <YOUR_SERVER_IP>`);
    console.log(`- Server Port: ${GPS_PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    gpsServer.close();
    server.close();
    process.exit(0);
});
