const redis = require('redis');

const client = redis.createClient({
    url: 'redis://localhost:6379'
});

client.on('error', (err) => {
    // Suppress error if redis is not running
});

async function simulate() {
    try {
        await client.connect();
        console.log('--- GPS SIMULATOR STARTED ---');

        const devices = [
            { imei: '869727079043558', name: 'Fleet Truck 01', lat: 18.5204, lng: 73.8567, speed: 45 },
            { imei: '869727079043556', name: 'Delivery Van 02', lat: 18.5304, lng: 73.8667, speed: 0 },
            { imei: '869727079043554', name: 'Service Car 05', lat: 18.5404, lng: 73.8767, speed: 65 }
        ];

        setInterval(async () => {
            for (const dev of devices) {
                // Update position slightly
                if (dev.speed > 0) {
                    dev.lat += (Math.random() - 0.5) * 0.001;
                    dev.lng += (Math.random() - 0.5) * 0.001;
                }

                const packet = {
                    imei: dev.imei,
                    lat: dev.lat,
                    lng: dev.lng,
                    speed: dev.speed,
                    heading: Math.floor(Math.random() * 360),
                    ignition: dev.speed > 0,
                    device_timestamp: new Date().toISOString(),
                    isRealTime: true
                };

                // Publish to Redis for app.js Alert Engine
                await client.publish('gps:updates', JSON.stringify(packet));

                // Save to HASH for /api/fleet
                await client.hSet(`live:${dev.imei}`, {
                    imei: dev.imei,
                    lat: dev.lat.toString(),
                    lng: dev.lng.toString(),
                    speed: dev.speed.toString(),
                    heading: packet.heading.toString(),
                    last_update: Date.now().toString()
                });
            }
        }, 3000);

    } catch (e) {
        console.warn('Simulator: Redis connection failed. Local tracking will be static.');
    }
}

simulate();
