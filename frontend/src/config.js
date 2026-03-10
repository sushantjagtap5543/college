const CONFIG = {
    PORTAL_NAME: "GeoSurePath",
    BRAND_COLOR: "#10b981", // Emerald-500
    SLOGAN: "Strategic Asset Oversight Intelligence",
    SUPPORT_EMAIL: "support@geosurepath.com",
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : `${window.location.protocol}//${window.location.hostname}`,
    WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'ws://localhost:8080'
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}`,
};

export default CONFIG;
