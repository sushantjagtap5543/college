import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import Settings from './components/Settings';
import CommandCenter from './components/CommandCenter';
import Maintenance from './components/Maintenance';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Map as MapIcon, Shield, Activity, Users, Settings as SettingsIcon, LogIn, ChevronRight,
    Car, Bell, PowerOff, Battery, Thermometer, Box, Database, Search, Filter,
    LogOut, Crosshair, ArrowRight, CheckCircle2, AlertTriangle, PlayCircle,
    FileText, CreditCard, Droplet, LayoutDashboard, Zap, Menu, X, Hexagon, Route as RouteIcon,
    TrendingDown, CheckSquare, Wrench, FolderOpen, UserCircle, Briefcase, Share2, FileWarning, Smartphone, Monitor, Rocket, Server, DollarSign,
    Play, Pause, FastForward, SkipBack, Rewind, Calendar as CalendarIcon, History,
    Gauge, Power, MapPin, RefreshCcw, Plus, KeyRound, Eye, EyeOff, Hash, AlertCircle, SlidersHorizontal, BarChart3, Circle as CircleIcon, Target
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline, LayerGroup, useMap, useMapEvents, Circle, Rectangle, Polygon } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Draggable from 'react-draggable';
import { io } from 'socket.io-client';

// --- Helper: Map Auto-Scaling Controller ---
function MapAutoCenter({ fleet }) {
    const map = useMap();
    useEffect(() => {
        if (!fleet || fleet.length === 0) return;
        const validCoords = fleet
            .filter(v => v.lat && v.lng && !isNaN(v.lat) && !isNaN(v.lng))
            .map(v => [Number(v.lat), Number(v.lng)]);

        if (validCoords.length > 0) {
            const bounds = L.latLngBounds(validCoords);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [fleet, map]);
    return null;
}

// --- Helper: Map pan controller ---
function MapController({ panTo }) {
    const map = useMap();
    useEffect(() => {
        if (panTo && panTo.length === 2 && !isNaN(panTo[0]) && !isNaN(panTo[1])) {
            map.panTo(panTo);
        }
    }, [panTo, map]);
    return null;
}

import CONFIG from './config';
const API_BASE = CONFIG.API_URL;
const WS_BASE = CONFIG.WS_URL;

// Traccar calls are now proxied through the backend /api/ endpoints to avoid CORS and credential exposure

// --- VEHICLE COLOR PALETTE (8 distinct colors for up to 8 vehicles) ---
const VEHICLE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const getVehicleColor = (idx) => VEHICLE_COLORS[idx % VEHICLE_COLORS.length];

// --- ALL GPS ALERT TYPES (DYNAMIC-style) ---
const ALERT_TYPES = {
    IGNITION_ON: { label: 'Ignition ON', icon: '🔑', color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0', severity: 'info' },
    IGNITION_OFF: { label: 'Ignition OFF', icon: '🔌', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', severity: 'info' },
    OVERSPEED: { label: 'Overspeed Alert', icon: '🚨', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', severity: 'critical' },
    TOWING: { label: 'Towing / Movement Without Ignition', icon: '🚛', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', severity: 'critical' },
    TAMPERING: { label: 'Tampering / Shock Alert', icon: '⚡', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', severity: 'critical' },
    GEOFENCE_ENTER: { label: 'Geofence Entry', icon: '📍', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', severity: 'warning' },
    GEOFENCE_EXIT: { label: 'Geofence Exit', icon: '🚪', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', severity: 'warning' },
    HARSH_BRAKE: { label: 'Harsh Braking', icon: '🛑', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', severity: 'warning' },
    HARSH_ACCEL: { label: 'Harsh Acceleration', icon: '⬆️', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', severity: 'warning' },
    IDLE_OVERTIME: { label: 'Long Idle', icon: '⏸️', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', severity: 'warning' },
    LOW_BATTERY: { label: 'Low Battery', icon: '🔋', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', severity: 'warning' },
    GPS_LOST: { label: 'GPS Signal Lost', icon: '📡', color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1', severity: 'warning' },
    POWER_CUT: { label: 'Power Cut / Cable Tamper', icon: '⚠️', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', severity: 'critical' },
    SOS: { label: 'SOS / Panic Button', icon: '🆘', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', severity: 'critical' },
    DOOR_OPEN: { label: 'Door / Cargo Opened', icon: '🚪', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', severity: 'warning' },
    TEMPERATURE_HIGH: { label: 'High Temperature', icon: '🌡️', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', severity: 'warning' },
    FUEL_THEFT: { label: 'Fuel Theft / Level Drop', icon: '⛽', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', severity: 'critical' },
    ROUTE_DEVIATION: { label: 'Route Deviation', icon: '🔀', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', severity: 'warning' },
};

import {
    getVehicleIcon,
    VEHICLE_ICON_OPTIONS,
    PIN_COLOR_OPTIONS,
    getVehicleIconPref,
    setVehicleIconPref,
    getVehicleColorPref,
    setVehicleColorPref
} from './utils/statusIcons.jsx';
import {
    TONES,
    getSavedToneId,
    setSavedToneId,
    playNormalAlert,
    playSeriousAlert,
    previewTone
} from './utils/notificationTones';

// (Moved to shared utils)

// Compatibility alias
const createIcon = (color, heading, type) => getVehicleIcon({ color, heading, type, status: 'idle', speed: 0 }, color);

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Critical React Error Caught:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
                    <div className="bg-rose-500/10 p-8 rounded-3xl border border-rose-500/30 max-w-2xl w-full backdrop-blur-md shadow-2xl">
                        <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/40">
                            <AlertTriangle className="text-white" size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">System Render Failure</h1>
                        <p className="text-rose-200 font-medium mb-8 text-lg">
                            The application encountered a critical error while rendering the UI. This is usually caused by a map component crash in production.
                        </p>

                        <div className="bg-slate-950 rounded-xl p-4 text-left overflow-x-auto mb-8 border border-slate-800">
                            <h3 className="text-rose-400 font-bold mb-2 text-sm uppercase tracking-wider">Error Details:</h3>
                            <pre className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                                {this.state.error && this.state.error.toString()}
                                {'\n'}
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white text-rose-600 hover:bg-slate-100 font-black px-8 py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 block w-full sm:w-auto sm:mx-auto"
                        >
                            Hard Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// --- STATIC FUEL CHART DATA ---
const FUEL_CHART_DATA = [
    { time: '08:00', fuel: 90 }, { time: '10:00', fuel: 85 }, { time: '12:00', fuel: 80 },
    { time: '14:00', fuel: 75 }, { time: '16:00', fuel: 30 }, { time: '18:00', fuel: 100 }
];

// --- ANIMATED LANDING PAGE COMPONENTS ---

// Real map-style vehicle pin SVG (same family as getVehicleIcon)
const VehiclePin = ({ color = '#10b981', size = 1 }) => (
    <g transform={`scale(${size})`}>
        <path d="M0 -18 C-10 -18,-18 -10,-18 0 C-18 10,0 22,0 22 C0 22,18 10,18 0 C18 -10,10 -18,0 -18 Z" fill={color} filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.5))" />
        <circle cx="0" cy="0" r="10" fill="rgba(0,0,0,0.25)" />
        {/* Car body */}
        <rect x="-6" y="-3" width="12" height="8" rx="2" fill="white" opacity="0.92" />
        <rect x="-4" y="-7" width="8" height="5" rx="1.5" fill="white" opacity="0.75" />
        <circle cx="-4" cy="5" r="2" fill={color === '#10b981' ? '#065f46' : color === '#3b82f6' ? '#1e3a8a' : '#78350f'} />
        <circle cx="4" cy="5" r="2" fill={color === '#10b981' ? '#065f46' : color === '#3b82f6' ? '#1e3a8a' : '#78350f'} />
        {/* Status blinker */}
        <circle cx="10" cy="-10" r="3.5" fill={color} stroke="#050505" strokeWidth="1.5">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />
        </circle>
    </g>
);

const WiringAnimation = () => (
    <div className="relative w-full max-w-5xl mx-auto rounded-[40px] border border-white/8 shadow-2xl overflow-hidden bg-[#070a12] group hover:border-[#10b981]/20 transition-all cursor-default">
        {/* Subtle grid background */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[#10b981]/5 rounded-full blur-[80px] pointer-events-none" />
        <svg viewBox="0 0 1060 470" className="w-full h-auto drop-shadow-2xl" style={{ minHeight: 240 }}>
            <defs>
                <filter id="glow-g"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <filter id="glow-b"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {/* ===== VEHICLE (CAR BODY) ===== */}
            <g transform="translate(80, 240)">
                <text x="0" y="-108" fill="#475569" fontSize="9" fontWeight="700" textAnchor="middle" letterSpacing="1">VEHICLE</text>
                <rect x="-52" y="-72" width="104" height="54" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                <rect x="-36" y="-90" width="72" height="22" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                <rect x="-30" y="-86" width="28" height="16" rx="3" fill="#1e3a5f" opacity="0.7" />
                <rect x="2" y="-86" width="28" height="16" rx="3" fill="#1e3a5f" opacity="0.7" />
                <circle cx="-30" cy="-18" r="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                <circle cx="-30" cy="-18" r="5" fill="#334155" />
                <circle cx="30" cy="-18" r="10" fill="#0f172a" stroke="#475569" strokeWidth="2" />
                <circle cx="30" cy="-18" r="5" fill="#334155" />
                <rect x="50" y="-62" width="4" height="10" rx="2" fill="#fef08a" opacity="0.7" />
                {/* 12V Battery */}
                <g transform="translate(-60, -38)">
                    <rect x="-22" y="-18" width="44" height="30" rx="6" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" />
                    <rect x="-6" y="-24" width="8" height="8" rx="2" fill="#ef4444" />
                    <rect x="8" y="-24" width="8" height="6" rx="2" fill="#334155" />
                    <text x="0" y="-1" fill="#ef4444" fontSize="8" fontWeight="900" textAnchor="middle">12V</text>
                    <text x="-10" y="-28" fill="#ef4444" fontSize="10" fontWeight="900" textAnchor="middle">+</text>
                    <text x="12" y="-28" fill="#64748b" fontSize="10" fontWeight="900" textAnchor="middle">-</text>
                </g>
                {/* Ignition Switch */}
                <g transform="translate(-60, 40)">
                    <circle cx="0" cy="0" r="16" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                    <circle cx="0" cy="0" r="8" fill="#1e293b" />
                    <line x1="0" y1="-8" x2="0" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                    <text x="0" y="28" fill="#f59e0b" fontSize="8" fontWeight="700" textAnchor="middle">IGN</text>
                </g>
                {/* Ground symbol */}
                <line x1="-38" y1="-18" x2="-38" y2="-28" stroke="#64748b" strokeWidth="2" />
                <line x1="-44" y1="-28" x2="-32" y2="-28" stroke="#64748b" strokeWidth="2" />
                <line x1="-42" y1="-31" x2="-34" y2="-31" stroke="#64748b" strokeWidth="1.5" />
                <line x1="-40" y1="-34" x2="-36" y2="-34" stroke="#64748b" strokeWidth="1" />
            </g>

            {/* RED wire +12V (battery → tracker) */}
            <path d="M20 220 C80 220,100 200,170 200" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800">
                <animate attributeName="stroke-dashoffset" values="800;0" dur="1.8s" fill="freeze" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#ef4444" filter="url(#glow-g)" opacity="0.9">
                <animateMotion dur="1.2s" repeatCount="indefinite" begin="2s" path="M20 220 C80 220,100 200,170 200" />
            </circle>
            <text x="88" y="210" fill="#ef4444" fontSize="8" fontWeight="700" textAnchor="middle">+12V</text>

            {/* BLACK wire GND */}
            <path d="M20 230 C80 230,100 240,170 240" fill="none" stroke="#475569" strokeWidth="3" strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800">
                <animate attributeName="stroke-dashoffset" values="800;0" dur="1.8s" begin="0.4s" fill="freeze" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#94a3b8" opacity="0.9">
                <animateMotion dur="1.4s" repeatCount="indefinite" begin="2.5s" path="M20 230 C80 230,100 240,170 240" />
            </circle>
            <text x="88" y="252" fill="#475569" fontSize="8" fontWeight="700" textAnchor="middle">GND</text>

            {/* YELLOW wire Ignition */}
            <path d="M20 280 C80 280,100 260,170 260" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeDasharray="800" strokeDashoffset="800">
                <animate attributeName="stroke-dashoffset" values="800;0" dur="1.8s" begin="0.8s" fill="freeze" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#f59e0b" filter="url(#glow-g)" opacity="0.9">
                <animateMotion dur="1s" repeatCount="indefinite" begin="3s" path="M20 280 C80 280,100 260,170 260" />
            </circle>
            <text x="88" y="292" fill="#f59e0b" fontSize="8" fontWeight="700" textAnchor="middle">IGN</text>

            {/* ===== GPS TRACKER DEVICE ===== */}
            <g transform="translate(210, 230)">
                <rect x="-40" y="-45" width="80" height="90" rx="12" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <rect x="-30" y="-35" width="60" height="22" rx="6" fill="#071810" stroke="#10b981" strokeWidth="1" opacity="0.8" />
                <text x="0" y="-20" fill="#10b981" fontSize="8" fontWeight="900" textAnchor="middle">{CONFIG.PORTAL_NAME}</text>
                {/* Wire connector ports */}
                <rect x="-44" y="-12" width="8" height="6" rx="2" fill="#ef4444" />
                <rect x="-44" y="0" width="8" height="6" rx="2" fill="#475569" />
                <rect x="-44" y="12" width="8" height="6" rx="2" fill="#f59e0b" />
                {/* Status LEDs */}
                <circle cx="-15" cy="20" r="5" fill="#10b981">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="20" r="5" fill="#3b82f6">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
                </circle>
                <circle cx="15" cy="20" r="5" fill="#f59e0b">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.7s" begin="0.6s" repeatCount="indefinite" />
                </circle>
                {/* Antenna */}
                <line x1="0" y1="-45" x2="0" y2="-62" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                <line x1="-8" y1="-58" x2="8" y2="-58" stroke="#10b981" strokeWidth="2" />
                <line x1="-5" y1="-54" x2="5" y2="-54" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
                <circle cx="0" cy="-65" r="3" fill="#10b981" filter="url(#glow-g)">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
                </circle>
                <text x="0" y="55" fill="#475569" fontSize="8" fontWeight="700" textAnchor="middle">GPS TRACKER</text>
            </g>

            {/* ===== SIM CARD ===== */}
            <g transform="translate(350, 230)">
                <rect x="-22" y="-30" width="44" height="60" rx="8" fill="#0f172a" stroke="#6366f1" strokeWidth="1.5" />
                <rect x="-14" y="-22" width="28" height="44" rx="4" fill="#1e1b4b" />
                <polygon points="-14,-22 -4,-22 -4,-14 -14,-14" fill="#0f172a" />
                <rect x="-8" y="-5" width="16" height="3" rx="1" fill="#6366f1" opacity="0.8" />
                <rect x="-8" y="2" width="12" height="3" rx="1" fill="#6366f1" opacity="0.6" />
                <rect x="-8" y="9" width="14" height="3" rx="1" fill="#6366f1" opacity="0.4" />
                <text x="0" y="42" fill="#6366f1" fontSize="8" fontWeight="700" textAnchor="middle">SIM</text>
            </g>
            <path d="M250 230 L328 230" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="5 3">
                <animate attributeName="stroke-dashoffset" values="16;0" dur="0.8s" repeatCount="indefinite" />
            </path>
            <circle cx="0" cy="0" r="3.5" fill="#6366f1" filter="url(#glow-b)" opacity="0.9">
                <animateMotion dur="0.8s" repeatCount="indefinite" path="M250 230 L328 230" />
            </circle>

            {/* ===== GSM TOWER ===== */}
            <g transform="translate(490, 255)">
                <polygon points="-16,50 16,50 7,-15 -7,-15" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="-7" y1="-15" x2="0" y2="-45" stroke="#f59e0b" strokeWidth="2" />
                <line x1="7" y1="-15" x2="0" y2="-45" stroke="#f59e0b" strokeWidth="2" />
                <line x1="0" y1="-45" x2="0" y2="-65" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M-16 -55 Q0 -74 16 -55" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.9">
                    <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.5s" repeatCount="indefinite" />
                </path>
                <path d="M-28 -50 Q0 -82 28 -50" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.55">
                    <animate attributeName="opacity" values="0.55;0.1;0.55" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
                </path>
                <path d="M-40 -44 Q0 -90 40 -44" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.25">
                    <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
                </path>
                <text x="0" y="64" fill="#f59e0b" fontSize="8" fontWeight="700" textAnchor="middle">GSM TOWER</text>
            </g>
            <path d="M372 230 L474 230" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 3">
                <animate attributeName="stroke-dashoffset" values="16;0" dur="0.8s" repeatCount="indefinite" />
            </path>
            <circle cx="0" cy="0" r="3.5" fill="#94a3b8" opacity="0.8">
                <animateMotion dur="0.8s" repeatCount="indefinite" path="M372 230 L474 230" />
            </circle>

            {/* ===== SATELLITE ===== */}
            <g transform="translate(650, 80)">
                <rect x="-20" y="-14" width="40" height="28" rx="6" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
                <rect x="-56" y="-7" width="32" height="14" rx="3" fill="#0c4a6e" stroke="#06b6d4" strokeWidth="1" />
                <rect x="24" y="-7" width="32" height="14" rx="3" fill="#0c4a6e" stroke="#06b6d4" strokeWidth="1" />
                <line x1="-44" y1="-7" x2="-44" y2="7" stroke="#06b6d4" strokeWidth="0.5" opacity="0.6" />
                <line x1="-34" y1="-7" x2="-34" y2="7" stroke="#06b6d4" strokeWidth="0.5" opacity="0.6" />
                <line x1="34" y1="-7" x2="34" y2="7" stroke="#06b6d4" strokeWidth="0.5" opacity="0.6" />
                <line x1="44" y1="-7" x2="44" y2="7" stroke="#06b6d4" strokeWidth="0.5" opacity="0.6" />
                <circle cx="4" cy="0" r="7" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                <line x1="4" y1="-7" x2="4" y2="-16" stroke="#06b6d4" strokeWidth="1" />
                <circle cx="4" cy="-19" r="3.5" fill="#06b6d4" filter="url(#glow-b)">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.7s" repeatCount="indefinite" />
                </circle>
                <ellipse cx="0" cy="0" rx="68" ry="22" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.15" strokeDasharray="4 4" />
                <text x="0" y="-26" fill="#06b6d4" fontSize="8" fontWeight="700" textAnchor="middle" letterSpacing="1">SATELLITE</text>
            </g>
            {/* Uplink: Tower → Satellite */}
            <path d="M490 190 Q560 120 630 86" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7">
                <animate attributeName="stroke-dashoffset" values="20;0" dur="1.2s" repeatCount="indefinite" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#f59e0b" filter="url(#glow-g)" opacity="0.9">
                <animateMotion dur="1.2s" repeatCount="indefinite" path="M490 190 Q560 120 630 86" />
            </circle>

            {/* ===== PLATFORM ===== */}
            <g transform="translate(840, 230)">
                <rect x="-50" y="-36" width="100" height="72" rx="14" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <circle cx="-18" cy="-8" r="15" fill="#083321" opacity="0.85" />
                <circle cx="2" cy="-15" r="15" fill="#083321" opacity="0.9" />
                <circle cx="20" cy="-8" r="15" fill="#083321" opacity="0.85" />
                <rect x="-32" y="-8" width="64" height="22" fill="#083321" />
                <text x="0" y="6" fill="#10b981" fontSize="9" fontWeight="900" textAnchor="middle">{CONFIG.PORTAL_NAME}</text>
                <text x="0" y="-48" fill="#10b981" fontSize="8" fontWeight="700" textAnchor="middle" letterSpacing="1">PLATFORM</text>
                <circle cx="-24" cy="28" r="5" fill="#10b981">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
                </circle>
                <circle cx="-10" cy="28" r="5" fill="#3b82f6">
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
                </circle>
                <circle cx="4" cy="28" r="5" fill="#f59e0b">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" begin="0.6s" repeatCount="indefinite" />
                </circle>
            </g>
            {/* Downlink: Satellite → Platform */}
            <path d="M684 88 Q770 80 792 196" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7">
                <animate attributeName="stroke-dashoffset" values="20;0" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#06b6d4" filter="url(#glow-b)" opacity="0.9">
                <animateMotion dur="1.2s" begin="0.4s" repeatCount="indefinite" path="M684 88 Q770 80 792 196" />
            </circle>

            {/* ===== LIVE MAP PIN ===== */}
            <g transform="translate(995, 340)">
                <rect x="-30" y="-30" width="60" height="60" rx="12" fill="#0c1a2e" stroke="#10b981" strokeWidth="1" opacity="0.85" />
                <line x1="-22" y1="-12" x2="22" y2="-12" stroke="#1e293b" strokeWidth="1" />
                <line x1="-22" y1="0" x2="22" y2="0" stroke="#1e293b" strokeWidth="1" />
                <line x1="-22" y1="12" x2="22" y2="12" stroke="#1e293b" strokeWidth="1" />
                <line x1="-12" y1="-22" x2="-12" y2="22" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="-22" x2="0" y2="22" stroke="#1e293b" strokeWidth="1" />
                <line x1="12" y1="-22" x2="12" y2="22" stroke="#1e293b" strokeWidth="1" />
                <g>
                    <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" />
                    <path d="M0 -22 C-8 -22,-14 -15,-14 -8 C-14 -1,0 12,0 12 C0 12,14 -1,14 -8 C14 -15,8 -22,0 -22 Z" fill="#10b981" />
                    <rect x="-5" y="-14" width="10" height="7" rx="1.5" fill="white" opacity="0.85" />
                    <rect x="-3" y="-18" width="6" height="5" rx="1" fill="white" opacity="0.65" />
                    <circle cx="-3" cy="-7" r="1.5" fill="#065f46" />
                    <circle cx="3" cy="-7" r="1.5" fill="#065f46" />
                    <circle cx="0" cy="-8" r="18" fill="none" stroke="#10b981" strokeWidth="1.5">
                        <animate attributeName="r" values="14;24;14" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                </g>
                <text x="0" y="42" fill="#10b981" fontSize="8" fontWeight="700" textAnchor="middle">LIVE MAP</text>
            </g>
            <path d="M890 230 Q950 260 966 312" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3">
                <animate attributeName="stroke-dashoffset" values="16;0" dur="0.8s" repeatCount="indefinite" />
            </path>
            <circle cx="0" cy="0" r="4" fill="#10b981" filter="url(#glow-g)" opacity="0.9">
                <animateMotion dur="0.8s" repeatCount="indefinite" path="M890 230 Q950 260 966 312" />
            </circle>

            {/* Step badges */}
            {[
                [80, 390, '①', '#10b981', 'Vehicle'],
                [210, 390, '②', '#10b981', 'Tracker'],
                [350, 390, '③', '#6366f1', 'SIM'],
                [490, 390, '④', '#f59e0b', 'Tower'],
                [650, 148, '⑤', '#06b6d4', 'Satellite'],
                [840, 390, '⑥', '#10b981', 'Platform'],
                [995, 420, '⑦', '#10b981', 'Live Map'],
            ].map(([x, y, num, color, label], i) => (
                <g key={i}>
                    <circle cx={x} cy={y - 10} r="10" fill={color} opacity="0.12" />
                    <text x={x} y={y - 6} fill={color} fontSize="10" fontWeight="900" textAnchor="middle">{num}</text>
                    <text x={x} y={y + 8} fill="#334155" fontSize="8" textAnchor="middle">{label}</text>
                </g>
            ))}
        </svg>
    </div>
);



const OnboardingFlow = () => (
    <div className="w-full flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto gap-8 md:gap-4 lg:gap-12 relative mt-20 px-4">
        <div className="absolute top-1/2 left-[10%] w-[80%] h-1 bg-white/5 -translate-y-1/2 hidden md:block z-0 rounded-full" />
        <motion.div className="absolute top-1/2 left-[10%] h-1 bg-gradient-to-r from-[#10b981] via-blue-500 to-[#10b981] -translate-y-1/2 hidden md:block z-0 rounded-full"
            initial={{ width: 0 }}
            whileInView={{ width: "80%" }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            viewport={{ once: true, margin: "-100px" }}
        />

        {[
            { step: '01', title: 'Create Account', desc: 'Secure registration & profile setup in under a minute.', icon: <UserCircle size={40} className="text-white" /> },
            { step: '02', title: 'Hardware Uplink', desc: 'Input your device IMEI to bind asset to your command center.', icon: <Box size={40} className="text-white" /> },
            { step: '03', title: 'Live Pulse', desc: 'Access dashboard and track your fleet in real-time with zero latency.', icon: <Activity size={40} className="text-white" /> }
        ].map((item, i) => (
            <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.8, duration: 0.6, type: "spring" }}
                viewport={{ once: true, margin: "-50px" }}
                className="relative z-10 flex flex-col items-center group w-full md:w-1/3"
            >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-[32px] bg-[#050505] border border-white/10 group-hover:border-[#10b981]/50 shadow-[0_20px_40px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all duration-500 mb-6 md:mb-8 relative group-hover:-translate-y-4">
                    <div className="absolute inset-0 bg-[#10b981]/0 group-hover:bg-[#10b981]/10 rounded-[32px] blur-xl transition-all duration-500" />
                    <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.5 }}>
                        {item.icon}
                    </motion.div>
                    <div className="absolute -top-3 -right-3 md:-top-4 md:-right-4 w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-[#10b981] text-black font-black flex items-center justify-center text-xs md:text-sm shadow-[0_0_20px_rgba(16,185,129,0.5)]">{item.step}</div>
                </div>
                <div className="text-center">
                    <h4 className="text-xl md:text-2xl font-black text-white mb-2 md:mb-3 tracking-tight">{item.title}</h4>
                    <p className="text-xs md:text-sm font-bold text-slate-500 max-w-[240px] mx-auto leading-relaxed">{item.desc}</p>
                </div>
            </motion.div>
        ))}
    </div>
);

const LandingPage = ({ onLogin }) => {
    const navigate = useNavigate();



    return (
        <div className="min-h-screen flex flex-col relative bg-black font-sans selection:bg-[#10b981] selection:text-black text-white overflow-hidden">

            {/* --- PREMIUM NAVBAR --- */}
            <header className="px-6 md:px-12 py-4 flex justify-between items-center z-50 bg-black/60 backdrop-blur-2xl sticky top-0 border-b border-white/5 transition-all duration-300">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/logo.png" alt={CONFIG.PORTAL_NAME} className="w-9 h-9 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.35)] group-hover:scale-110 transition-transform object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    <div className="hidden bg-[#10b981] p-2 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.35)] group-hover:scale-110 transition-transform items-center justify-center">
                        <MapIcon className="text-black" size={20} />
                    </div>
                    <span className="font-black text-2xl tracking-tighter hidden sm:block">
                        {CONFIG.PORTAL_NAME.split(/(?=[A-Z])/).map((part, i) => (
                            <span key={i} className={i === 1 ? 'text-[#10b981]' : ''}>{part.toUpperCase()}</span>
                        ))}
                    </span>
                </div>

                <nav className="hidden lg:flex items-center gap-10 font-black text-xs uppercase tracking-widest text-slate-500">
                    <a href="#features" className="hover:text-[#10b981] transition-colors">Features</a>
                    <a href="#integration" className="hover:text-[#10b981] transition-colors">Integration</a>
                    <a href="#hardware" className="hover:text-[#10b981] transition-colors">Hardware</a>
                </nav>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/login')} className="bg-[#10b981] text-black hover:bg-[#34d399] font-black text-xs uppercase tracking-widest py-3 px-8 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all">Sign In</button>
                </div>
            </header>

            <main className="flex-1 w-full relative">

                {/* --- HERO SECTION --- */}
                <section className="relative pt-16 pb-16 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between max-w-[1400px] mx-auto gap-12">
                    {/* Subtle light-shade background patch */}
                    <div className="absolute inset-0 -mx-12 bg-gradient-to-br from-[#0d1f18]/60 via-transparent to-[#0a1628]/40 rounded-[60px] -z-10 pointer-events-none" />
                    <div className="absolute top-1/4 right-[8%] w-[500px] h-[500px] bg-[#10b981]/8 rounded-full blur-[130px] -z-10 pointer-events-none" />
                    <div className="absolute bottom-1/4 left-[5%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[110px] -z-10 pointer-events-none" />

                    <motion.div
                        initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}
                        className="lg:w-1/2 z-10 text-center lg:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 font-black text-[10px] uppercase tracking-widest mb-8">
                            <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_10px_#10b981] animate-pulse" /> Core Infrastructure V2.0
                        </div>
                        <h1 className="text-6xl lg:text-8xl font-black text-white tracking-tighter leading-[0.9] mb-8">
                            Control <br />
                            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#34d399]">Pulse.</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-slate-400 mb-12 max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
                            The definitive platform for real-time asset intelligence. Experience zero-latency tracking with absolute precision, designed for modern command centers.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start">
                            <button onClick={() => navigate('/login')} className="w-full sm:w-auto bg-[#10b981] hover:bg-[#34d399] text-black font-black py-4 px-10 rounded-2xl shadow-[0_20px_40px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3">
                                Platform Access <ArrowRight size={20} />
                            </button>
                            <button onClick={() => window.location.href = '#features'} className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white font-black py-4 px-10 rounded-2xl border border-white/10 shadow-lg transition-all text-sm uppercase tracking-widest">
                                Take a Tour
                            </button>
                        </div>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Direct Login</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Admin Managed</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Total Security</span>
                        </div>
                    </motion.div>

                    {/* Dashboard Mockup image simulation */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, rotateY: 15 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ duration: 1, delay: 0.2 }}
                        className="lg:w-1/2 relative perspective-1000 w-full"
                    >
                        <div className="relative rounded-[40px] overflow-hidden border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] bg-[#050505] group p-2 hover:border-[#10b981]/20 transition-all duration-700">
                            {/* Ambient glow patches */}
                            <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#10b981]/10 rounded-full blur-[60px] pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none" />

                            <div className="bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/5 relative aspect-[4/3]">
                                {/* Browser Header Bar */}
                                <div className="h-10 border-b border-white/5 flex items-center px-6 gap-3 bg-[#030303] relative z-20">
                                    <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#10b981]/80"></div>
                                    <div className="flex-1 mx-4 h-5 bg-white/[0.03] rounded-md border border-white/5" />
                                    <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981] animate-pulse" />
                                    <span className="text-[8px] font-black text-[#10b981] uppercase tracking-widest">Live Spectrum View</span>
                                </div>

                                {/* Mockup Content Area */}
                                <div className="absolute inset-0 top-10 flex">
                                    {/* Generated Premium Image */}
                                    <img
                                        src="/futuristic_gps_dashboard_hero_1773154679806.png"
                                        alt="Futuristic Dashboard"
                                        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-1000"
                                    />

                                    {/* Sidebar Mock Overlay */}
                                    <div className="w-[22%] h-full border-r border-white/5 flex flex-col bg-[#040404]/80 backdrop-blur-md relative z-10">
                                        <div className="p-3 border-b border-white/5">
                                            <div className="h-6 bg-white/5 rounded-lg w-3/4 mb-2" />
                                            <div className="h-4 bg-white/[0.03] rounded w-full" />
                                        </div>
                                        {[{ color: '#10b981', label: 'Truck Alpha', speed: '65' }, { color: '#3b82f6', label: 'Van Beta', speed: '42' }, { color: '#f59e0b', label: 'Car Gamma', speed: '0' }].map((v, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 border-b border-white/[0.03]">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: v.color + '20' }}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="h-2 bg-white/10 rounded w-full mb-1" />
                                                    <div className="h-1.5 rounded w-2/3" style={{ backgroundColor: v.color + '40' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Map & Alerts Overlay */}
                                    <div className="flex-1 relative overflow-hidden pointer-events-none">
                                        {/* Dynamic Status Badges */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                                            <div className="bg-black/85 backdrop-blur border border-[#10b981]/30 px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
                                                <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center shrink-0">
                                                    <Car size={10} className="text-[#10b981]" />
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black text-white leading-none">Truck Alpha</div>
                                                    <div className="text-[7px] font-black text-[#10b981] uppercase tracking-widest mt-0.5">● Moving • 65 km/h</div>
                                                </div>
                                            </div>
                                            <div className="bg-black/85 backdrop-blur border border-blue-500/30 px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
                                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                                    <Car size={10} className="text-blue-400" />
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black text-white leading-none">Van Beta</div>
                                                    <div className="text-[7px] font-black text-blue-400 uppercase tracking-widest mt-0.5">● Moving • 42 km/h</div>
                                                </div>
                                            </div>
                                            <div className="bg-black/85 backdrop-blur border border-amber-500/30 px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg">
                                                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                                    <Car size={10} className="text-amber-400" />
                                                </div>
                                                <div>
                                                    <div className="text-[9px] font-black text-white leading-none">Car Gamma</div>
                                                    <div className="text-[7px] font-black text-amber-400 uppercase tracking-widest mt-0.5">◎ Idle • 0 km/h</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Floating Alert Mockup */}
                                        <div className="absolute bottom-3 right-3 z-20">
                                            <motion.div
                                                animate={{ opacity: [0, 1, 1, 0], y: [14, 0, 0, -14] }}
                                                transition={{ duration: 8, repeat: Infinity, times: [0, 0.08, 0.92, 1], repeatDelay: 2 }}
                                                className="bg-black/95 backdrop-blur border border-rose-500/60 p-3 rounded-xl w-44 shadow-2xl"
                                            >
                                                <div className="flex items-center gap-2 mb-1.5 text-rose-400">
                                                    <AlertTriangle size={10} className="animate-pulse" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest font-mono">CRITICAL BREACH</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-white mb-0.5">Geofence Violation</div>
                                                <div className="text-[8px] text-slate-400 font-medium">Car Gamma exited Zone Alpha</div>
                                            </motion.div>
                                        </div>

                                        {/* Top stat bar */}
                                        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                                            <div className="bg-black/70 backdrop-blur border border-white/10 px-2 py-1.5 rounded-lg text-center">
                                                <div className="text-[8px] font-black text-slate-500 uppercase">Vehicles</div>
                                                <div className="text-[13px] font-black text-[#10b981]">3</div>
                                            </div>
                                            <div className="bg-black/70 backdrop-blur border border-white/10 px-2 py-1.5 rounded-lg text-center">
                                                <div className="text-[8px] font-black text-slate-500 uppercase">Alerts</div>
                                                <div className="text-[13px] font-black text-rose-500">1</div>
                                            </div>
                                        </div>

                                        {/* SVG Map Elements */}
                                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
                                            {/* Route path trails */}
                                            <path d="M50,250 Q150,150 250,190 T380,50" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.25" strokeDasharray="6 4" />
                                            <path d="M380,270 Q260,200 160,60 T25,25" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.25" strokeDasharray="6 4" />

                                            {/* Geofence Zone - polygon */}
                                            <polygon points="120,215 310,270 355,155 215,100" fill="#3b82f6" fillOpacity="0.06" stroke="#3b82f6" strokeWidth="1" strokeDasharray="6,4" />
                                            <text x="240" y="185" fill="#60a5fa" fontSize="8" fontWeight="700" opacity="0.7">ZONE ALPHA</text>
                                            {/* Zone corner dots */}
                                            {[[120, 215], [310, 270], [355, 155], [215, 100]].map(([cx, cy], i) => (
                                                <circle key={i} cx={cx} cy={cy} r="3" fill="#3b82f6" opacity="0.6" />
                                            ))}

                                            {/* === VEHICLE 1 - Truck Alpha (Green) === */}
                                            <g>
                                                <animateMotion dur="28s" repeatCount="indefinite" path="M50,250 Q150,150 250,190 T380,50" rotate="auto" />
                                                {/* Pulse ring */}
                                                <circle cx="0" cy="0" r="10" fill="rgba(16,185,129,0.15)">
                                                    <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                                                </circle>
                                                {/* Car SVG body (pin shape) */}
                                                <circle cx="0" cy="0" r="9" fill="#10b981" />
                                                <circle cx="0" cy="0" r="9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                                {/* Car silhouette inside pin */}
                                                <g transform="translate(-5,-5) scale(0.58)">
                                                    <rect x="2" y="5" width="14" height="9" rx="2" fill="white" opacity="0.9" />
                                                    <rect x="4" y="2" width="10" height="5" rx="1.5" fill="white" opacity="0.7" />
                                                    <circle cx="4" cy="14" r="2" fill="#065f46" />
                                                    <circle cx="14" cy="14" r="2" fill="#065f46" />
                                                </g>
                                                {/* Speed indicator dot */}
                                                <circle cx="9" cy="-9" r="3" fill="#22c55e" stroke="#0a0a0a" strokeWidth="1">
                                                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
                                                </circle>
                                            </g>

                                            {/* === VEHICLE 2 - Van Beta (Blue) === */}
                                            <g>
                                                <animateMotion dur="33s" repeatCount="indefinite" begin="2s" path="M380,270 Q260,200 160,60 T25,25" rotate="auto" />
                                                {/* Pulse ring */}
                                                <circle cx="0" cy="0" r="10" fill="rgba(59,130,246,0.15)">
                                                    <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                                                </circle>
                                                {/* Van SVG body */}
                                                <circle cx="0" cy="0" r="9" fill="#3b82f6" />
                                                <circle cx="0" cy="0" r="9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                                {/* Van silhouette (taller body) */}
                                                <g transform="translate(-5,-5) scale(0.58)">
                                                    <rect x="2" y="3" width="14" height="11" rx="2" fill="white" opacity="0.9" />
                                                    <rect x="4" y="1" width="8" height="4" rx="1" fill="white" opacity="0.7" />
                                                    <circle cx="4" cy="14" r="2" fill="#1e3a8a" />
                                                    <circle cx="14" cy="14" r="2" fill="#1e3a8a" />
                                                </g>
                                                <circle cx="9" cy="-9" r="3" fill="#60a5fa" stroke="#0a0a0a" strokeWidth="1">
                                                    <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                                                </circle>
                                            </g>

                                            {/* === VEHICLE 3 - Car Gamma (Amber / Parked Alert) === */}
                                            <g transform="translate(190, 175)">
                                                {/* SOS pulse rings */}
                                                <circle cx="0" cy="0" r="6" fill="#f59e0b" opacity="0.9" />
                                                <circle cx="0" cy="0" r="12" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.5">
                                                    <animate attributeName="r" values="8;20;8" dur="1.2s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
                                                </circle>
                                                {/* Small car icon */}
                                                <g transform="translate(-5,-5) scale(0.55)">
                                                    <rect x="2" y="5" width="14" height="9" rx="2" fill="white" opacity="0.9" />
                                                    <rect x="4" y="2" width="10" height="5" rx="1.5" fill="white" opacity="0.7" />
                                                    <circle cx="4" cy="14" r="2" fill="#78350f" />
                                                    <circle cx="14" cy="14" r="2" fill="#78350f" />
                                                </g>
                                            </g>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* --- ONBOARDING JOURNEY SECTION --- */}
                <section id="integration" className="py-28 px-6 md:px-12 relative overflow-hidden border-t border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#10b981]/3 to-transparent pointer-events-none" />
                    <div className="max-w-[1400px] mx-auto text-center">
                        <span className="text-[#10b981] font-black tracking-[0.4em] uppercase text-[10px] mb-4 block">How It Works</span>
                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6">Up & Running in Minutes</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto font-medium mb-12">From registration to live vehicle tracking in just 3 simple steps. No technical expertise required.</p>
                        <OnboardingFlow />
                    </div>
                </section>

                {/* --- FEATURES GRID --- */}
                <section id="features" className="py-28 px-6 md:px-12 max-w-[1400px] mx-auto my-20">
                    <div className="text-center mb-20">
                        <span className="text-[#10b981] font-black tracking-[0.4em] uppercase text-[10px] mb-4 block">Platform Features</span>
                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">Everything You Need</h2>
                        <p className="text-xl text-slate-400 max-w-3xl mx-auto font-medium">A complete GPS fleet management suite — live tracking, alerts, reports, and remote control.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: <MapIcon size={28} />, color: "text-[#10b981]", bg: "bg-[#10b981]/10 border-[#10b981]/20", title: 'Live GPS Tracking', desc: 'Monitor all vehicles in real-time on an interactive map with zero latency.' },
                            { icon: <RouteIcon size={28} />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", title: 'Route History Replay', desc: 'Replay any vehicle\'s route history, stop-by-stop, for any date and time.' },
                            { icon: <Hexagon size={28} />, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", title: 'Geofence Zones', desc: 'Draw custom zones on the map and get instant alerts when vehicles enter or exit.' },
                            { icon: <Bell size={28} />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", title: 'Smart Alerts', desc: 'Instant notifications for overspeed, ignition, tamper, and geofence events.' },
                            { icon: <FileText size={28} />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: 'Fleet Reports', desc: 'Download detailed PDF/Excel reports for trips, fuel, and idle time.' },
                            { icon: <PowerOff size={28} />, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", title: 'Remote Engine Control', desc: 'Cut or restore vehicle engine remotely with a secure 4-digit PIN.' }
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} viewport={{ once: true, margin: '-50px' }}
                                className="bg-white/[0.04] backdrop-blur-sm p-8 rounded-[32px] border border-white/10 hover:border-white/20 transition-all duration-300 group shadow-lg hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] cursor-default hover:bg-white/[0.07]"
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${f.bg} ${f.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                    {f.icon}
                                </div>
                                <h3 className="text-xl font-black mb-3 text-white tracking-tight">{f.title}</h3>
                                <p className="text-slate-400 font-medium leading-relaxed text-sm">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* --- HARDWARE / WIRING ANIMATION COMPONENT --- */}
                <section id="hardware" className="py-28 border-y border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#10b981]/4 via-transparent to-blue-500/4 pointer-events-none" />
                    <div className="max-w-[1400px] mx-auto px-6 relative z-10 text-center">
                        <span className="text-[#10b981] font-black tracking-[0.4em] uppercase text-[10px] mb-4 block">Easy Installation</span>
                        <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter text-white">Device Connection</h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-16 font-medium">Compatible with 1,000+ GPS tracker models. Simple 3-wire connection to your vehicle's battery and ignition.</p>

                        <WiringAnimation />

                        <div className="mt-12 inline-flex items-center gap-4 bg-white/5 backdrop-blur border border-white/10 px-8 py-4 rounded-2xl">
                            <span className="text-[#10b981]"><CheckCircle2 size={24} /></span>
                            <span className="font-black text-white tracking-widest uppercase text-sm">Teltonika • Ruptela • Queclink • Concox Supported</span>
                        </div>
                    </div>
                </section>

                {/* --- CTA SECTION --- */}
                <section className="py-40 px-6 text-center relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#10b981]/10 rounded-full blur-[150px] pointer-events-none -z-10" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}>
                        <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 leading-[0.9]">Ready To Take<br />Control?</h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-medium">Join thousands of clients worldwide using {CONFIG.PORTAL_NAME} for professional fleet intelligence and high-resolution asset tracking.</p>
                        <button onClick={() => navigate('/register')} className="bg-[#10b981] hover:bg-[#34d399] text-black font-black text-lg uppercase tracking-widest py-6 px-16 rounded-[32px] shadow-[0_30px_60px_rgba(16,185,129,0.3)] hover:-translate-y-2 transition-all">
                            Create Account
                        </button>
                    </motion.div>
                </section>

                {/* --- FOOTER --- */}
                <footer className="border-t border-white/5 bg-[#050505] py-16 px-6 md:px-12">
                    <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#10b981] p-2 rounded-xl">
                                <MapIcon className="text-black" size={20} />
                            </div>
                            <span className="font-black text-xl tracking-tighter text-white">{CONFIG.PORTAL_NAME.split(/(?=[A-Z])/)[0]}<span className="text-[#10b981]">{CONFIG.PORTAL_NAME.split(/(?=[A-Z])/).slice(1).join('').toUpperCase()}</span></span>
                        </div>
                        <div className="text-slate-600 font-bold text-xs uppercase tracking-widest">
                            &copy; {new Date().getFullYear()} CORE INFRASTRUCTURE. All rights reserved.
                        </div>
                        <div className="flex gap-8 text-xs font-black uppercase tracking-widest text-slate-500">
                            <a href="#" className="hover:text-[#10b981] transition-colors">Privacy</a>
                            <a href="#" className="hover:text-[#10b981] transition-colors">Terms</a>
                            <a href="#" className="hover:text-[#10b981] transition-colors">Comms</a>
                        </div>
                    </div>
                </footer>
            </main>
        </div >
    );
};


const LoginPage = ({ onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [otpStep, setOtpStep] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSendResetOtp = () => {
        if (!email) {
            setError('Please enter your registered email address first.');
            return;
        }
        setError('');
        setOtpStep(true);
        // Mock OTP is 1234
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (otpInput !== '1234') {
            setError('Invalid OTP. Use 1234 for testing.');
            return;
        }
        if (!newPassword) {
            setError('Please enter a new password.');
            return;
        }
        setIsLoading(true);
        try {
            const req = await fetch(`${API_BASE}/api/auth/reset-password-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, newPassword })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setSuccessMsg('Password Reset Successfully! You can now login.');
                setTimeout(() => {
                    setIsForgotMode(false);
                    setOtpStep(false);
                    setNewPassword('');
                    setOtpInput('');
                    setSuccessMsg('');
                    setPassword('');
                }, 3000);
            } else {
                setError(data.message || 'Failed to reset password.');
            }
        } catch (err) {
            setError('System temporarily unavailable.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e) => {
        if (e) e.preventDefault();

        if (!email || !password) {
            setError('Authentication credentials required.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const req = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await req.json();

            if (data.status === 'SUCCESS') {
                onLogin(data.user);
                navigate(data.user.role === 'ADMIN' ? '/admin' : '/client');
            } else {
                setError(data.message || 'Invalid credentials.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('System temporarily unavailable. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-black font-sans selection:bg-[#10b981] selection:text-black overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0ea5e9]/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-16 overflow-hidden border-r border-white/5">
                <div className="relative z-10 flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-transform bg-black/30 border border-[#10b981]/30 flex items-center justify-center">
                        <MapIcon className="text-[#10b981]" size={24} />
                    </div>
                    <span className="font-black text-2xl text-white tracking-tighter uppercase italic">GEOSURE<span className="text-[#10b981]">PATH</span></span>
                </div>

                <div className="relative z-10">
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                            <Zap size={12} className="fill-current" /> GPS Tracking Platform
                        </div>
                        <h1 className="text-7xl font-black text-white leading-[0.9] tracking-tighter mb-8 italic">
                            Platform <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#34d399]">Access.</span>
                        </h1>
                        <p className="text-slate-500 text-lg max-w-md mb-12 leading-relaxed font-black uppercase tracking-tight">
                            The definitive platform for real-time asset intelligence. Experience zero-latency tracking with absolute precision.
                        </p>
                    </motion.div>
                </div>

                <div className="relative z-10 flex items-center gap-6 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    <span>&copy; {new Date().getFullYear()} CORE OS</span>
                    <button className="hover:text-[#10b981] transition-colors">Infrastructure</button>
                    <button className="hover:text-[#10b981] transition-colors">Security</button>
                </div>
            </div>

            <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative overflow-y-auto custom-scrollbar">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-14 shadow-2xl relative overflow-hidden group hover:border-[#10b981]/30 transition-colors">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/5 rounded-full blur-[80px] group-hover:bg-[#10b981]/10 transition-colors" />

                        <div className="relative z-10 mb-10 pb-6 border-b border-white/10">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter">Login</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Access your dashboard</p>
                        </div>

                        {error && (
                            <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-4 text-rose-500 animate-in slide-in-from-top-2">
                                <AlertCircle size={20} />
                                <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                            </div>
                        )}
                        {(successMsg || (location.state?.registered)) && (
                            <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-4 text-emerald-500 animate-in slide-in-from-top-2">
                                <CheckCircle2 size={20} />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-widest">
                                        {successMsg || `Welcome, ${location.state?.name}!`}
                                    </span>
                                    {location.state?.registered && (
                                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter mt-1">
                                            Registration successful. Please login to continue.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isForgotMode ? (
                            <form onSubmit={handleLogin} className="space-y-8 relative z-10">
                                <div className="space-y-5">
                                    <div className="group">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 pl-1 group-focus-within:text-[#10b981] transition-colors">Email Address</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-[#10b981] transition-colors"><UserCircle size={16} /></div>
                                            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. admin@domain.com" className="w-full pl-12 pr-5 py-4 bg-black/50 border border-white/10 focus:border-[#10b981]/50 rounded-xl outline-none transition-all text-sm font-bold text-white placeholder-slate-600 focus:bg-black/80 shadow-inner" />
                                        </div>
                                    </div>

                                    <div className="group">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 pl-1 group-focus-within:text-[#10b981] transition-colors">Password</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-[#10b981] transition-colors"><Shield size={16} /></div>
                                            <input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Password" className="w-full pl-12 pr-12 py-4 bg-black/50 border border-white/10 focus:border-[#10b981]/50 rounded-xl outline-none transition-all text-sm font-bold text-white placeholder-slate-600 focus:bg-black/80 shadow-inner" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-[#10b981] transition-colors">
                                                {showPassword ? <MapIcon size={16} /> : <Zap size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button disabled={isLoading} type="submit" className="w-full bg-[#10b981] hover:bg-[#059669] text-black py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-3">
                                    {isLoading ? <><RefreshCcw size={16} className="animate-spin" /> Logging in...</> : <>Login <ArrowRight size={16} /></>}
                                </button>

                                <div className="pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                                    <button type="button" onClick={() => { setIsForgotMode(true); setError(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-[#10b981] transition-colors">
                                        Forgot Password?
                                    </button>
                                    <button type="button" onClick={(e) => handleLogin(e, 'ADMIN')} className="px-6 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all">
                                        Force Admin Login
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={otpStep ? handleResetPassword : (e) => { e.preventDefault(); handleSendResetOtp(); }} className="space-y-8 relative z-10">
                                <div className="space-y-5">
                                    <div className="group">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 pl-1 group-focus-within:text-[#10b981] transition-colors">Registered Email</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500"><UserCircle size={16} /></div>
                                            <input required disabled={otpStep} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email to reset" className="w-full pl-12 pr-5 py-4 bg-black/50 border border-white/10 focus:border-[#10b981]/50 rounded-xl outline-none transition-all text-sm font-bold text-white placeholder-slate-600 focus:bg-black/80 shadow-inner" />
                                        </div>
                                    </div>
                                    {otpStep && (
                                        <>
                                            <div className="group animate-in slide-in-from-top-2">
                                                <label className="block text-[9px] font-black text-[#10b981] uppercase tracking-[0.2em] mb-2 pl-1">Secure OTP (Check Mock Email)</label>
                                                <input required type="text" maxLength="4" value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} placeholder="Enter 4-digit OTP code" className="w-full text-center tracking-[0.8em] py-4 border-2 border-[#10b981]/50 rounded-xl font-mono font-black text-2xl outline-none focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/20 transition-all text-white bg-black/50" />
                                                <div className="text-[10px] text-slate-500 mt-2 text-center uppercase tracking-widest font-black">Mock Code: 1234</div>
                                            </div>
                                            <div className="group animate-in slide-in-from-top-2">
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 pl-1 group-focus-within:text-[#10b981] transition-colors">New Password</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500"><Shield size={16} /></div>
                                                    <input required type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Type new password" className="w-full pl-12 pr-12 py-4 bg-black/50 border border-white/10 focus:border-[#10b981]/50 rounded-xl outline-none transition-all text-sm font-bold text-white placeholder-slate-600 focus:bg-black/80 shadow-inner" />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-[#10b981] transition-colors">
                                                        {showPassword ? <MapIcon size={16} /> : <Zap size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button disabled={isLoading} type="submit" className="w-full bg-[#10b981] hover:bg-[#059669] text-black py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-3">
                                    {isLoading ? <RefreshCcw size={16} className="animate-spin" /> : <Shield size={16} />}
                                    {otpStep ? 'Reset Password & Validate' : 'Send Reset OTP Code'}
                                </button>
                                <div className="pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                                    <button type="button" onClick={() => { setIsForgotMode(false); setOtpStep(false); setError(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
                                        Back to Login Sequence
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};


const GeofenceDrawerLayer = ({ drawMode, onComplete }) => {
    const [points, setPoints] = useState([]);

    useMapEvents({
        click(e) {
            if (!drawMode) return;
            const newPoints = [...points, e.latlng];

            if (drawMode === 'circle' && newPoints.length === 2) {
                const radius = newPoints[0].distanceTo(newPoints[1]);
                onComplete({ type: 'CIRCLE', center: newPoints[0], radius });
                // Don't reset points immediately, wait for parent to handle it or for unmount
            } else if (drawMode === 'rectangle' && newPoints.length === 2) {
                onComplete({ type: 'POLYGON', bounds: [newPoints[0], newPoints[1]] });
            } else {
                setPoints(newPoints);
            }
        },
        dblclick(e) {
            L.DomEvent.stopPropagation(e);
            if (drawMode === 'polygon' && points.length >= 3) {
                onComplete({ type: 'POLYGON', points });
            } else if (drawMode === 'route' && points.length >= 2) {
                onComplete({ type: 'ROUTE', points });
            }
        }
    });

    // Reset points when drawMode changes or unmounts
    useEffect(() => {
        return () => setPoints([]);
    }, [drawMode]);

    if (!drawMode) return null;

    return (
        <React.Fragment>
            {points.map((p, i) => (
                <Circle key={i} center={p} radius={5} pathOptions={{ color: '#ef4444' }} />
            ))}
            {drawMode === 'polygon' && points.length > 1 && (
                <Polyline positions={points} pathOptions={{ color: '#ef4444', dashArray: '5,5' }} />
            )}
            {drawMode === 'route' && points.length > 1 && (
                <Polyline positions={points} pathOptions={{ color: '#f59e0b', weight: 4 }} />
            )}
        </React.Fragment>
    );
};
const SimpleTracker = ({ fleet, mapTile = 'satellite', theme, setMapTile, setTheme, user, pendingCommands, setPendingCommands, addToast }) => {
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const selectedVehicle = fleet.find(v => v.id === selectedVehicleId) || null;
    const [isFollowMode, setIsFollowMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Objects');
    const [reportsData, setReportsData] = useState([]);
    const [isReportsLoading, setIsReportsLoading] = useState(false);
    const [reportType, setReportType] = useState('trips'); // 'trips', 'stops', 'summary'
    const [geofences, setGeofences] = useState([]);
    const [alertRules, setAlertRules] = useState([]);
    const [notificationProfile, setNotificationProfile] = useState({ email: '', phone: '', is_email_active: true, is_sms_active: false });
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [geofenceSubTab, setGeofenceSubTab] = useState('Zones'); // 'Zones' or 'Rules'
    const [mapPanTo, setMapPanTo] = useState(null);
    const [currentAlert, setCurrentAlert] = useState(null);
    const [alertHistory, setAlertHistory] = useState([]);

    // Load geofences from backend
    useEffect(() => {
        const loadInitialData = async () => {
            if (!user?.id) return;
            try {
                // Fetch Geofences
                const geoRes = await fetch(`${API_BASE}/api/geofences`);
                const geoData = await geoRes.json();
                if (geoData.status === 'SUCCESS') setGeofences(geoData.geofences || []);

                // Fetch Rules
                fetchRules();

                // Fetch Profile
                fetchNotificationProfile();
            } catch (err) {
                console.warn('Initial data load failed.');
            }
        };
        loadInitialData();
    }, [user?.id]);

    // Listen for real-time alerts from Socket.IO
    useEffect(() => {
        const socket = io(API_BASE, { auth: { userId: user?.id, role: user?.role } });
        socket.on('VEHICLE_ALERT', (alert) => {
            const v = fleet.find(f => f.id === alert.imei);
            const alertWithDetails = { ...alert, vehicleName: v ? v.name : `Device ${alert.imei.slice(-6)}` };
            setCurrentAlert(alertWithDetails);
            setAlertHistory(prev => [alertWithDetails, ...prev].slice(0, 50));
            // try {new Audio('/alert.mp3').play().catch(() => { }); } catch (e) { }
            setTimeout(() => setCurrentAlert(null), 6000);
        });

        socket.on('COMMAND_UPDATE', (update) => {
            addToast({
                type: 'GEOFENCE_ENTER',
                vehicleName: update.vehicleName || `Device ${update.vehicleId}`,
                severity: update.status === 'DELIVERED' ? 'success' : update.status === 'FAILED' ? 'critical' : 'info',
                message: `Command ${update.action}: ${update.status}`,
                timestamp: new Date()
            });
        });

        return () => socket.disconnect();
    }, [fleet, user, alertHistory.length]);

    const [routeHistory, setRouteHistory] = useState([]);

    // --- History Playback State ---
    const [historyMode, setHistoryMode] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinCode, setPinCode] = useState('');
    const [pinError, setPinError] = useState('');
    const [commandLoading, setCommandLoading] = useState(false);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [newRule, setNewRule] = useState({ name: '', type: 'speed', conditions: { limit: 80 } });
    const [ruleLoading, setRuleLoading] = useState(false);
    const [drawMode, setDrawMode] = useState(null); // 'circle', 'rectangle', 'polygon', null
    const [showGeofenceModal, setShowGeofenceModal] = useState(false);
    const [drawnData, setDrawnData] = useState(null);
    const [geofenceName, setGeofenceName] = useState('');

    const handleGeofenceComplete = (data) => {
        setDrawnData(data);
        setShowGeofenceModal(true);
    };

    const fetchRules = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/alerts/rules?user_id=${user.id}`);
            const data = await res.json();
            if (data.status === 'SUCCESS') setAlertRules(data.rules);
        } catch (e) { console.warn("Rules fetch failed", e); }
    };

    const fetchNotificationProfile = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/notifications/profiles?user_id=${user.id}`);
            const data = await res.json();
            if (data.status === 'SUCCESS' && data.profile) setNotificationProfile(data.profile);
        } catch (e) { console.warn("Profile fetch failed", e); }
    };

    const saveGeofence = async () => {
        if (!geofenceName.trim()) return;

        let formattedCoords;
        if (drawnData.type === 'CIRCLE') {
            formattedCoords = [drawnData.center.lat, drawnData.center.lng, drawnData.radius];
        } else if (drawnData.type === 'POLYGON' && drawnData.bounds) {
            formattedCoords = [
                [drawnData.bounds[0].lat, drawnData.bounds[0].lng],
                [drawnData.bounds[1].lat, drawnData.bounds[1].lng],
            ];
        } else if (drawnData.type === 'POLYGON' && drawnData.points) {
            formattedCoords = drawnData.points.map(p => [p.lat, p.lng]);
        } else if (drawnData.type === 'ROUTE' && drawnData.points) {
            formattedCoords = drawnData.points.map(p => [p.lat, p.lng]);
        }

        const newGeofence = {
            id: Date.now(),
            name: geofenceName,
            fence_type: drawnData.type,
            coordinates: formattedCoords
        };

        // Sync to Traccar via backend proxy
        try {
            const res = await fetch(`${API_BASE}/api/geofences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: geofenceName,
                    fence_type: drawnData.type,
                    coordinates: formattedCoords
                })
            });
            const data = await res.json();
            if (data.status === 'SUCCESS' && selectedVehicle) {
                // Link geofence to the current vehicle/device in Traccar
                await fetch(`${API_BASE}/api/permissions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: selectedVehicle.id,
                        geofenceId: data.geofence.id
                    })
                });
                setGeofences(prev => [...prev, { ...data.geofence, coordinates: formattedCoords }]);
            }
        } catch (err) { console.error("Geofence sync failed", err); }
        setDrawMode(null);
        setDrawnData(null);
        setGeofenceName('');
        setShowGeofenceModal(false);
    };

    const saveRule = async () => {
        if (!newRule.name.trim()) return;
        setRuleLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/alerts/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newRule, user_id: user.id })
            });
            if (res.ok) {
                setShowRuleModal(false);
                fetchRules();
            }
        } catch (e) { console.error("Rule save failed", e); }
        setRuleLoading(false);
    };

    const saveProfile = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/notifications/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...notificationProfile, user_id: user.id })
            });
            if (res.ok) setShowNotificationModal(false);
        } catch (e) { console.error("Profile save failed", e); }
    };

    // (Using user from props)
    const [historyRange, setHistoryRange] = useState({
        from: new Date().toISOString().split('T')[0] + 'T00:00',
        to: new Date().toISOString().split('T')[0] + 'T23:59'
    });

    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [storageSource, setStorageSource] = useState('local');

    const handleFetchHistory = async () => {
        if (!selectedVehicle) return;
        setIsHistoryLoading(true);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${API_BASE}/api/history?imei=${selectedVehicle.id}&from=${historyRange.from}&to=${historyRange.to}`, { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                setHistoryData(data.points || []);
                setHistoryIndex(0);
                setHistoryMode(true);
                setStorageSource(data.source === 'cloud_archival' ? 'cloud' : 'local');
                if (data.points?.length > 0) {
                    setMapPanTo([data.points[0].lat, data.points[0].lng]);
                }
            } else {
                alert('No history data found for the selected period.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') console.error('History fetch failed', err);
            alert('Unable to fetch history. Server may be offline.');
        } finally {
            setIsHistoryLoading(false);
        }
    };

    useEffect(() => {
        let timer;
        if (isPlaying && historyIndex < historyData.length - 1) {
            timer = setTimeout(() => {
                setHistoryIndex(prev => prev + 1);
            }, 1000 / playbackSpeed);
        } else {
            setIsPlaying(false);
        }
        return () => clearTimeout(timer);
    }, [isPlaying, historyIndex, historyData.length, playbackSpeed]);

    useEffect(() => {
        if (historyMode && historyData[historyIndex]) {
            setMapPanTo([historyData[historyIndex].lat, historyData[historyIndex].lng]);
        }
    }, [historyIndex, historyMode]);


    // Track movement of selected vehicle to build Polyline
    useEffect(() => {
        if (!selectedVehicle) {
            setRouteHistory([]);
            return;
        }
        setRouteHistory(prev => {
            const last = prev[prev.length - 1];
            if (!last || last[0] !== Number(selectedVehicle.lat) || last[1] !== Number(selectedVehicle.lng)) {
                return [...prev, [Number(selectedVehicle.lat), Number(selectedVehicle.lng)]];
            }
            return prev;
        });
    }, [selectedVehicle?.lat, selectedVehicle?.lng, selectedVehicle?.id]);

    const handleVehicleSelect = (v) => {
        if (selectedVehicleId !== v.id) setRouteHistory([]);
        setSelectedVehicleId(v.id);
        if (v.lat && v.lng) {
            setMapPanTo([Number(v.lat), Number(v.lng)]);
            setIsFollowMode(true); // Auto-enable follow on select
        }
    };

    const handleExecuteCommand = async (e) => {
        e.preventDefault();
        if (pinCode !== '1234') {
            setPinError('INVALID SECURE PIN');
            return;
        }

        setCommandLoading(true);
        setPinError('');
        try {
            const action = selectedVehicle.live_ignition ? 'IGNITION_OFF' : 'IGNITION_ON';
            const res = await fetch(`${API_BASE}/api/commands/send-ignition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId: selectedVehicle.id,
                    action,
                    userId: user.id
                })
            });
            const data = await res.json();

            if (data.status === 'SUCCESS') {
                setShowPinModal(false);
                setPinCode('');
                addToast({
                    type: 'GEOFENCE_ENTER',
                    vehicleName: selectedVehicle.vehicle_number || selectedVehicle.name,
                    severity: 'info',
                    message: data.message,
                    timestamp: new Date()
                });
            } else {
                setPinError(data.message || 'Transmission Failed');
            }
        } catch (err) {
            setPinError('System unreachable. Check backend connectivity.');
        } finally {
            setCommandLoading(false);
        }
    };

    const [commandHistory, setCommandHistory] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const fetchCommandHistory = async (vId) => {
        try {
            const res = await fetch(`${API_BASE}/api/commands/history/${vId}`);
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                setCommandHistory(data.history);
                setShowHistoryModal(true);
            }
        } catch (e) {
            console.error("Command history fetch error", e);
        }
    };

    const [contextMenu, setContextMenu] = useState(null); // { x, y, lat, lng }

    const MapEvents = () => {
        useMapEvents({
            contextmenu: (e) => {
                setContextMenu({
                    x: e.containerPoint.x,
                    y: e.containerPoint.y,
                    lat: e.latlng.lat,
                    lng: e.latlng.lng
                });
            },
            click: () => {
                if (contextMenu) setContextMenu(null);
            }
        });
        return null;
    };

    const filteredFleet = fleet.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden font-sans text-slate-800 dark:text-slate-200 bg-[#e4e5e6] dark:bg-slate-950 relative">
            {/* TRACCAR-STYLE SIDEBAR */}
            <aside className="w-[340px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 z-[100] shadow-md">
                {/* Modernized Search & Control Cluster */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Shield className="text-blue-500" size={18} />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">Live Pulse</span>
                        </div>
                        <button
                            onClick={() => setShowNotificationModal(true)}
                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                        >
                            <SlidersHorizontal size={14} />
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search Assets, IMEI, Plates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-700 dark:text-white"
                        />
                    </div>
                </div>

                {/* Premium Navigation Tabs */}
                <div className="flex px-4 pt-4 gap-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto no-scrollbar">
                    {['Objects', 'Events', 'Geofences', 'Maint.', 'Reports'].map(tab => {
                        const iconMap = { 'Objects': <Car size={14} />, 'Events': <Bell size={14} />, 'Geofences': <MapIcon size={14} />, 'Maint.': <Activity size={14} />, 'Reports': <BarChart3 size={14} /> };
                        const displayTab = tab === 'Maint.' ? 'Maintenance' : tab;
                        const isActive = activeTab === displayTab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(displayTab)}
                                className={`flex-1 flex flex-col items-center gap-1.5 pb-2 transition-all relative min-w-[64px] ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-xl'}`}
                            >
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}>
                                    {iconMap[tab]}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-tighter">{tab}</span>
                                {isActive && (
                                    <motion.div layoutId="sidebarTabUnderline" className="absolute -bottom-[1px] left-2 right-2 h-[3px] bg-blue-600 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-950/20 p-3 space-y-2">
                    {/* Objects List - Traccar Premium Style */}
                    {activeTab === 'Objects' && (
                        <>
                            {filteredFleet.map((v) => (
                                <motion.div
                                    whileHover={{ scale: 1.01, x: 2 }}
                                    key={v.id}
                                    onClick={() => handleVehicleSelect(v)}
                                    className={`p-4 rounded-[28px] border transition-all cursor-pointer group relative overflow-hidden ${selectedVehicle?.id === v.id ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl ring-1 ring-blue-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner transition-colors ${v.status === 'moving' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : v.status === 'idle' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            {VEHICLE_ICON_OPTIONS.find(opt => opt.id === (v.iconType || getVehicleIconPref(v.id)))?.emoji || '🚗'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-black text-slate-900 dark:text-white truncate leading-tight group-hover:text-blue-600 transition-colors">{v.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'moving' ? 'bg-emerald-500 animate-pulse' : v.status === 'idle' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    {v.status || 'Offline'} • {v.lastUpdate ? new Date(v.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-blue-600 italic leading-none">{v.speed} <span className="text-[8px] not-italic opacity-50">KM/H</span></div>
                                            <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{v.id.slice(-6)}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {filteredFleet.length === 0 && (
                                <div className="text-center py-20 opacity-20">
                                    <Car size={48} className="mx-auto mb-4" />
                                    <div className="text-xs font-black uppercase tracking-widest">No matching assets</div>
                                </div>
                            )}
                        </>
                    )}
                    {activeTab === 'Objects' && filteredFleet.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            <Search className="mx-auto mb-2 opacity-50" size={24} />
                            No vehicles found
                        </div>
                    )}

                    {/* Reports Tab */}
                    {activeTab === 'Reports' && (
                        <div className="p-4 flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-800/20">
                            <div className="flex gap-1 mb-4 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                {['trips', 'stops', 'summary'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setReportType(type)}
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${reportType === type ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={async () => {
                                    if (!selectedVehicle) { alert('Please select a vehicle first.'); return; }
                                    setIsReportsLoading(true);
                                    try {
                                        const res = await fetch(`${API_BASE}/api/reports/${reportType}?deviceId=${selectedVehicle.id}&from=${historyRange.from}&to=${historyRange.to}`);
                                        const data = await res.json();
                                        setReportsData(Array.isArray(data) ? data : []);
                                    } catch (err) { alert('Failed to generate report.'); }
                                    finally { setIsReportsLoading(false); }
                                }}
                                className="w-full bg-[#39569c] text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg mb-4 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                            >
                                {isReportsLoading ? <RefreshCcw size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                                {isReportsLoading ? 'Generating...' : `Generate ${reportType} Report`}
                            </button>

                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {reportsData.length === 0 && !isReportsLoading && (
                                    <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2 opacity-50">
                                        <History size={32} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">No report data generated</span>
                                    </div>
                                )}
                                {reportsData.map((item, idx) => (
                                    <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="text-[9px] font-black text-blue-600 uppercase italic">
                                                {reportType === 'trips' ? 'Route Segment' : reportType === 'stops' ? 'Dwell Point' : 'Fleet Summary'}
                                            </div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase">{new Date(item.startTime || item.lastUpdate).toLocaleDateString()}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Distance</div>
                                                <div className="text-sm font-black text-slate-700 dark:text-white">{(item.distance / 1000).toFixed(2)} km</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Speed Avg</div>
                                                <div className="text-sm font-black text-blue-600">{(item.averageSpeed * 1.852).toFixed(1)} km/h</div>
                                            </div>
                                        </div>
                                        {(reportType === 'stops' || reportType === 'trips') && (
                                            <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Duration</div>
                                                <div className="text-xs font-bold text-slate-600">{(item.duration / 3600000).toFixed(1)} hours</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Events tab content */}
                    {activeTab === 'Events' && (
                        <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Recent System Events</div>
                            {alertHistory.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <Activity className="opacity-20" size={32} />
                                    No recent alerts or geofence events.
                                </div>
                            ) : (
                                <div className="space-y-3 pb-20">
                                    {alertHistory.map((alert, idx) => {
                                        const isExit = alert.type === 'GEOFENCE_EXIT';
                                        const isDeviation = alert.type === 'ROUTE_DEVIATION';
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                key={idx}
                                                className={`p-3 rounded-xl border shadow-sm transition-all hover:shadow-md ${isExit ? 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/50' : isDeviation ? 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50' : 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className={`w-2 h-2 rounded-full ${isExit ? 'bg-rose-500 animate-pulse' : isDeviation ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${isExit ? 'text-rose-600' : isDeviation ? 'text-amber-600' : 'text-blue-600'}`}>
                                                        {isExit ? 'Boundary Exit' : isDeviation ? 'Route Deviation' : 'Boundary Entry'}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">{alert.vehicleName}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {isExit ? 'Left' : isDeviation ? 'Deviated via 100m from' : 'Entered'} geofence <span className="font-bold text-slate-700">{alert.fenceName}</span>
                                                </div>
                                                <div className="mt-2 flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                                    <span className="bg-white/50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">{alert.imei.slice(-6)}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Geofences tab content */}
                    {activeTab === 'Geofences' && (
                        <div className="p-4 h-full flex flex-col">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center">
                                <span>Geofence Zones</span>
                                {drawMode && <span className="text-blue-500 animate-pulse text-[10px]">Drawing...</span>}
                            </div>

                            <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800 mb-4">
                                {['Zones', 'Rules'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setGeofenceSubTab(t)}
                                        className={`pb-2 text-xs font-bold transition-all ${geofenceSubTab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {geofenceSubTab === 'Zones' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                                        <button
                                            onClick={() => setDrawMode(drawMode === 'circle' ? null : 'circle')}
                                            className={`p-4 rounded-3xl border-2 transition-all group flex flex-col items-center gap-2 ${drawMode === 'circle' ? 'bg-blue-600 border-blue-600 shadow-xl scale-105 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
                                        >
                                            <div className={`p-2.5 rounded-xl transition-colors ${drawMode === 'circle' ? 'bg-white/10 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                                <CircleIcon size={20} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Circular</span>
                                        </button>
                                        <button
                                            onClick={() => setDrawMode(drawMode === 'route' ? null : 'route')}
                                            className={`p-4 rounded-3xl border-2 transition-all group flex flex-col items-center gap-2 ${drawMode === 'route' ? 'bg-amber-500 border-amber-500 shadow-xl scale-105 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
                                        >
                                            <div className={`p-2.5 rounded-xl transition-colors ${drawMode === 'route' ? 'bg-white/10 text-white' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-500'}`}>
                                                <RouteIcon size={20} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Path Fence</span>
                                        </button>
                                        <button
                                            onClick={() => setDrawMode(drawMode === 'polygon' ? null : 'polygon')}
                                            className={`p-4 rounded-3xl border-2 transition-all group flex flex-col items-center gap-2 ${drawMode === 'polygon' ? 'bg-indigo-600 border-indigo-600 shadow-xl scale-105 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}
                                        >
                                            <div className={`p-2.5 rounded-xl transition-colors ${drawMode === 'polygon' ? 'bg-white/10 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
                                                <Hexagon size={20} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Complex</span>
                                        </button>
                                        <button
                                            onClick={() => setDrawMode(null)}
                                            className="p-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                                        >
                                            <X size={20} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Reset</span>
                                        </button>
                                    </div>

                                    {drawMode && (
                                        <div className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-2 border border-blue-200 dark:border-blue-800 rounded mb-4 shrink-0">
                                            <div className="font-bold">Instructions:</div>
                                            {drawMode === 'circle' && 'Click center, then click outer edge to set radius.'}
                                            {drawMode === 'rectangle' && 'Click one corner, then click opposite corner.'}
                                            {drawMode === 'polygon' && 'Click points to draw shape. Double-click to close.'}
                                            {drawMode === 'route' && 'Click points to draw a path. Double-click to close. Creates a 100m buffer zone.'}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-3 flex-1 overflow-y-auto">
                                    <button
                                        onClick={() => { /* Opem Rule Creation Modal */ }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                    >
                                        <AlertCircle size={14} /> Create Automated Rule
                                    </button>

                                    {alertRules.length === 0 ? (
                                        <div className="text-center py-10 opacity-30">No active rules</div>
                                    ) : (
                                        alertRules.map(rule => (
                                            <div key={rule.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rule.type}</span>
                                                    <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                                                </div>
                                                <div className="font-bold text-xs">{rule.name}</div>
                                                <div className="text-[9px] text-slate-500 mt-1">Triggers: {JSON.stringify(rule.conditions)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pb-20 custom-scrollbar">
                                {geofences.length === 0 ? (
                                    <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center"><Hexagon size={24} /></div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Active Boundaries</div>
                                    </div>
                                ) : (
                                    geofences.map(gf => (
                                        <motion.div
                                            whileHover={{ scale: 1.02, x: 2 }}
                                            key={gf.id}
                                            className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] shadow-sm flex items-center justify-between group transition-all hover:border-blue-200 dark:hover:border-slate-700"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${gf.fence_type === 'ROUTE' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                                    {gf.fence_type === 'ROUTE' ? <RouteIcon size={16} /> : <Hexagon size={16} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[12px] font-black text-slate-800 dark:text-white leading-tight truncate">{gf.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{gf.fence_type} • SECURE</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setGeofences(prev => prev.filter(g => g.id !== gf.id))}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={14} />
                                            </button>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Maintenance tab content */}
                    {activeTab === 'Maintenance' && (
                        <div className="flex-1 h-full overflow-hidden">
                            <Maintenance fleet={fleet} />
                        </div>
                    )}
                </div>
            </aside>

            {/* Right Side Map */}
            <main className="flex-1 relative">
                {/* FLOATING ASSET HUD - PREMIUM OVERLAY */}
                <AnimatePresence>
                    {selectedVehicle && !historyMode && (
                        <motion.div
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            className="absolute top-6 right-6 z-[1000] w-[380px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-800 rounded-[40px] shadow-2xl p-6 overflow-hidden group"
                        >
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/10 transition-colors" />

                            <div className="relative flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-3xl">
                                        {VEHICLE_ICON_OPTIONS.find(o => o.id === (selectedVehicle.iconType || 'car'))?.emoji || '🚗'}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Live Asset</div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{selectedVehicle.name}</h2>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedVehicleId(null)}
                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-900/5 dark:bg-white/5 p-4 rounded-3xl border border-white/20">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Gauge size={10} /> Velocity</div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white italic">{selectedVehicle.speed} <span className="text-[10px] not-italic opacity-40">KM/H</span></div>
                                </div>
                                <div className="bg-slate-900/5 dark:bg-white/5 p-4 rounded-3xl border border-white/20">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapIcon size={10} /> Heading</div>
                                    <div className="text-2xl font-black text-slate-900 dark:text-white italic">{selectedVehicle.heading || 0}° <span className="text-[10px] not-italic opacity-40">DEG</span></div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedVehicle.ignition ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                                            <Zap size={18} fill={selectedVehicle.ignition ? 'currentColor' : 'none'} />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ignition Status</div>
                                            <div className={`text-xs font-black uppercase ${selectedVehicle.ignition ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {selectedVehicle.ignition ? 'Engine Running' : 'Engine Halted'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowPinModal(true)}
                                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedVehicle.ignition ? 'bg-rose-500 text-white shadow-lg' : 'bg-emerald-500 text-black shadow-lg'}`}
                                    >
                                        {selectedVehicle.ignition ? 'Stop Engine' : 'Restore Engine'}
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleFetchHistory}
                                        className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl"
                                    >
                                        History Playback
                                    </button>
                                    <button
                                        onClick={() => setMapPanTo([selectedVehicle.lat, selectedVehicle.lng])}
                                        className="w-14 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-center text-slate-400 hover:text-blue-500 shadow-sm"
                                    >
                                        <Target size={20} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <MapContainer
                    center={[21.1458, 79.0882]}
                    zoom={selectedVehicle ? 14 : 8}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    zoomControl={false}
                    doubleClickZoom={!drawMode}
                >
                    <TileLayer
                        url={
                            mapTile === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' :
                                theme === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
                                    'https://{s}.basemaps.cartocdn.com/voyager_all/{z}/{x}/{y}{r}.png'
                        }
                        attribution='&copy; OpenStreetMap &copy; CARTO'
                    />
                    <MapEvents />

                    {contextMenu && (
                        <div
                            className="absolute z-[2000] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 p-2 min-w-[200px] backdrop-blur-xl pointer-events-auto"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                        >
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">Direct Map Control</div>
                            <button
                                onClick={() => { setDrawnData({ type: 'CIRCLE', center: { lat: contextMenu.lat, lng: contextMenu.lng }, radius: 200 }); setShowGeofenceModal(true); setContextMenu(null); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-600 hover:text-white rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                            >
                                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 group-hover:text-white"><Hexagon size={14} /></div>
                                Create 200m Zone
                            </button>
                            <button
                                onClick={() => { setDrawnData({ type: 'CIRCLE', center: { lat: contextMenu.lat, lng: contextMenu.lng }, radius: 500 }); setShowGeofenceModal(true); setContextMenu(null); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-600 hover:text-white rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter"
                            >
                                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 group-hover:text-white"><CircleIcon size={14} /></div>
                                Create 500m Zone
                            </button>
                            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
                            <button
                                onClick={() => { setContextMenu(null); setMapPanTo([contextMenu.lat, contextMenu.lng]); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-[11px] font-black uppercase tracking-tighter text-slate-500"
                            >
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><MapPin size={14} /></div>
                                Focus Here
                            </button>
                        </div>
                    )}
                    <ZoomControl position="bottomright" />
                    {!historyMode && <MapAutoCenter fleet={fleet} />}
                    <MapController panTo={mapPanTo} />

                    {/* Clustered Vehicles */}
                    <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                        <LayerGroup>
                            {fleet.filter(v => v.lat !== undefined && v.lng !== undefined).map((v) => (
                                <Marker
                                    key={v.id}
                                    position={[Number(v.lat), Number(v.lng)]}
                                    icon={getVehicleIcon({
                                        ...v,
                                        isAlerting: currentAlert?.imei === v.imei
                                    }, v.color || getVehicleColorPref(v.id))}
                                    eventHandlers={{ click: () => handleVehicleSelect(v) }}
                                >
                                    <Popup className="traccar-premium-popup">
                                        <div className="p-4 min-w-[240px] font-sans">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Vehicle Status</div>
                                                    <h3 className="text-sm font-black text-slate-900 leading-tight">{v.vehicle_number}</h3>
                                                </div>
                                                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${v.status === 'moving' ? 'bg-emerald-100 text-emerald-600' :
                                                    v.status === 'idle' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {v.status}
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-5">
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-400 font-bold uppercase tracking-tight">Driver</span>
                                                    <span className="text-slate-700 font-black">{v.driver_name || 'Unassigned'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-400 font-bold uppercase tracking-tight">Speed</span>
                                                    <span className="text-blue-600 font-black">{v.speed} KM/H</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <button
                                                    onClick={() => { setPinCode(''); setPinError(''); setShowPinModal(true); }}
                                                    className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg transition-all ${v.live_ignition ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                                                        }`}
                                                >
                                                    {v.live_ignition ? 'Ignition OFF' : 'Restore Ignition'}
                                                </button>
                                                <button
                                                    onClick={() => handleVehicleSelect(v)}
                                                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Vehicle Info
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => fetchCommandHistory(v.id)}
                                                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all mb-1"
                                            >
                                                <History size={12} /> Command History
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </LayerGroup>

                        {/* LIVE BREADCRUMBS (TRAIL) */}
                        {selectedVehicle && routeHistory.length > 1 && !historyMode && (
                            <Polyline
                                positions={routeHistory}
                                pathOptions={{ color: selectedVehicle.color || '#10b981', weight: 3, opacity: 0.6, dashArray: '5, 10' }}
                            />
                        )}

                        {isFollowMode && selectedVehicle && <MapController panTo={[Number(selectedVehicle.lat), Number(selectedVehicle.lng)]} />}
                    </MarkerClusterGroup>

                    {/* Active Geofences Visualization - Always Visible */}
                    {geofences.map(gf => {
                        const commonProps = {
                            key: gf.id,
                            pathOptions: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 },
                        };
                        const popup = (
                            <Popup>
                                <div className="p-3 min-w-[150px]">
                                    <div className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">{gf.fence_type}</div>
                                    <div className="text-sm font-black text-slate-800">{gf.name}</div>
                                    <button
                                        onClick={() => setGeofences(prev => prev.filter(g => g.id !== gf.id))}
                                        className="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <X size={12} /> Remove Zone
                                    </button>
                                </div>
                            </Popup>
                        );

                        if (gf.fence_type === 'CIRCLE') {
                            return (
                                <Circle {...commonProps} center={[gf.coordinates[0], gf.coordinates[1]]} radius={gf.coordinates[2]}>
                                    {popup}
                                </Circle>
                            );
                        } else if (gf.fence_type === 'rectangle' || (gf.fence_type === 'POLYGON' && gf.coordinates.length === 2)) {
                            return (
                                <Rectangle {...commonProps} bounds={gf.coordinates}>
                                    {popup}
                                </Rectangle>
                            );
                        } else if (gf.fence_type === 'polygon' || (gf.fence_type === 'POLYGON' && gf.coordinates.length > 2)) {
                            return (
                                <Polygon {...commonProps} positions={gf.coordinates}>
                                    {popup}
                                </Polygon>
                            );
                        } else if (gf.fence_type === 'ROUTE') {
                            return (
                                <Polyline {...commonProps} positions={gf.coordinates} pathOptions={{ color: '#f59e0b', weight: 40, opacity: 0.3 }}>
                                    {popup}
                                </Polyline>
                            );
                        }
                        return null;
                    })}

                    <GeofenceDrawerLayer drawMode={drawMode} onComplete={handleGeofenceComplete} />

                    {routeHistory.length > 1 && !historyMode && (
                        <Polyline positions={routeHistory} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} />
                    )}

                    {historyMode && historyData.length > 1 && (
                        <>
                            <Polyline
                                positions={historyData.map(p => [Number(p.lat), Number(p.lng)])}
                                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                            />
                            {historyData[historyIndex] && (
                                <Marker
                                    position={[Number(historyData[historyIndex].lat), Number(historyData[historyIndex].lng)]}
                                    icon={getVehicleIcon({ ...selectedVehicle, status: 'moving', heading: historyData[historyIndex].heading, speed: historyData[historyIndex].speed })}
                                />
                            )}
                            {historyData.map((p, idx) => {
                                if (idx > 0 && p.ignition !== historyData[idx - 1].ignition && p.ignition !== null) {
                                    return (
                                        <Marker
                                            key={`ign-${idx}`}
                                            position={[Number(p.lat), Number(p.lng)]}
                                            icon={new L.DivIcon({
                                                className: 'bg-transparent',
                                                html: `<div class="w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-black text-white ${p.ignition ? 'bg-emerald-500' : 'bg-red-500'}">${p.ignition ? 'ON' : 'OFF'}</div>`
                                            })}
                                        />
                                    )
                                }
                                return null;
                            })}
                        </>
                    )}
                </MapContainer>

                {/* REAL-TIME ALERT OVERLAY ANIMATION */}
                <AnimatePresence>
                    {currentAlert && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 100 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: -50 }}
                            className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none"
                        >
                            <div className={`flex flex-col items-center gap-3 p-6 rounded-[32px] backdrop-blur-xl border shadow-2xl ${currentAlert.type === 'GEOFENCE_EXIT' ? 'bg-rose-500/90 border-rose-400' : 'bg-blue-600/90 border-blue-400'
                                }`}>
                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg animate-bounce">
                                    <span className="text-4xl">
                                        {currentAlert.type === 'GEOFENCE_EXIT' ? '🚪' : currentAlert.type === 'ROUTE_DEVIATION' ? '🛣️' : '📍'}
                                    </span>
                                </div>
                                <div className="text-center text-white">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Critical Event Captured</div>
                                    <h3 className="text-2xl font-black tracking-tight">{currentAlert.vehicleName}</h3>
                                    <p className="text-sm font-bold opacity-90 mt-1">
                                        {currentAlert.type === 'GEOFENCE_EXIT' ? 'Exited Boundary' : currentAlert.type === 'ROUTE_DEVIATION' ? 'Deviation from assigned route detected!' : 'Entered Restricted Boundary'}
                                    </p>
                                    <div className="mt-2 text-[10px] font-mono opacity-60">
                                        IMEI: {currentAlert.imei} | {new Date().toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Geofence Naming Modal */}
                <AnimatePresence>
                    {showGeofenceModal && (
                        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
                            >
                                <div className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Configure Geofence</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Please provide a unique identifier for this security zone.</div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Zone Name</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={geofenceName}
                                            onChange={(e) => setGeofenceName(e.target.value)}
                                            placeholder="e.g., Main Warehouse A"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-800 dark:text-white focus:border-blue-500 focus:outline-none transition-all outline-none font-bold"
                                            onKeyDown={(e) => e.key === 'Enter' && saveGeofence()}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => { setShowGeofenceModal(false); setDrawMode(null); setGeofenceName(''); }}
                                            className="flex-1 py-4 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={saveGeofence}
                                            disabled={!geofenceName.trim()}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-black text-sm text-white shadow-lg shadow-blue-500/30 transition-all uppercase tracking-widest"
                                        >
                                            Save Zone
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Floating Info Panel - DYNAMIC THEME */}
                {selectedVehicle && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-6 left-6 w-[340px] z-[500]"
                    >
                        <div className="bg-white dark:bg-slate-900 rounded shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-sm">
                            <div className="bg-[#39569c] text-white p-3 flex justify-between items-center">
                                <div className="font-semibold flex items-center gap-2">
                                    <Car size={16} /> {selectedVehicle.name}
                                </div>
                                <button onClick={() => setSelectedVehicle(null)} className="hover:text-amber-300 transition-colors"><X size={16} /></button>
                            </div>

                            <div className="p-0">
                                <table className="w-full text-left border-collapse">
                                    <tbody>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-2 bg-slate-50 dark:bg-slate-800/50 w-1/3 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium"><Activity size={14} /> Status</td>
                                            <td className="p-2 font-semibold text-slate-800 dark:text-white">
                                                {selectedVehicle.status === 'moving' ? <span className="text-green-600">Running</span> :
                                                    selectedVehicle.status === 'idle' ? <span className="text-amber-500">Idle</span> :
                                                        <span className="text-red-500">Stop</span>}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium"><Gauge size={14} /> Speed</td>
                                            <td className="p-2 font-semibold text-blue-600">{selectedVehicle.speed} km/h</td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium"><Power size={14} /> Ignition</td>
                                            <td className="p-2 font-semibold">
                                                {selectedVehicle.ignition ? (
                                                    <span className="text-green-600">ON</span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-500">OFF</span>
                                                        <span className="text-[10px] text-red-600 font-black uppercase tracking-tighter mt-0.5">⚠️ Engine Kill Active</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium"><MapPin size={14} /> Location</td>
                                            <td className="p-2 text-xs text-slate-600">
                                                {Number(selectedVehicle.lat).toFixed(5)}, {Number(selectedVehicle.lng).toFixed(5)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="p-3 space-y-1 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                    {[
                                        { label: 'Odometer', value: selectedVehicle.attributes?.totalDistance ? `${(selectedVehicle.attributes.totalDistance / 1000).toFixed(2)} km` : '0.00 km', icon: '📏' },
                                        { label: 'Engine Hours', value: selectedVehicle.attributes?.hours ? `${(selectedVehicle.attributes.hours / 3600000).toFixed(1)} h` : '0.0 h', icon: '⏱️' },
                                        { label: 'Fuel level', value: selectedVehicle.fuel !== undefined ? `${selectedVehicle.fuel}${selectedVehicle.fuel <= 100 ? '%' : ' L'}` : 'N/A', icon: '⛽', color: 'text-emerald-500' },
                                        { label: 'Battery', value: selectedVehicle.battery !== undefined ? `${selectedVehicle.battery}V` : 'N/A', icon: '🔋', color: 'text-amber-500' },
                                        { label: 'Temperature', value: selectedVehicle.temp !== undefined ? `${selectedVehicle.temp}°C` : 'N/A', icon: '🌡️', color: 'text-blue-500' },
                                        { label: 'Contact Phone', value: selectedVehicle.phone || 'N/A', icon: '📱' },
                                        { label: 'Unique ID', value: selectedVehicle.id, icon: '🆔' }
                                    ].map((attr, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-2xl group border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm grayscale group-hover:grayscale-0 transition-opacity opacity-70 group-hover:opacity-100">{attr.icon}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{attr.label}</span>
                                            </div>
                                            <div className={`text-xs font-black ${attr.color || 'text-slate-700 dark:text-white'}`}>{attr.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                <button
                                    onClick={() => setShowIconPicker(!showIconPicker)}
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 py-1.5 rounded text-slate-700 dark:text-slate-300 font-medium flex items-center justify-center gap-1 transition-colors"
                                    title="Change vehicle icon"
                                >
                                    <Car size={14} /> Icon
                                </button>
                                <button
                                    onClick={handleFetchHistory}
                                    disabled={isHistoryLoading}
                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 py-1.5 rounded text-slate-700 dark:text-slate-300 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
                                >
                                    {isHistoryLoading ? <RefreshCcw size={14} className="animate-spin" /> : <History size={14} />}
                                    {isHistoryLoading ? 'Loading...' : 'History'}
                                </button>
                                <button
                                    onClick={() => { setPinCode(''); setPinError(''); setShowPinModal(true); }}
                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded font-medium flex items-center justify-center gap-1 transition-colors shadow-sm"
                                >
                                    <Shield size={14} /> Command
                                </button>
                            </div>

                            {/* Icon & Color Picker Grid */}
                            <AnimatePresence>
                                {showIconPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-slate-200 overflow-hidden"
                                    >
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800">
                                            {/* Header */}
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vehicle Type</span>
                                                <button onClick={() => setShowIconPicker(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                            </div>
                                            {/* Icon Grid — 4 columns */}
                                            <div className="grid grid-cols-4 gap-1">
                                                {VEHICLE_ICON_OPTIONS.map(opt => {
                                                    const currentIcon = selectedVehicle?.iconType || getVehicleIconPref(selectedVehicle?.id);
                                                    const isActive = currentIcon === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => {
                                                                setVehicleIconPref(selectedVehicle.id, opt.id);
                                                                setSelectedVehicle(prev => ({ ...prev, iconType: opt.id }));
                                                                setFleet(prev => prev.map(fv => fv.id === selectedVehicle.id ? { ...fv, iconType: opt.id } : fv));
                                                            }}
                                                            className={`flex flex-col items-center py-1.5 px-1 rounded-lg border transition-all text-center ${isActive
                                                                ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-300'
                                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                                                                }`}
                                                            title={opt.label}
                                                        >
                                                            <span className="text-lg leading-none">{opt.emoji}</span>
                                                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{opt.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {/* Color Swatches */}
                                            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Pin Color</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {PIN_COLOR_OPTIONS.map(c => {
                                                        const currentColor = selectedVehicle?.color || getVehicleColorPref(selectedVehicle?.id) || '#10b981';
                                                        const isActive = currentColor === c.id;
                                                        return (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setVehicleColorPref(selectedVehicle.id, c.id);
                                                                    setSelectedVehicle(prev => ({ ...prev, color: c.id }));
                                                                    setFleet(prev => prev.map(fv => fv.id === selectedVehicle.id ? { ...fv, color: c.id } : fv));
                                                                }}
                                                                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${isActive ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400 scale-110' : 'border-white shadow-sm'
                                                                    }`}
                                                                style={{ backgroundColor: c.id }}
                                                                title={c.label}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                        </div>
                    </motion.div>
                )}

                {/* Floating map tile toggle - top right */}
                <div className="absolute top-3 left-3 z-[600] flex gap-2">
                    <button
                        onClick={() => setMapTile(mapTile === 'satellite' ? 'street' : 'satellite')}
                        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
                    >
                        <MapPin size={12} />
                        {mapTile === 'satellite' ? '🛣️ Street' : '🛰️ Satellite'}
                    </button>
                    {selectedVehicle && (
                        <button
                            onClick={() => setIsFollowMode(!isFollowMode)}
                            className={`backdrop-blur-sm border px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm transition-all flex items-center gap-1.5 ${isFollowMode
                                ? 'bg-blue-600 text-white border-blue-500'
                                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'
                                }`}
                        >
                            <Shield size={12} className={isFollowMode ? 'animate-pulse' : ''} />
                            {isFollowMode ? 'Lock On' : 'Follow Mode'}
                        </button>
                    )}
                </div>

                {/* History Date Range + Player Bar */}
                {historyMode ? (
                    <div className="absolute top-4 right-4 z-[600] bg-white dark:bg-slate-900 rounded shadow-md border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 min-w-[320px]">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-700">History Playback</span>
                            <button onClick={() => { setHistoryMode(false); setHistoryData([]); }} className="text-slate-400 hover:text-red-500 transition"><X size={16} /></button>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button onClick={() => setIsPlaying(!isPlaying)} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">
                                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                            <div className="flex flex-col flex-1">
                                <div className="flex justify-between items-center text-[10px] text-slate-600 mb-2">
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                            {historyData[historyIndex] ? new Date(historyData[historyIndex].timestamp).toLocaleTimeString() : '--:--:--'}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold">
                                            {historyData[historyIndex] ? new Date(historyData[historyIndex].timestamp).toLocaleDateString() : '--/--/--'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${historyData[historyIndex]?.ignition === false ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {historyData[historyIndex]?.ignition === false ? 'STATIONARY' : 'ACTIVE'}
                                        </span>
                                        <span className="font-black text-blue-600 italic text-sm">
                                            {Math.round(historyData[historyIndex]?.speed || 0)} <span className="text-[10px] not-italic text-slate-400">KM/H</span>
                                        </span>
                                    </div>
                                </div>
                                <input
                                    type="range" min="0" max={historyData.length - 1} value={historyIndex}
                                    onChange={(e) => setHistoryIndex(parseInt(e.target.value))}
                                    className="w-full accent-blue-600 h-1.5"
                                />
                            </div>
                            <select
                                value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                className="text-xs border border-slate-300 dark:border-slate-700 rounded p-1 outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-white"
                            >
                                <option value="1">1x</option>
                                <option value="2">2x</option>
                                <option value="5">5x</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    /* History date range controls (visible when vehicle selected but not in history mode) */
                    selectedVehicle && (
                        <div className="absolute top-3 right-3 z-[600] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-md shadow-sm p-2 flex gap-2 items-center">
                            <input
                                type="datetime-local"
                                value={historyRange.from}
                                onChange={e => setHistoryRange(r => ({ ...r, from: e.target.value }))}
                                className="text-[10px] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800"
                            />
                            <span className="text-[10px] text-slate-400">→</span>
                            <input
                                type="datetime-local"
                                value={historyRange.to}
                                onChange={e => setHistoryRange(r => ({ ...r, to: e.target.value }))}
                                className="text-[10px] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800"
                            />
                        </div>
                    )
                )}

                {/* Command Modal */}
                <AnimatePresence>
                    {showPinModal && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-[340px] overflow-hidden"
                            >
                                {/* Header */}
                                <div className={`p-5 text-white flex items-center gap-3 ${selectedVehicle?.ignition ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-emerald-600 to-green-500'
                                    }`}>
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                        {selectedVehicle?.ignition ? '🔴' : '🟢'}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-widest opacity-80">Secure Command</div>
                                        <div className="text-base font-black">
                                            {selectedVehicle?.ignition ? 'Engine Cut (Immobilize)' : 'Engine Restore (Activate)'}
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle info strip */}
                                <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-3 flex items-center gap-2">
                                    <Car size={14} className="text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-600">{selectedVehicle?.name}</span>
                                    <span className="ml-auto text-[10px] font-mono text-slate-400">{selectedVehicle?.id}</span>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleExecuteCommand} className="p-5 space-y-4">
                                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        This action will&nbsp;
                                        <span className={`font-bold ${selectedVehicle?.ignition ? 'text-red-600' : 'text-emerald-600'
                                            }`}>
                                            {selectedVehicle?.ignition ? 'cut the engine and immobilize' : 'restore engine power to'}
                                        </span>
                                        &nbsp;the selected vehicle. Enter your 4-digit PIN to confirm.
                                    </div>

                                    {pinError && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2">
                                            <Shield size={12} /> {pinError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            🔐 Enter PIN to Confirm
                                        </label>
                                        <input
                                            type="password" maxLength="4" autoFocus
                                            value={pinCode}
                                            onChange={(e) => setPinCode(e.target.value)}
                                            placeholder="••••"
                                            className="w-full text-center tracking-[0.8em] py-3 px-4 border-2 border-slate-300 dark:border-slate-700 rounded-xl font-mono font-black text-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowPinModal(false)}
                                            className="flex-1 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-colors border border-slate-200 dark:border-slate-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={commandLoading || pinCode.length < 4}
                                            className={`flex-1 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all disabled:opacity-50 ${selectedVehicle?.live_ignition
                                                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'
                                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                                                }`}
                                        >
                                            {commandLoading ? '⏳ Sending...' : (selectedVehicle?.live_ignition ? '✂️ Cut Ignition' : '✅ Restore Ignition')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}

                    <CommandHistoryModal
                        isOpen={showHistoryModal}
                        onClose={() => setShowHistoryModal(false)}
                        history={commandHistory}
                        vehicleName={selectedVehicle?.vehicle_number}
                    />

                    {/* Notification Center Modal */}
                    {showNotificationModal && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
                            >
                                <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                                    <h3 className="font-bold flex items-center gap-2"><Bell size={18} /> Notification Center</h3>
                                    <button onClick={() => setShowNotificationModal(false)}><X size={20} /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Recipient Email</label>
                                        <input
                                            type="email"
                                            value={notificationProfile.email}
                                            onChange={e => setNotificationProfile({ ...notificationProfile, email: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm"
                                            placeholder="alerts@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">SMS Number</label>
                                        <input
                                            type="tel"
                                            value={notificationProfile.phone}
                                            onChange={e => setNotificationProfile({ ...notificationProfile, phone: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm"
                                            placeholder="+1234567890"
                                        />
                                    </div>
                                    <button
                                        onClick={saveProfile}
                                        className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm shadow-md"
                                    >
                                        Save Channels
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Rule Creation Modal */}
                    {showRuleModal && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
                            >
                                <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                                    <h3 className="font-bold flex items-center gap-2"><ShieldAlert size={18} /> New Automated Rule</h3>
                                    <button onClick={() => setShowRuleModal(false)}><X size={20} /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Rule Name</label>
                                        <input
                                            type="text"
                                            value={newRule.name}
                                            onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm"
                                            placeholder="Security Alert"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Rule Type</label>
                                        <select
                                            value={newRule.type}
                                            onChange={e => setNewRule({ ...newRule, type: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm"
                                        >
                                            <option value="speed">Speed Limit Violation</option>
                                            <option value="ignition">Ignition Status Change</option>
                                            <option value="geofence">Geofence Boundary Alert</option>
                                        </select>
                                    </div>
                                    {newRule.type === 'speed' && (
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Speed Limit (km/h)</label>
                                            <input
                                                type="number"
                                                value={newRule.conditions.limit}
                                                onChange={e => setNewRule({ ...newRule, conditions: { ...newRule.conditions, limit: parseInt(e.target.value) } })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm"
                                            />
                                        </div>
                                    )}
                                    <button
                                        onClick={saveRule}
                                        disabled={ruleLoading}
                                        className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm shadow-md"
                                    >
                                        {ruleLoading ? 'Saving...' : 'Activate Rule'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Geofence Save Modal */}
                    {showGeofenceModal && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                                className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-white/20"
                            >
                                <div className="p-8 bg-blue-600 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                                    <h3 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3 relative z-10">
                                        <Hexagon size={24} /> Seal Boundary
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-2 relative z-10">Define protection zone parameters</p>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Identity Name</label>
                                        <input
                                            type="text"
                                            value={geofenceName}
                                            onChange={e => setGeofenceName(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-blue-500 transition-all"
                                            placeholder="e.g. ALPHA_ZONE_1"
                                        />
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Geometry Intel</div>
                                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                            Type: <span className="text-blue-500 font-black">{drawnData?.type}</span>
                                        </div>
                                        {drawnData?.type === 'CIRCLE' && (
                                            <div className="text-[10px] text-slate-500 mt-1">Radius: {Math.round(drawnData.radius)} meters</div>
                                        )}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => { setShowGeofenceModal(false); setDrawnData(null); }}
                                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-all"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={saveGeofence}
                                            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            Authorize Zone
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};


const CommandHistoryModal = ({ isOpen, onClose, history, vehicleName }) => {
    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20"
                >
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
                                <History size={24} className="text-blue-500" /> Command Archive
                            </h3>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Audit trail for {vehicleName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                    <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {history.length === 0 ? (
                            <div className="text-center py-20 opacity-20">
                                <FileText size={48} className="mx-auto mb-4" />
                                <div className="text-xs font-black uppercase tracking-widest">No Commands Sent Yet</div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((h, i) => (
                                    <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${h.action === 'IGNITION_OFF' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                            }`}>
                                            {h.action === 'IGNITION_OFF' ? '🔴' : '🟢'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{h.action}</div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${h.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-600' :
                                                    h.status === 'FAILED' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {h.status}
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                By: {h.user_name || 'System Admin'} • {new Date(h.sent_at).toLocaleString()}
                                            </div>
                                            {h.response && (
                                                <div className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg text-[10px] font-mono text-slate-500 truncate">
                                                    REP: {h.response}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button onClick={onClose} className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest">Close Registry</button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};


// --- DASHBOARDS ---


export default function App() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('portal_user_session');
        return saved ? JSON.parse(saved) : null;
    });

    const [fleet, setFleet] = useState([]);
    const [pendingCommands, setPendingCommands] = useState({}); // {imei: {type, timestamp} }
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [mapTile, setMapTile] = useState(localStorage.getItem('mapTile') || 'street');
    useEffect(() => { localStorage.setItem('mapTile', mapTile); }, [mapTile]);
    useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
    const [wsStatus, setWsStatus] = useState('disconnected');

    // --- Global Notification Toast State ---
    const [toasts, setToasts] = useState([]);
    const addToast = (alert) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [{ ...alert, id, createdAt: new Date() }, ...prev].slice(0, 6));
        // Play tone based on severity
        const toneId = getSavedToneId();
        const isSerious = ['critical'].includes(alert.severity);
        if (isSerious) playSeriousAlert(toneId);
        else playNormalAlert(toneId);
    };
    const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('portal_user_session', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('portal_user_session');
    };



    useEffect(() => {
        const fetchFleet = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/vehicles`);
                const data = await res.json();

                if (data.status === 'SUCCESS') {
                    const traccarFleet = data.vehicles.map(v => ({
                        id: v.id,
                        vehicle_number: v.vehicle_number,
                        name: v.vehicle_number, // Fallback for components using .name
                        driver_name: v.driver_name,
                        imei: v.imei,
                        protocol: v.protocol,
                        model: v.device_model,
                        sim_number: v.sim_number,
                        status: v.speed > 5 ? 'moving' : (v.live_ignition ? 'idle' : 'stopped'),
                        speed: Math.round(v.speed || 0),
                        ignition: v.live_ignition,
                        live_ignition: v.live_ignition,
                        lat: v.latitude || 21.0,
                        lng: v.longitude || 79.0,
                        lastUpdate: v.last_update || Date.now(),
                        type: 'car', // Default
                        iconType: getVehicleIconPref(v.id),
                        color: getVehicleColorPref(v.id)
                    }));
                    setFleet(traccarFleet);
                }
            } catch (err) {
                console.warn('Fleet fetch failed:', err);
                setFleet([]);
            }
        };

        fetchFleet();
        const interval = setInterval(fetchFleet, 3000);

        // Socket.IO for real-time updates
        const socket = io(API_BASE, {
            auth: {
                userId: user?.id,
                role: user?.role
            }
        });

        socket.on('connect', () => setWsStatus('connected'));
        socket.on('LOCATION_UPDATE', (msg) => {
            if (msg.imei) {
                setFleet(prev => {
                    const updated = prev.map(v => {
                        if (v.id !== msg.imei) return v;
                        const prevIgnition = v.ignition;
                        const newIgnition = msg.ignition === '1' || msg.ignition === true || (parseInt(msg.speed) > 0);
                        const newV = {
                            ...v,
                            lat: parseFloat(msg.lat),
                            lng: parseFloat(msg.lng),
                            speed: parseInt(msg.speed) || 0,
                            heading: parseInt(msg.heading) || 0,
                            status: (parseInt(msg.speed) > 2) ? 'moving' : (newIgnition ? 'idle' : 'stopped'),
                            ignition: newIgnition,
                            fuel: msg.fuel || v.fuel,
                            battery: msg.battery || v.battery,
                            temp: msg.temp || v.temp,
                            lastUpdate: msg.timestamp || Date.now()
                        };

                        // Command Confirmation check
                        const pending = pendingCommands[msg.imei];
                        if (pending) {
                            const targetIgnition = pending.type === 'RESTORE_ENGINE';
                            if (newIgnition === targetIgnition) {
                                const newPending = { ...pendingCommands };
                                delete newPending[msg.imei];
                                setPendingCommands(newPending);
                                addToast({
                                    type: 'IGNITION_ON',
                                    vehicleName: v.name,
                                    severity: 'info',
                                    message: `COMMAND CONFIRMED: ${v.name} status updated to ${newIgnition ? 'ON' : 'KILLED'}.`,
                                    timestamp: new Date(),
                                    imei: msg.imei
                                });
                            }
                        }
                        // Emit ignition ON/OFF toast
                        if (prevIgnition !== undefined && prevIgnition !== newIgnition) {
                            const type = newIgnition ? 'IGNITION_ON' : 'IGNITION_OFF';
                            const def = ALERT_TYPES[type];
                            addToast({
                                type,
                                severity: def.severity,
                                icon: def.icon,
                                color: def.color,
                                bg: def.bg,
                                border: def.border,
                                title: def.label,
                                message: `Vehicle "${v.name}" (Plate: ${v.plate_number || 'N/A'}, IMEI: ${v.id}) - ${newIgnition ? 'Ignition switched ON' : 'Ignition switched OFF'}.`,
                                vehicle: { name: v.name, imei: v.id, plate: v.plate_number || 'N/A' },
                                coords: `${parseFloat(msg.lat).toFixed(5)}, ${parseFloat(msg.lng).toFixed(5)}`,
                            });
                        }
                        // Overspeed alert
                        const speedLimit = v.speed_limit || 80;
                        if (parseInt(msg.speed) > speedLimit && v.speed <= speedLimit) {
                            const def = ALERT_TYPES.OVERSPEED;
                            addToast({
                                type: 'OVERSPEED',
                                severity: def.severity,
                                icon: def.icon,
                                color: def.color,
                                bg: def.bg,
                                border: def.border,
                                title: def.label,
                                message: `OVERSPEED: Vehicle "${v.name}" (Plate: ${v.plate_number || 'N/A'}, IMEI: ${v.id}) is speeding at ${msg.speed} km/h (limit: ${speedLimit} km/h).`,
                                vehicle: { name: v.name, imei: v.id, plate: v.plate_number || 'N/A' },
                                coords: `${parseFloat(msg.lat).toFixed(5)}, ${parseFloat(msg.lng).toFixed(5)}`,
                            });
                        }
                        return newV;
                    });
                    return updated;
                });
            }
        });
        // Listen for backend-emitted GPS alerts (SOS, geofence, tamper, etc.)
        socket.on('GPS_ALERT', (alert) => {
            const def = ALERT_TYPES[alert.type] || ALERT_TYPES.GPS_LOST;
            addToast({
                type: alert.type,
                severity: def.severity,
                icon: def.icon,
                color: def.color,
                bg: def.bg,
                border: def.border,
                title: def.label,
                message: alert.message || `Alert triggered for IMEI ${alert.imei}.`,
                vehicle: {
                    name: alert.vehicleName || alert.imei,
                    imei: alert.imei,
                    plate: alert.plateNumber || alert.plate || 'N/A'
                },
                coords: alert.lat && alert.lng ? `${parseFloat(alert.lat).toFixed(5)}, ${parseFloat(alert.lng).toFixed(5)}` : 'N/A',
                geofenceName: alert.geofenceName || alert.fenceName || null,
            });
        });
        socket.on('disconnect', () => setWsStatus('disconnected'));

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, [user]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return (
        <ErrorBoundary>
            <Router>
                {/* Global Alert Toast Panel */}
                <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-[380px] max-w-[95vw] pointer-events-none">
                    <AnimatePresence>
                        {toasts.map(toast => {
                            const isSerious = toast.severity === 'critical';
                            return (
                                <motion.div
                                    key={toast.id}
                                    initial={{ opacity: 0, x: 80, scale: 0.92 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 80, scale: 0.88 }}
                                    transition={{ duration: 0.28 }}
                                    className="pointer-events-auto"
                                >
                                    <div
                                        className={`rounded-2xl border-2 shadow-2xl overflow-hidden ${isSerious
                                            ? 'animate-pulse-border'
                                            : ''
                                            }`}
                                        style={{
                                            background: toast.bg || '#fff',
                                            borderColor: toast.border || '#e2e8f0',
                                            boxShadow: isSerious ? `0 0 0 3px ${toast.color}40, 0 10px 30px rgba(0,0,0,0.2)` : '0 10px 30px rgba(0,0,0,0.12)',
                                            animation: isSerious ? 'alertBlink 0.7s ease-in-out infinite alternate' : 'none',
                                        }}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="text-2xl mt-0.5 shrink-0">{toast.icon}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: toast.color }}>
                                                            {isSerious && '🔴 '}{toast.title}
                                                        </span>
                                                        <button
                                                            onClick={() => dismissToast(toast.id)}
                                                            className="text-slate-400 hover:text-slate-600 shrink-0 mt-0.5"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                    <p className="text-sm font-semibold text-slate-800 mt-1 leading-snug">{toast.message}</p>
                                                    {toast.geofenceName && (
                                                        <p className="text-xs text-slate-600 mt-1 font-medium">📌 Zone: <span className="font-bold">{toast.geofenceName}</span></p>
                                                    )}
                                                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-500">
                                                        <span>🚗 {toast.vehicle?.name}</span>
                                                        <span>🪪 {toast.vehicle?.plate}</span>
                                                        <span className="col-span-2">📡 IMEI: {toast.vehicle?.imei}</span>
                                                        <span className="col-span-2">📍 {toast.coords}</span>
                                                        <span className="col-span-2 text-right opacity-60">{toast.createdAt?.toLocaleTimeString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Blink bar for serious alerts */}
                                        {isSerious && (
                                            <div
                                                className="h-1 w-full"
                                                style={{ background: toast.color, animation: 'alertBlink 0.7s ease-in-out infinite alternate' }}
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {!user ? (
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                ) : (
                    <Layout user={user} onLogout={handleLogout}>
                        <Routes>
                            <Route path="/" element={<Navigate to={user.role === 'ADMIN' ? '/admin' : '/client'} replace />} />

                            {user.role === 'ADMIN' && (
                                <>
                                    <Route path="/admin" element={<Dashboard type="ADMIN" fleet={fleet} user={user} onLogin={handleLogin} />} />
                                    <Route path="/command-center" element={<CommandCenter fleet={fleet} />} />
                                </>
                            )}

                            <Route path="/client" element={<Dashboard type="CLIENT" fleet={fleet} user={user} onLogin={handleLogin} />} />
                            <Route path="/live" element={
                                <SimpleTracker
                                    fleet={fleet}
                                    mapTile={mapTile}
                                    theme={theme}
                                    setMapTile={setMapTile}
                                    setTheme={setTheme}
                                    user={user}
                                    pendingCommands={pendingCommands}
                                    setPendingCommands={setPendingCommands}
                                    addToast={addToast}
                                />
                            } />
                            <Route path="/reports" element={<Reports fleet={fleet} />} />
                            <Route path="/maintenance" element={<Maintenance fleet={fleet} />} />
                            <Route path="/settings" element={<Settings user={user} fleet={fleet} theme={theme} setTheme={setTheme} />} />
                            <Route path="*" element={<Navigate to={user.role === 'ADMIN' ? '/admin' : '/client'} replace />} />
                        </Routes>
                    </Layout>
                )}
            </Router>
        </ErrorBoundary>
    );
}
