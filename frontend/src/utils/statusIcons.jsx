import L from 'leaflet';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  VEHICLE ICON SYSTEM — File-based SVGs with heading rotation    ║
 * ║                                                                  ║
 * ║  SVG files live in:  /public/vehicle-icons/<type>.svg           ║
 * ║  Every SVG must face UPWARD (north) by default.                 ║
 * ║  The icon engine rotates the image by GPS heading/course.       ║
 * ║                                                                  ║
 * ║  To change an icon: replace the SVG file in the folder.         ║
 * ║  All 22 vehicle types have their own dedicated SVG file.        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

/** Alias map — empty since all 22 types have their own SVG file.
 * Add entries here only if you want two types to share one file. */
const ICON_FILE_ALIAS = {};

/** Resolve iconType → SVG filename (without extension) */
export const resolveIconFile = (iconType) =>
  ICON_FILE_ALIAS[iconType] || iconType || 'car';

// --- VEHICLE ICON OPTIONS (shown in the icon picker) ---
export const VEHICLE_ICON_OPTIONS = [
  { id: 'car', label: 'Sedan', emoji: '🚗' },
  { id: 'suv', label: 'SUV', emoji: '🚙' },
  { id: 'pickup', label: 'Pickup', emoji: '🛻' },
  { id: 'van', label: 'Van', emoji: '🚐' },
  { id: 'taxi', label: 'Taxi', emoji: '🚕' },
  { id: 'racecar', label: 'Sports', emoji: '🏎️' },
  { id: 'truck', label: 'Truck', emoji: '🚛' },
  { id: 'box_truck', label: 'Box Truck', emoji: '🚚' },
  { id: 'bus', label: 'Bus', emoji: '🚌' },
  { id: 'coach', label: 'Coach', emoji: '🚍' },
  { id: 'motorcycle', label: 'Moto', emoji: '🏍️' },
  { id: 'scooter', label: 'Scooter', emoji: '🛵' },
  { id: 'bike', label: 'Bicycle', emoji: '🚲' },
  { id: 'auto', label: 'Auto', emoji: '🛺' },
  { id: 'ambulance', label: 'Ambulance', emoji: '🚑' },
  { id: 'police', label: 'Police', emoji: '🚓' },
  { id: 'fire', label: 'Fire', emoji: '🚒' },
  { id: 'tractor', label: 'Tractor', emoji: '🚜' },
  { id: 'tanker', label: 'Tanker', emoji: '⛽' },
  { id: 'jcb', label: 'JCB', emoji: '🚧' },
  { id: 'boat', label: 'Boat', emoji: '🚤' },
  { id: 'ship', label: 'Ship', emoji: '🚢' },
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

// ─── localStorage helpers ─────────────────────────────────────────────────────
export const getVehicleIconPref = (imei) => {
  try { return JSON.parse(localStorage.getItem('vehicleIcons') || '{}')[imei] || 'car'; } catch { return 'car'; }
};
export const getVehicleColorPref = (imei) => {
  try { return JSON.parse(localStorage.getItem('vehicleColors') || '{}')[imei] || null; } catch { return null; }
};
export const setVehicleIconPref = (imei, iconId) => {
  try {
    const obj = JSON.parse(localStorage.getItem('vehicleIcons') || '{}');
    obj[imei] = iconId;
    localStorage.setItem('vehicleIcons', JSON.stringify(obj));
  } catch { }
};
export const setVehicleColorPref = (imei, color) => {
  try {
    const obj = JSON.parse(localStorage.getItem('vehicleColors') || '{}');
    obj[imei] = color;
    localStorage.setItem('vehicleColors', JSON.stringify(obj));
  } catch { }
};

// ─── MAIN ICON GENERATOR ──────────────────────────────────────────────────────
/**
 * getVehicleIcon(vehicle, colorOverride?)
 *
 * Renders an `<img>` pointing to /vehicle-icons/<type>.svg inside a
 * positioned `<div>`.  The img is rotated by the GPS heading so the
 * vehicle "faces" the direction it's travelling.  A coloured circle
 * backdrop (user's chosen colour) sits behind the image.
 *
 * Vehicle fields used:
 *   .status      — 'moving' | 'idle' | 'stopped' | 'alert' | 'offline'
 *   .ignition    — boolean
 *   .color       — hex body/badge color
 *   .iconType    — key from VEHICLE_ICON_OPTIONS
 *   .heading     — 0–359° (0 = north, 90 = east …)
 *   .course      — fallback if .heading is absent (Traccar field)
 *   .isAlerting  — boolean
 *   .imei / .id  — used for localStorage look-ups
 */
export const getVehicleIcon = (vehicle, colorOverride = null) => {
  const imei = vehicle.imei || vehicle.id || '';
  const status = vehicle.status || 'offline';
  const badgeColor = colorOverride || vehicle.color || getVehicleColorPref(imei) || '#3b82f6';

  // Heading: GPS degrees 0–359 (0 = north = up)
  const heading = Number(vehicle.heading ?? vehicle.course ?? 0);

  const statusColor = status === 'moving' ? '#10b981'
    : status === 'idle' ? '#f59e0b'
      : (status === 'alert' || vehicle.isAlerting) ? '#ef4444'
        : status === 'stopped' ? '#3b82f6'
          : '#94a3b8';

  const ignition = vehicle.ignition !== false;
  const isMoving = status === 'moving';
  const isAlerting = status === 'alert' || vehicle.isAlerting;
  const iconType = vehicle.iconType || vehicle.type || getVehicleIconPref(imei) || 'car';
  const svgFile = resolveIconFile(iconType);
  const svgUrl = `/vehicle-icons/${svgFile}.svg`;

  // Pulse ring border (keyframe via inline animation hack using SVG)
  const pulseStyle = (isMoving || isAlerting)
    ? `box-shadow:0 0 0 3px ${statusColor}66, 0 0 0 7px ${statusColor}22;`
    : '';

  const alertBlink = isAlerting
    ? `animation:tz-alert-blink 0.5s infinite;`
    : '';

  // Direction arrow — tiny chevron at top of the rotating group
  // Rendered as a small triangle inside the SVG wrapper via border trick
  const arrowHtml = isMoving
    ? `<div style="
            position:absolute;top:-5px;left:50%;
            transform:translateX(-50%);
            width:0;height:0;
            border-left:5px solid transparent;
            border-right:5px solid transparent;
            border-bottom:7px solid ${statusColor};
            z-index:2;
          "></div>`
    : '';

  const html = `
    <style>
      @keyframes tz-alert-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes tz-pulse { 0%{box-shadow:0 0 0 0px ${statusColor}55} 100%{box-shadow:0 0 0 10px ${statusColor}00} }
    </style>
    <div style="
      position:relative;
      width:44px;height:44px;
      display:flex;align-items:center;justify-content:center;
    ">
      <!-- Coloured backdrop circle (user's chosen colour) -->
      <div style="
        position:absolute;inset:3px;
        border-radius:50%;
        background:${badgeColor};
        opacity:0.88;
        ${pulseStyle}
        ${isMoving ? 'animation:tz-pulse 1.5s infinite;' : ''}
        ${alertBlink}
      "></div>

      <!-- Vehicle SVG image — rotates with GPS heading -->
      <div style="
        position:absolute;inset:0;
        display:flex;align-items:center;justify-content:center;
        transform:rotate(${heading}deg);
        transform-origin:center center;
      ">
        ${arrowHtml}
        <img
          src="${svgUrl}"
          width="38" height="38"
          style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));display:block;"
          onerror="this.src='/vehicle-icons/car.svg'"
        />
      </div>

      <!-- Status dot (bottom-right) — FIXED, does NOT rotate -->
      <div style="
        position:absolute;bottom:1px;right:0px;
        width:11px;height:11px;
        border-radius:50%;
        background:${statusColor};
        border:2px solid white;
        box-shadow:0 1px 3px rgba(0,0,0,0.3);
        ${isAlerting ? 'animation:tz-alert-blink 0.4s infinite;' : ''}
      "></div>

      <!-- Ignition dot (top-right) — FIXED, does NOT rotate -->
      <div style="
        position:absolute;top:1px;right:0px;
        width:10px;height:10px;
        border-radius:50%;
        background:${ignition ? '#22c55e' : '#94a3b8'};
        border:2px solid white;
        box-shadow:0 1px 2px rgba(0,0,0,0.25);
      "></div>
    </div>`;

  return L.divIcon({
    className: '',          // blank — no leaflet default styles
    html,
    iconSize: [44, 44],
    iconAnchor: [22, 22],   // center of marker = GPS coordinate point
    popupAnchor: [0, -22],
  });
};
