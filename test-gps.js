#!/usr/bin/env node

const net = require('net');

console.log('====================================');
console.log('GPS Data Simulator');
console.log('====================================\n');

// Test locations
const locations = [
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 }
];

function sendGPSData(location, format = 'json') {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        client.connect(5000, 'localhost', () => {
            console.log(`Connected to GPS server`);
            
            let data;
            
            if (format === 'json') {
                data = JSON.stringify({
                    imei: 'TEST123456789',
                    lat: location.lat,
                    lon: location.lon,
                    speed: Math.random() * 60,
                    altitude: Math.random() * 500
                });
            } else if (format === 'csv') {
                const speed = Math.random() * 60;
                const altitude = Math.random() * 500;
                data = `TEST123456789,${location.lat},${location.lon},${speed},${altitude}`;
            }
            
            console.log(`Sending: ${location.name}`);
            console.log(`Data: ${data}\n`);
            
            client.write(data + '\n');
        });
        
        client.on('data', (data) => {
            console.log(`Server response: ${data.toString()}`);
            client.destroy();
            resolve();
        });
        
        client.on('error', (err) => {
            console.error(`Error: ${err.message}`);
            reject(err);
        });
        
        client.on('close', () => {
            console.log('Connection closed\n');
        });
    });
}

async function runTest() {
    console.log('Starting GPS simulation...\n');
    console.log('Make sure the server is running (npm start)\n');
    
    // Ask user for format
    const format = process.argv[2] || 'json';
    console.log(`Using format: ${format}\n`);
    
    try {
        // Send data for each location with delay
        for (let i = 0; i < locations.length; i++) {
            await sendGPSData(locations[i], format);
            
            if (i < locations.length - 1) {
                console.log('Waiting 3 seconds before next location...\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        console.log('====================================');
        console.log('✅ Test completed!');
        console.log('====================================');
        console.log('\nCheck the web interface at: http://localhost:3000');
        
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Make sure the server is running: npm start');
    }
}

// Show usage
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node test-gps.js [format]');
    console.log('\nFormats:');
    console.log('  json (default) - Send data as JSON');
    console.log('  csv            - Send data as CSV');
    console.log('\nExample:');
    console.log('  node test-gps.js json');
    console.log('  node test-gps.js csv');
    process.exit(0);
}

runTest();
