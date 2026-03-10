const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'gps_admin',
    password: process.env.POSTGRES_PASSWORD || 'gps_strong_password',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'gps_saas',
    port: 5432,
});

class RulesEngine {
    static async evaluate(deviceId, lat, lng, speed, ignition, timestamp) {
        try {
            // 1. Fetch active rules for this device's owner
            const rulesRes = await pool.query(`
                SELECT ar.* FROM alert_rules ar
                JOIN vehicles v ON v.client_id = ar.user_id
                JOIN devices d ON d.id = v.device_id
                WHERE d.id = $1 AND ar.is_active = true
            `, [deviceId]);

            const alertsTriggered = [];

            for (const rule of rulesRes.rows) {
                let triggered = false;
                let message = '';

                switch (rule.type) {
                    case 'speed':
                        const limit = rule.conditions.limit || 80;
                        if (speed > limit) {
                            triggered = true;
                            message = `Overspeed detected: ${speed} km/h (Limit: ${limit})`;
                        }
                        break;

                    case 'geofence':
                        // Check if point is inside geofence using PostGIS or fallback
                        const fenceRes = await pool.query(`
                            SELECT name, fence_type, 
                            ST_Contains(ST_SetSRID(geom, 4326), ST_SetSRID(ST_Point($1, $2), 4326)) as is_inside
                            FROM geofences WHERE id = $3
                        `, [lng, lat, rule.conditions.geofence_id]);

                        if (fenceRes.rows.length > 0) {
                            const fence = fenceRes.rows[0];
                            const conditionType = rule.conditions.trigger; // 'enter' or 'exit'
                            if (conditionType === 'enter' && fence.is_inside) {
                                triggered = true;
                                message = `Entered geofence: ${fence.name}`;
                            } else if (conditionType === 'exit' && !fence.is_inside) {
                                triggered = true;
                                message = `Exited geofence: ${fence.name}`;
                            }
                        }
                        break;

                    case 'ignition':
                        if (rule.conditions.state === 'on' && ignition) {
                            triggered = true;
                            message = `Ignition turned ON`;
                        } else if (rule.conditions.state === 'off' && !ignition) {
                            triggered = true;
                            message = `Ignition turned OFF`;
                        }
                        break;
                }

                if (triggered) {
                    alertsTriggered.push({ ruleId: rule.id, message });
                    await this.saveAlert(deviceId, message);
                }
            }

            return alertsTriggered;
        } catch (err) {
            console.error('[RulesEngine] Error:', err.message);
            return [];
        }
    }

    static async saveAlert(deviceId, message) {
        try {
            await pool.query(
                'INSERT INTO alerts (device_id, message, timestamp) VALUES ($1, $2, NOW())',
                [deviceId, message]
            );
            console.log(`[ALERT] Triggered for ${deviceId}: ${message}`);
        } catch (e) {
            console.error('[RulesEngine] Failed to save alert:', e.message);
        }
    }
}

module.exports = RulesEngine;
