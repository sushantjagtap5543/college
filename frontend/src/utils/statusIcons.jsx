import L from 'leaflet';

// --- VEHICLE ICON OPTIONS ---
export const VEHICLE_ICON_OPTIONS = [
    { id: 'car', label: 'Car', emoji: '🚗' },
    { id: 'suv', label: 'SUV', emoji: '🚙' },
    { id: 'pickup', label: 'Pickup', emoji: '🛻' },
    { id: 'truck', label: 'Truck', emoji: '🚛' },
    { id: 'van', label: 'Van', emoji: '🚐' },
    { id: 'bus', label: 'Bus', emoji: '🚌' },
    { id: 'motorcycle', label: 'Motorcycle', emoji: '🏍️' },
    { id: 'scooter', label: 'Scooter', emoji: '🛵' },
    { id: 'bike', label: 'Bike', emoji: '🚲' },
    { id: 'auto', label: 'Auto', emoji: '🛺' },
    { id: 'tractor', label: 'Tractor', emoji: '🚜' },
    { id: 'crane', label: 'Crane', emoji: '🏗️' },
    { id: 'tanker', label: 'Tanker', emoji: '⛽' },
    { id: 'jcb', label: 'JCB', emoji: '🚧' },
    { id: 'ambulance', label: 'Ambulance', emoji: '🚑' },
    { id: 'police', label: 'Police', emoji: '🚓' },
];

// --- PIN COLOR OPTIONS ---
export const PIN_COLOR_OPTIONS = [
    { id: '#10b981', label: 'Green' },
    { id: '#3b82f6', label: 'Blue' },
    { id: '#f59e0b', label: 'Amber' },
    { id: '#8b5cf6', label: 'Purple' },
    { id: '#ef4444', label: 'Red' },
    { id: '#06b6d4', label: 'Cyan' },
    { id: '#ec4899', label: 'Pink' },
    { id: '#f97316', label: 'Orange' },
    { id: '#14b8a6', label: 'Teal' },
    { id: '#6366f1', label: 'Indigo' },
    { id: '#84cc16', label: 'Lime' },
    { id: '#334155', label: 'Slate' },
];

// Helper to get icon preference
export const getVehicleIconPref = (imei) => {
    try { return JSON.parse(localStorage.getItem('vehicleIcons') || '{}')[imei] || 'car'; } catch { return 'car'; }
};
export const getVehicleColorPref = (imei) => {
    try { return JSON.parse(localStorage.getItem('vehicleColors') || '{}')[imei] || null; } catch { return null; }
};

// Helpers to set icon/color preferences
export const setVehicleIconPref = (imei, iconId) => {
    try {
        const existing = JSON.parse(localStorage.getItem('vehicleIcons') || '{}');
        existing[imei] = iconId;
        localStorage.setItem('vehicleIcons', JSON.stringify(existing));
    } catch { }
};
export const setVehicleColorPref = (imei, color) => {
    try {
        const existing = JSON.parse(localStorage.getItem('vehicleColors') || '{}');
        existing[imei] = color;
        localStorage.setItem('vehicleColors', JSON.stringify(existing));
    } catch { }
};

// Generate inner SVG shape for each icon type
export const getIconShapeSvg = (type) => {
    switch (type) {
        case 'car':
        case 'suv':
            return opacity => `<rect x="12" y="8" width="16" height="30" rx="6" fill="white" opacity="${opacity || 0.95}"/>
                   <rect x="14" y="14" width="12" height="8" rx="2" fill="rgba(0,0,0,0.15)"/>
                   <rect x="14" y="26" width="12" height="6" rx="1.5" fill="rgba(0,0,0,0.1)"/>
                   <rect x="11" y="12" width="1.5" height="5" rx="0.5" fill="white"/>
                   <rect x="27.5" y="12" width="1.5" height="5" rx="0.5" fill="white"/>`;
        case 'truck':
            return opacity => `<rect x="11" y="6" width="18" height="34" rx="2" fill="white" opacity="${opacity || 0.95}"/>
                   <rect x="11" y="6" width="18" height="12" rx="2" fill="white" opacity="0.8"/>
                   <rect x="13" y="8" width="14" height="6" rx="1" fill="rgba(0,0,0,0.15)"/>
                   <rect x="10" y="30" width="2" height="6" rx="1" fill="rgba(0,0,0,0.3)"/>
                   <rect x="28" y="30" width="2" height="6" rx="1" fill="rgba(0,0,0,0.3)"/>`;
        case 'van':
            return opacity => `<rect x="12" y="7" width="16" height="32" rx="3" fill="white" opacity="${opacity || 0.95}"/>
                   <rect x="14" y="10" width="12" height="6" rx="1.5" fill="rgba(0,0,0,0.15)"/>
                   <rect x="14" y="28" width="12" height="4" rx="1" fill="rgba(0,0,0,0.1)"/>`;
        case 'bus':
            return opacity => `<rect x="11" y="5" width="18" height="36" rx="3" fill="white" opacity="${opacity || 0.95}"/>
                   <rect x="13" y="8" width="14" height="4" rx="1" fill="rgba(0,0,0,0.15)"/>
                   <rect x="13" y="14" width="14" height="2" rx="0.5" fill="rgba(0,0,0,0.08)"/>
                   <rect x="13" y="18" width="14" height="2" rx="0.5" fill="rgba(0,0,0,0.08)"/>
                   <rect x="13" y="22" width="14" height="2" rx="0.5" fill="rgba(0,0,0,0.08)"/>
                   <rect x="13" y="26" width="14" height="2" rx="0.5" fill="rgba(0,0,0,0.08)"/>`;
        case 'motorcycle':
        case 'scooter':
        case 'bike':
            return opacity => `<rect x="18" y="8" width="4" height="24" rx="2" fill="white" opacity="${opacity || 0.95}"/>
                    <rect x="14" y="14" width="12" height="2.5" rx="1" fill="white"/>
                    <circle cx="20" cy="12" r="2" fill="rgba(0,0,0,0.2)"/>`;
        case 'auto':
            return opacity => `<path d="M14 30 L20 8 L26 30 Z" fill="white" opacity="${opacity || 0.95}"/>
                    <rect x="18" y="14" width="4" height="12" rx="1" fill="rgba(0,0,0,0.1)"/>`;
        default:
            return opacity => `<rect x="12" y="8" width="16" height="30" rx="6" fill="white" opacity="${opacity || 0.95}"/>
                   <rect x="14" y="14" width="12" height="8" rx="2" fill="rgba(0,0,0,0.15)"/>`;
    }
};

// --- CORE VEHICLE ICON GENERATOR ---
export const getVehicleIcon = (vehicle, colorOverride = null) => {
    const status = vehicle.status || 'offline';
    const pinColor = colorOverride || vehicle.color || getVehicleColorPref(vehicle.imei) || '#10b981';
    const statusColor = status === 'moving' ? '#10b981'
        : status === 'idle' ? '#f59e0b'
            : (status === 'alert' || vehicle.isAlerting) ? '#ef4444'
                : status === 'stopped' ? '#3b82f6'
                    : '#94a3b8';

    const ignition = vehicle.ignition !== false;
    const isMoving = status === 'moving';
    const isAlerting = status === 'alert' || vehicle.isAlerting;
    const iconType = vehicle.iconType || vehicle.type || getVehicleIconPref(vehicle.imei) || 'car';
    const shapeFunc = getIconShapeSvg(iconType);
    const carSvg = typeof shapeFunc === 'function' ? shapeFunc(0.95) : shapeFunc;

    // Dynamic pulse animation for alerts or movement
    const pulseRing = (isMoving || isAlerting) ? `
        <circle cx="20" cy="18" r="22" fill="none" stroke="${statusColor}" stroke-width="2" opacity="0.35">
            <animate attributeName="r" values="${isAlerting ? '20;35;20' : '20;30;20'}" dur="${isAlerting ? '0.8s' : '2s'}" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;0;0.6" dur="${isAlerting ? '0.8s' : '2s'}" repeatCount="indefinite"/>
        </circle>` : '';

    const alertBlink = isAlerting ? `
        <circle cx="20" cy="18" r="25" fill="${statusColor}" opacity="0.2">
            <animate attributeName="opacity" values="0.4;0;0.4" dur="0.5s" repeatCount="indefinite"/>
        </circle>` : '';

    const svgString = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        ${alertBlink}
        ${pulseRing}
        <defs>
          <filter id="ps_g">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.45)"/>
          </filter>
        </defs>
        <path d="M20 3 C11 3,4 10,4 19 C4 28,20 45,20 45 C20 45,36 28,36 19 C36 10,29 3,20 3 Z" fill="${isAlerting ? '#ef4444' : pinColor}" filter="url(#ps_g)">
            ${isAlerting ? '<animate attributeName="fill" values="#ef4444;#991b1b;#ef4444" dur="0.5s" repeatCount="indefinite"/>' : ''}
        </path>
        <circle cx="20" cy="18" r="12" fill="rgba(0,0,0,0.18)"/>
        ${carSvg}
        <circle cx="20" cy="18" r="12" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.7"/>
        <circle cx="32" cy="8" r="5" fill="${ignition ? '#22c55e' : '#94a3b8'}" stroke="white" stroke-width="1.5"/>
        <circle cx="8" cy="8" r="4" fill="${statusColor}">
            <animate attributeName="opacity" values="1;0.2;1" dur="${isAlerting ? '0.4s' : '0.8s'}" repeatCount="indefinite"/>
        </circle>
    </svg>`;

    return L.divIcon({
        className: 'custom-vehicle-marker',
        html: svgString,
        iconSize: [40, 50],
        iconAnchor: [20, 45]
    });
};
