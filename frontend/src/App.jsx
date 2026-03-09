import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import Settings from './components/Settings';
import CommandCenter from './components/CommandCenter';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Map as MapIcon, Shield, Activity, Users, Settings as SettingsIcon, LogIn, ChevronRight,
    Car, Bell, PowerOff, Battery, Thermometer, Box, Database, Search, Filter,
    LogOut, Crosshair, ArrowRight, CheckCircle2, AlertTriangle, PlayCircle,
    FileText, CreditCard, Droplet, LayoutDashboard, Zap, Menu, X, Hexagon, Route as RouteIcon,
    TrendingDown, CheckSquare, Wrench, FolderOpen, UserCircle, Briefcase, Share2, FileWarning, Smartphone, Monitor, Rocket, Server, DollarSign,
    Play, Pause, FastForward, SkipBack, Rewind, Calendar as CalendarIcon, History,
    Gauge, Power, MapPin, RefreshCcw, Plus, KeyRound, Eye, EyeOff, Hash, AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, ZoomControl, Polyline, LayerGroup, useMap, useMapEvents, Circle, Rectangle, Polygon } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Draggable from 'react-draggable';
import { io } from 'socket.io-client';

// --- Helper: Map pan controller (react-leaflet v5 compatible, avoids whenReady) ---
function MapController({ panTo }) {
    const map = useMap();
    useEffect(() => {
        if (panTo && panTo.length === 2 && !isNaN(panTo[0]) && !isNaN(panTo[1])) {
            map.panTo(panTo);
        }
    }, [panTo, map]);
    return null;
}

// --- Dynamic API Base URLs to support both local dev and AWS deployment ---
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : `${window.location.protocol}//${window.location.hostname}`;

const WS_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:8080'
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}`;

const TRACCAR_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : `${window.location.protocol}//${window.location.hostname}/traccar`;

// --- VEHICLE COLOR PALETTE (8 distinct colors for up to 8 vehicles) ---
const VEHICLE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const getVehicleColor = (idx) => VEHICLE_COLORS[idx % VEHICLE_COLORS.length];

// --- ALL GPS ALERT TYPES (GEOSUREPATH-style) ---
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
} from './utils/statusIcons';

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
                <text x="0" y="-20" fill="#10b981" fontSize="8" fontWeight="900" textAnchor="middle">GeoSurePath</text>
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
                <text x="0" y="6" fill="#10b981" fontSize="9" fontWeight="900" textAnchor="middle">GeoSurePath</text>
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
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [demoContact, setDemoContact] = useState('');
    const [isDemoLoading, setIsDemoLoading] = useState(false);
    const [demoError, setDemoError] = useState('');

    const handleDemoStart = async (e) => {
        e.preventDefault();
        if (!demoContact) {
            setDemoError("Please enter your email or mobile number.");
            return;
        }
        setIsDemoLoading(true);
        setDemoError('');
        try {
            const req = await fetch(`${API_BASE}/api/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact: demoContact })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                if (onLogin) onLogin(data.user);
                navigate('/client');
            } else {
                setDemoError(data.message || 'Failed to start demo.');
            }
        } catch (err) {
            console.error('Demo fetch error:', err);
            // Fallback for dev without DB connectivity
            if (onLogin) onLogin({ id: 'demo_local', name: 'Demo Guest', email: demoContact, role: 'CLIENT', isDemo: true });
            navigate('/client');
        } finally {
            setIsDemoLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative bg-black font-sans selection:bg-[#10b981] selection:text-black text-white overflow-hidden">

            {/* --- PREMIUM NAVBAR --- */}
            <header className="px-6 md:px-12 py-4 flex justify-between items-center z-50 bg-black/60 backdrop-blur-2xl sticky top-0 border-b border-white/5 transition-all duration-300">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/logo.png" alt="GeoSurePath" className="w-9 h-9 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.35)] group-hover:scale-110 transition-transform object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    <div className="hidden bg-[#10b981] p-2 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.35)] group-hover:scale-110 transition-transform items-center justify-center">
                        <MapIcon className="text-black" size={20} />
                    </div>
                    <span className="font-black text-2xl tracking-tighter hidden sm:block">GEOSURE<span className="text-[#10b981]">PATH</span></span>
                </div>

                <nav className="hidden lg:flex items-center gap-10 font-black text-xs uppercase tracking-widest text-slate-500">
                    <a href="#features" className="hover:text-[#10b981] transition-colors">Features</a>
                    <a href="#integration" className="hover:text-[#10b981] transition-colors">Integration</a>
                    <a href="#hardware" className="hover:text-[#10b981] transition-colors">Hardware</a>
                </nav>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/login')} className="hidden sm:flex font-black text-xs uppercase tracking-widest text-slate-400 hover:text-white transition-colors px-4 py-2">Sign In</button>
                    <button onClick={() => navigate('/register')} className="bg-[#10b981] text-black hover:bg-[#34d399] font-black text-xs uppercase tracking-widest py-3 px-8 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all">Create Account</button>
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
                            <button onClick={() => setShowDemoModal(true)} className="w-full sm:w-auto bg-[#10b981] hover:bg-[#34d399] text-black font-black py-4 px-10 rounded-2xl shadow-[0_20px_40px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3">
                                Demo for 1 hr <ArrowRight size={20} />
                            </button>
                            <button onClick={() => window.location.href = '#features'} className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white font-black py-4 px-10 rounded-2xl border border-white/10 shadow-lg transition-all text-sm uppercase tracking-widest">
                                Take a Tour
                            </button>
                        </div>
                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Direct Login</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Dummy Data & Alerts</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-[#10b981]" size={16} /> Setup Geofencing</span>
                        </div>
                    </motion.div>

                    {/* Dashboard Mockup image simulation */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, rotateY: 15 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ duration: 1, delay: 0.2 }}
                        className="lg:w-1/2 relative perspective-1000 w-full"
                    >
                        <div className="relative rounded-[40px] overflow-hidden border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] bg-[#050505] group p-2 hover:border-[#10b981]/20 transition-all duration-700">
                            {/* Ambient glow top-right */}
                            <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#10b981]/10 rounded-full blur-[60px] pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none" />
                            <div className="bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/5 relative aspect-[4/3]">
                                {/* Browser Header Bar */}
                                <div className="h-10 border-b border-white/5 flex items-center px-6 gap-3 bg-[#030303]">
                                    <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#10b981]/80"></div>
                                    <div className="flex-1 mx-4 h-5 bg-white/[0.03] rounded-md border border-white/5" />
                                    <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981] animate-pulse" />
                                    <span className="text-[8px] font-black text-[#10b981] uppercase tracking-widest">Live</span>
                                </div>
                                {/* Mockup Content */}
                                <div className="absolute inset-0 top-10 flex">
                                    {/* Sidebar Mock */}
                                    <div className="w-[22%] h-full border-r border-white/5 flex flex-col bg-[#040404]">
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
                                    {/* Main Area Map Mock */}
                                    <div className="flex-1 relative overflow-hidden bg-[#0c1220]">
                                        {/* Atmospheric grid */}
                                        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                                        {/* Radial glow center */}
                                        <div className="absolute inset-0 bg-gradient-radial from-[#10b981]/5 via-transparent to-transparent" style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(16,185,129,0.08) 0%, transparent 60%)' }} />
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

                                        {/* Vehicle Status Cards */}
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

                                        {/* Alert notification */}
                                        <div className="absolute bottom-3 right-3 z-20">
                                            <motion.div
                                                animate={{ opacity: [0, 1, 1, 0], y: [14, 0, 0, -14] }}
                                                transition={{ duration: 8, repeat: Infinity, times: [0, 0.08, 0.92, 1], repeatDelay: 2 }}
                                                className="bg-black/90 backdrop-blur border border-rose-500/60 p-3 rounded-xl w-44 shadow-[0_8px_24px_rgba(239,68,68,0.25)]"
                                            >
                                                <div className="flex items-center gap-2 mb-1.5 text-rose-400">
                                                    <AlertTriangle size={10} className="animate-pulse shrink-0" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest">Geofence Alert</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-white mb-0.5">Zone Breach</div>
                                                <div className="text-[8px] text-slate-400 font-medium">Car Gamma exited ZONE ALPHA</div>
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
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-medium">Join us to manage your vehicles and assets with absolute precision using GeoSurePath.</p>
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
                            <span className="font-black text-xl tracking-tighter text-white">GEOSURE<span className="text-[#10b981]">PATH</span></span>
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

            {/* --- DEMO LEAD MODAL --- */}
            <AnimatePresence>
                {showDemoModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#050505] p-8 md:p-12 rounded-[32px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] max-w-md w-full relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#10b981] to-blue-500" />
                            <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Access Demo</h3>
                            <p className="text-slate-400 font-medium mb-8 text-sm">Please provide your email or mobile number to enter the live demo simulation environment.</p>

                            <form onSubmit={handleDemoStart} className="space-y-6">
                                {demoError && <div className="text-rose-500 text-xs font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{demoError}</div>}

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Identifier</label>
                                    <input
                                        type="text"
                                        value={demoContact}
                                        onChange={(e) => setDemoContact(e.target.value)}
                                        placeholder="Mobile Number or Email"
                                        className="w-full px-5 py-4 rounded-2xl bg-black border border-white/5 focus:border-[#10b981]/50 outline-none text-white font-medium transition-all"
                                        required
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowDemoModal(false)} className="px-6 py-4 rounded-2xl text-slate-400 font-bold hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/5">Cancel</button>
                                    <button type="submit" disabled={isDemoLoading} className="flex-1 bg-[#10b981] text-black font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all disabled:opacity-50">
                                        {isDemoLoading ? 'Authorizing...' : 'Launch Simulation'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


const LoginPage = ({ onLogin }) => {
    const navigate = useNavigate();
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
                        {successMsg && (
                            <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-4 text-emerald-500 animate-in slide-in-from-top-2">
                                <CheckCircle2 size={20} />
                                <span className="text-xs font-black uppercase tracking-widest">{successMsg}</span>
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
                                    <button type="button" onClick={() => navigate('/register')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
                                        Create an Account?
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

const RegistrationPage = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mobile, setMobile] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [vehicles, setVehicles] = useState([{ imei: '', name: '', plate: '' }]);
    const [error, setError] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [otpError, setOtpError] = useState('');

    const handleSendOtp = () => {
        if (!/^[0-9]{10}$/.test(mobile)) {
            setOtpError('Enter a valid 10-digit mobile number first.');
            return;
        }
        setOtpError('');
        setOtpSent(true);
        // Mock OTP is 1234
    };

    const handleVerifyOtp = () => {
        if (otpInput === '1234') {
            setIsVerified(true);
            setOtpError('');
            setOtpSent(false);
        } else {
            setOtpError('Invalid OTP. Use 1234 for testing.');
        }
    };


    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!isVerified) {
            setError('Please verify your mobile number via OTP before registering.');
            return;
        }

        const plateRegex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$/i;
        if (vehicles.some(v => !plateRegex.test(v.plate))) {
            setError('Invalid Indian Vehicle Plate format (e.g. MH 12 AB 1234).');
            return;
        }

        if (vehicles.some(v => v.imei.length !== 15 || !/^[0-9]{15}$/.test(v.imei))) {
            setError('All Hardware UUIDs (IMEI) must be exactly 15 digits.');
            return;
        }

        setIsLoading(true);
        try {
            const req = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, mobile, vehicles }) });
            if ((await req.json()).status === 'SUCCESS') navigate('/login');
            else setError('Registration Sequence Failed.');
        } catch { setError('Network Synchronization Error.'); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen flex bg-black font-sans selection:bg-[#10b981] selection:text-black overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0ea5e9]/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-16 overflow-hidden border-r border-white/5">
                <div className="relative z-10 flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-transform bg-black/30 border border-[#10b981]/30 flex items-center justify-center">
                        <MapIcon className="text-[#10b981]" size={24} />
                    </div>
                    <span className="font-black text-2xl text-white tracking-tighter uppercase italic">GEOSURE<span className="text-[#10b981]">PATH</span></span>
                </div>

                <div className="relative z-10">
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                            <Zap size={12} className="fill-current" /> Register Account
                        </div>
                        <h1 className="text-7xl font-black text-white leading-[0.9] tracking-tighter mb-8 italic">
                            Create <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#34d399]">Account.</span>
                        </h1>
                        <p className="text-slate-500 text-lg max-w-md mb-12 leading-relaxed font-black uppercase tracking-tight">
                            Sign up to track your vehicles and manage your assets in real-time.
                        </p>
                    </motion.div>
                </div>

                <div className="relative z-10 flex items-center gap-6 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    <span>&copy; {new Date().getFullYear()} CORE OS</span>
                    <button className="hover:text-[#10b981] transition-colors">Infrastructure</button>
                    <button className="hover:text-[#10b981] transition-colors">Security</button>
                </div>
            </div>

            <div className="w-full lg:w-3/5 flex items-center justify-center p-8 relative overflow-y-auto custom-scrollbar">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 md:p-14 shadow-2xl relative overflow-hidden group hover:border-[#10b981]/30 transition-colors">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#10b981]/5 rounded-full blur-[80px] group-hover:bg-[#10b981]/10 transition-colors" />

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-white/10 gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter">Create Account</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Enter your details to register</p>
                            </div>
                            <button onClick={() => navigate('/login')} className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/10 hover:border-white/20 active:scale-95">
                                Login Instead
                            </button>
                        </div>

                        {error && (
                            <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-4 text-rose-500 animate-in slide-in-from-top-2">
                                <AlertCircle size={20} />
                                <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-10 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] border-l-2 border-[#10b981] pl-3">Account Details</h3>
                                    <div className="space-y-5">
                                        {[
                                            { l: 'Full Name', v: name, s: setName, i: UserCircle, t: 'text', p: 'e.g. John Doe' },
                                            { l: 'Email Address', v: email, s: setEmail, i: MapIcon, t: 'email', p: 'e.g. user@domain.com' },
                                            { l: 'Mobile Number', v: mobile, s: setMobile, i: Smartphone, t: 'tel', p: '10-Digit Mobile Number', isMobile: true },
                                            { l: 'Password', v: password, s: setPassword, i: Shield, t: 'password', p: 'Strong Password' }
                                        ].map((f, i) => (
                                            <div key={i} className="group">
                                                <div className="flex justify-between items-center mb-2 pl-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-[#10b981] transition-colors">{f.l}</label>
                                                    {f.isMobile && isVerified && <span className="text-[#10b981] text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} /> Verified</span>}
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-[#10b981] transition-colors"><f.i size={16} /></div>
                                                    <input required={!f.isMobile || !isVerified} type={f.t} value={f.v} onChange={e => f.s(e.target.value)} disabled={f.isMobile && isVerified} placeholder={f.p} className="w-full pl-12 pr-5 py-4 bg-black/50 border border-white/10 focus:border-[#10b981]/50 rounded-xl outline-none transition-all text-sm font-bold text-white placeholder-slate-600 focus:bg-black/80 shadow-inner disabled:opacity-50" />
                                                    {f.isMobile && !isVerified && !otpSent && (
                                                        <button type="button" onClick={handleSendOtp} className="absolute right-2 top-2 bottom-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Send OTP</button>
                                                    )}
                                                </div>
                                                {f.isMobile && otpSent && (
                                                    <div className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                                        <input type="text" maxLength={4} value={otpInput} onChange={e => setOtpInput(e.target.value)} placeholder="Enter 1234" className="w-full px-4 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 focus:border-blue-500 rounded-xl outline-none text-center text-sm font-black tracking-[0.5em]" />
                                                        <button type="button" onClick={handleVerifyOtp} className="bg-blue-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Verify</button>
                                                    </div>
                                                )}
                                                {f.isMobile && otpError && <div className="mt-2 text-rose-500 text-[9px] font-black uppercase tracking-widest"><AlertTriangle size={10} className="inline mr-1" />{otpError}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] border-l-2 border-[#10b981] pl-3">GPS Devices</h3>
                                        <button type="button" onClick={() => setVehicles([...vehicles, { imei: '', name: '', plate: '' }])} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white hover:bg-[#10b981]/20 hover:text-[#10b981] hover:border-[#10b981]/30 transition-colors shadow-sm">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <div className="space-y-4 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                                        {vehicles.map((v, i) => (
                                            <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                                                <input required maxLength={15} value={v.imei} onChange={e => { const n = [...vehicles]; n[i].imei = e.target.value; setVehicles(n); }} placeholder="15 Digit IMEI" className="w-full px-5 py-3 rounded-xl border border-slate-200 mb-3 text-xs font-black" />
                                                <div className="flex gap-3">
                                                    <input required value={v.name} onChange={e => { const n = [...vehicles]; n[i].name = e.target.value; setVehicles(n); }} placeholder="Asset Name" className="w-1/2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-black" />
                                                    <input required value={v.plate} onChange={e => { const n = [...vehicles]; n[i].plate = e.target.value; setVehicles(n); }} placeholder="Plate ID" className="w-1/2 px-5 py-3 rounded-xl border border-slate-200 text-xs font-black" />
                                                </div>
                                                {vehicles.length > 1 && <button type="button" onClick={() => setVehicles(vehicles.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="pt-10 flex flex-col items-center">
                                {error && <div className="mb-6 p-4 bg-rose-50 rounded-2xl text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-3"><AlertTriangle size={14} /> {error}</div>}
                                <button type="submit" disabled={isLoading} className="w-full max-w-md bg-[#10b981] text-black font-black py-6 rounded-3xl shadow-2xl hover:-translate-y-1 active:scale-95 transition-all text-sm uppercase tracking-[0.3em] flex justify-center items-center gap-4">Register Account <ArrowRight size={20} /></button>
                            </div>
                        </form>
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
                setPoints([]);
            } else if (drawMode === 'rectangle' && newPoints.length === 2) {
                onComplete({ type: 'POLYGON', bounds: [newPoints[0], newPoints[1]] });
                setPoints([]);
            } else {
                setPoints(newPoints);
            }
        },
        dblclick() {
            if (drawMode === 'polygon' && points.length >= 3) {
                onComplete({ type: 'POLYGON', points });
                setPoints([]);
            } else if (drawMode === 'route' && points.length >= 2) {
                onComplete({ type: 'ROUTE', points });
                setPoints([]);
            }
        }
    });

    if (!drawMode || points.length === 0) return null;

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
const SimpleTracker = ({ fleet, mapTile, theme, setMapTile, setTheme, user }) => {
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Objects');
    const [geofences, setGeofences] = useState([]);
    const [mapPanTo, setMapPanTo] = useState(null);
    const [currentAlert, setCurrentAlert] = useState(null);
    const [alertHistory, setAlertHistory] = useState([]);

    // Load geofences from backend
    useEffect(() => {
        const fetchGeofences = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/geofences`);
                const data = await res.json();
                if (data.status === 'SUCCESS') setGeofences(data.geofences || []);
            } catch (err) {
                console.warn('PostGIS/Geofence fetch failed.');
            }
        };
        fetchGeofences();
    }, []);

    // Listen for real-time alerts from Socket.IO
    useEffect(() => {
        const socket = io(API_BASE, { auth: { userId: user?.id, role: user?.role } });
        socket.on('VEHICLE_ALERT', (alert) => {
            const v = fleet.find(f => f.id === alert.imei);
            const alertWithDetails = { ...alert, vehicleName: v ? v.name : `Device ${alert.imei.slice(-6)}` };
            setCurrentAlert(alertWithDetails);
            setAlertHistory(prev => [alertWithDetails, ...prev].slice(0, 50));
            try { new Audio('/beep.txt').play().catch(() => { }); } catch (e) { }
            setTimeout(() => setCurrentAlert(null), 6000);
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
    const [showIconPicker, setShowIconPicker] = useState(false);

    // --- Geofence Draw State ---
    const [drawMode, setDrawMode] = useState(null); // 'circle', 'rectangle', 'polygon', null

    const handleGeofenceComplete = (drawnData) => {
        const name = prompt("Enter a name for this Geofence:");
        if (!name) {
            setDrawMode(null);
            return;
        }

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
            name,
            fence_type: drawnData.type,
            coordinates: formattedCoords
        };

        setGeofences(prev => [...prev, newGeofence]);
        setDrawMode(null);
        alert(`Geofence '${name}' created and saved!`);
        // Normally you'd sync to backend here
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
        if (selectedVehicle?.id !== v.id) setRouteHistory([]);
        setSelectedVehicle(v);
        if (v.lat && v.lng) setMapPanTo([Number(v.lat), Number(v.lng)]);
    };

    const handleExecuteCommand = async (e) => {
        e.preventDefault();
        if (pinCode !== '1234') {
            setPinError('INVALID SECURE PIN');
            return;
        }

        if (user?.isDemo) {
            setCommandLoading(true);
            setTimeout(() => {
                setShowPinModal(false);
                setPinCode('');
                const commandToRun = selectedVehicle.ignition ? 'CUT_ENGINE' : 'RESTORE_ENGINE';
                alert(`SIMULATION SUCCESS: Command ${commandToRun} Dispatched.`);
                setSelectedVehicle(prev => ({ ...prev, ignition: !prev.ignition }));
                setFleet(prev => prev.map(fv => fv.id === selectedVehicle.id ? { ...fv, ignition: !fv.ignition } : fv));
                setCommandLoading(false);
            }, 1000);
            return;
        }

        setCommandLoading(true);
        setPinError('');
        try {
            const commandToRun = selectedVehicle.ignition ? 'CUT_ENGINE' : 'RESTORE_ENGINE';
            const req = await fetch(`${API_BASE}/api/commands/sms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: selectedVehicle.id, commandType: commandToRun })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setShowPinModal(false);
                setPinCode('');
                alert(`SUCCESS: Command ${commandToRun} Dispatched.`);
                // Update local state temporarily
                setSelectedVehicle(prev => ({ ...prev, ignition: !prev.ignition }));
            } else {
                setPinError(data.message || 'Dispatch Failed.');
            }
        } catch (err) {
            setPinError('Network Error.');
        } finally {
            setCommandLoading(false);
        }
    };

    const filteredFleet = fleet.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden font-sans text-slate-800 bg-[#e4e5e6] relative">
            {/* Left Side Panel - GEOSUREPATH LIGHT THEME */}
            <aside className="w-[340px] border-r border-slate-200 bg-white flex flex-col shrink-0 z-[100] shadow-md">
                {/* Search Bar */}
                <div className="p-3 border-b border-slate-200 bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-sm text-slate-800"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-white">
                    {['Objects', 'Events', 'Geofences'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 text-center font-medium text-sm pb-1 relative transition-colors ${activeTab === tab ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab}
                            {activeTab === tab && <div className="absolute -bottom-[13px] left-0 right-0 h-[2px] bg-blue-600" />}
                        </button>
                    ))}
                </div>

                {/* Vehicle List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 p-2">
                    {activeTab === 'Objects' && filteredFleet.map((v) => (
                        <div
                            key={v.id}
                            onClick={() => handleVehicleSelect(v)}
                            className={`flex items-center gap-3 p-3 mb-2 rounded bg-white shadow-sm border border-slate-100 cursor-pointer transition-all hover:border-blue-200 ${selectedVehicle?.id === v.id ? 'border-l-4 border-l-blue-500 shadow-md' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${v.status === 'moving' ? 'bg-green-100 text-green-600' : v.status === 'idle' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                <span className="text-sm">{VEHICLE_ICON_OPTIONS.find(opt => opt.id === (v.iconType || getVehicleIconPref(v.id)))?.emoji || '🚗'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-slate-700 truncate">{v.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>{v.lastUpdate ? new Date(v.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Offline'}</span>
                                    {v.status === 'moving' && <span className="text-green-600 font-medium">{v.speed} km/h</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <div className={`w-2 h-2 rounded-full ${v.status === 'moving' ? 'bg-green-500' : v.status === 'idle' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                            </div>
                        </div>
                    ))}
                    {activeTab === 'Objects' && filteredFleet.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            <Search className="mx-auto mb-2 opacity-50" size={24} />
                            No vehicles found
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
                                                className={`p-3 rounded-xl border shadow-sm transition-all hover:shadow-md ${isExit ? 'bg-rose-50/50 border-rose-100' : isDeviation ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className={`w-2 h-2 rounded-full ${isExit ? 'bg-rose-500 animate-pulse' : isDeviation ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${isExit ? 'text-rose-600' : isDeviation ? 'text-amber-600' : 'text-blue-600'}`}>
                                                        {isExit ? 'Boundary Exit' : isDeviation ? 'Route Deviation' : 'Boundary Entry'}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-slate-800 text-sm">{alert.vehicleName}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {isExit ? 'Left' : isDeviation ? 'Deviated via 100m from' : 'Entered'} geofence <span className="font-bold text-slate-700">{alert.fenceName}</span>
                                                </div>
                                                <div className="mt-2 flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                                    <span className="bg-white/50 px-1.5 py-0.5 rounded border border-slate-100">{alert.imei.slice(-6)}</span>
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

                            <div className="grid grid-cols-4 gap-2 mb-4 shrink-0">
                                <button
                                    onClick={() => setDrawMode(drawMode === 'circle' ? null : 'circle')}
                                    className={`py-2 rounded flex flex-col items-center justify-center gap-1 border transition-all text-[10px] font-semibold ${drawMode === 'circle' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <div className="w-5 h-5 rounded-full border-2 border-current border-dashed"></div>
                                    Circle
                                </button>
                                <button
                                    onClick={() => setDrawMode(drawMode === 'rectangle' ? null : 'rectangle')}
                                    className={`py-2 rounded flex flex-col items-center justify-center gap-1 border transition-all text-[10px] font-semibold ${drawMode === 'rectangle' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <div className="w-6 h-5 border-2 border-current border-dashed"></div>
                                    Rect
                                </button>
                                <button
                                    onClick={() => setDrawMode(drawMode === 'polygon' ? null : 'polygon')}
                                    className={`py-2 rounded flex flex-col items-center justify-center gap-1 border transition-all text-[10px] font-semibold ${drawMode === 'polygon' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <Hexagon size={16} className="text-current" />
                                    Poly
                                </button>
                                <button
                                    onClick={() => setDrawMode(drawMode === 'route' ? null : 'route')}
                                    className={`py-2 rounded flex flex-col items-center justify-center gap-1 border transition-all text-[10px] font-semibold ${drawMode === 'route' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <RouteIcon size={16} className="text-current" />
                                    Route
                                </button>
                            </div>

                            {drawMode && (
                                <div className="text-[10px] bg-blue-50 text-blue-700 p-2 border border-blue-200 rounded mb-4 shrink-0">
                                    <div className="font-bold">Instructions:</div>
                                    {drawMode === 'circle' && 'Click center, then click outer edge to set radius.'}
                                    {drawMode === 'rectangle' && 'Click one corner, then click opposite corner.'}
                                    {drawMode === 'polygon' && 'Click points to draw shape. Double-click to close.'}
                                    {drawMode === 'route' && 'Click points to draw a path. Double-click to close. Creates a 100m buffer zone.'}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pb-20">
                                {geofences.length === 0 ? (
                                    <div className="text-center py-8">
                                        <MapPin className="mx-auto mb-3 text-slate-300" size={32} />
                                        <div className="text-sm font-semibold text-slate-500">No Geofences Configured</div>
                                        <div className="text-xs text-slate-400 mt-1">Select a shape above to start drawing.</div>
                                    </div>
                                ) : (
                                    geofences.map(gf => (
                                        <div key={gf.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-500"><Hexagon size={16} /></div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-700">{gf.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{gf.fence_type}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setGeofences(prev => prev.filter(g => g.id !== gf.id))}
                                                className="text-slate-400 hover:text-red-500 p-1"
                                                title="Delete Geofence"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Right Side Map */}
            <main className="flex-1 relative">
                <MapContainer
                    center={[21.1458, 79.0882]}
                    zoom={selectedVehicle ? 14 : 8}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    zoomControl={false}
                >
                    <TileLayer
                        url={
                            mapTile === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' :
                                theme === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
                                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        }
                        attribution='&copy; OpenStreetMap &copy; CARTO'
                    />
                    <ZoomControl position="bottomright" />
                    <MapController panTo={mapPanTo} />

                    {/* Clustered Vehicles */}
                    <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                        {fleet.filter(v => v.lat !== undefined && v.lng !== undefined).map((v) => (
                            <Marker
                                key={v.id}
                                position={[Number(v.lat), Number(v.lng)]}
                                icon={getVehicleIcon({
                                    ...v,
                                    isAlerting: currentAlert?.imei === v.id
                                })}
                                eventHandlers={{
                                    click: () => handleVehicleSelect(v),
                                }}
                            />
                        ))}
                    </MarkerClusterGroup>

                    {/* Active Geofences Visualization - Always Visible */}
                    {geofences.map(gf => {
                        if (gf.fence_type === 'CIRCLE') {
                            return <Circle key={gf.id} center={[gf.coordinates[0], gf.coordinates[1]]} radius={gf.coordinates[2]} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} />;
                        } else if (gf.fence_type === 'rectangle' || (gf.fence_type === 'POLYGON' && gf.coordinates.length === 2)) {
                            return <Rectangle key={gf.id} bounds={gf.coordinates} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} />;
                        } else if (gf.fence_type === 'polygon' || (gf.fence_type === 'POLYGON' && gf.coordinates.length > 2)) {
                            return <Polygon key={gf.id} positions={gf.coordinates} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} />;
                        } else if (gf.fence_type === 'ROUTE') {
                            return <Polyline key={gf.id} positions={gf.coordinates} pathOptions={{ color: '#f59e0b', weight: 40, opacity: 0.3 }} />;
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

                {/* Floating Info Panel - GEOSUREPATH THEME */}
                {selectedVehicle && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-6 left-6 w-[340px] z-[500]"
                    >
                        <div className="bg-white rounded shadow-lg border border-slate-200 overflow-hidden text-sm">
                            <div className="bg-[#39569c] text-white p-3 flex justify-between items-center">
                                <div className="font-semibold flex items-center gap-2">
                                    <Car size={16} /> {selectedVehicle.name}
                                </div>
                                <button onClick={() => setSelectedVehicle(null)} className="hover:text-amber-300 transition-colors"><X size={16} /></button>
                            </div>

                            <div className="p-0">
                                <table className="w-full text-left border-collapse">
                                    <tbody>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 w-1/3 flex items-center gap-2 text-slate-600 font-medium"><Activity size={14} /> Status</td>
                                            <td className="p-2 font-semibold text-slate-800">
                                                {selectedVehicle.status === 'moving' ? <span className="text-green-600">Running</span> :
                                                    selectedVehicle.status === 'idle' ? <span className="text-amber-500">Idle</span> :
                                                        <span className="text-red-500">Stop</span>}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium"><Gauge size={14} /> Speed</td>
                                            <td className="p-2 font-semibold text-blue-600">{selectedVehicle.speed} km/h</td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium"><Power size={14} /> Ignition</td>
                                            <td className="p-2 font-semibold">
                                                {selectedVehicle.ignition ? <span className="text-green-600">ON</span> : <span className="text-slate-500">OFF</span>}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium"><MapPin size={14} /> Location</td>
                                            <td className="p-2 text-xs text-slate-600">
                                                {Number(selectedVehicle.lat).toFixed(5)}, {Number(selectedVehicle.lng).toFixed(5)}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-slate-100">
                                            <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium"><Smartphone size={14} /> Mobile</td>
                                            <td className="p-2 text-xs font-semibold text-slate-700">{selectedVehicle.phone || 'N/A'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium"><Hash size={14} /> IMEI</td>
                                            <td className="p-2 text-xs font-mono text-slate-500">{selectedVehicle.id}</td>
                                        </tr>
                                        {selectedVehicle.fuel !== undefined && (
                                            <tr className="border-t border-slate-100">
                                                <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">⛽ Fuel</td>
                                                <td className="p-2 text-xs font-semibold text-emerald-600">{selectedVehicle.fuel}{selectedVehicle.fuel <= 100 ? '%' : ' L'}</td>
                                            </tr>
                                        )}
                                        {selectedVehicle.battery !== undefined && (
                                            <tr className="border-t border-slate-100">
                                                <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">🔋 Battery</td>
                                                <td className="p-2 text-xs font-semibold text-amber-600">{selectedVehicle.battery}V</td>
                                            </tr>
                                        )}
                                        {selectedVehicle.temp !== undefined && (
                                            <tr className="border-t border-slate-100">
                                                <td className="p-2 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">🌡️ Temp</td>
                                                <td className="p-2 text-xs font-semibold text-blue-600">{selectedVehicle.temp}°C</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 p-2 border-t border-slate-200 flex gap-2">
                                <button
                                    onClick={() => setShowIconPicker(!showIconPicker)}
                                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 rounded text-slate-700 font-medium flex items-center justify-center gap-1 transition-colors"
                                    title="Change vehicle icon"
                                >
                                    <Car size={14} /> Icon
                                </button>
                                <button
                                    onClick={handleFetchHistory}
                                    disabled={isHistoryLoading}
                                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 rounded text-slate-700 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
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
                                        <div className="p-3 bg-slate-50">
                                            {/* Header */}
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Vehicle Type</span>
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
                                                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                                                }`}
                                                            title={opt.label}
                                                        >
                                                            <span className="text-lg leading-none">{opt.emoji}</span>
                                                            <span className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5">{opt.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {/* Color Swatches */}
                                            <div className="mt-3 pt-2 border-t border-slate-200">
                                                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 block">Pin Color</span>
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
                        className="bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm hover:bg-white transition-all flex items-center gap-1.5"
                    >
                        <MapPin size={12} />
                        {mapTile === 'satellite' ? '🛣️ Street' : '🛰️ Satellite'}
                    </button>
                </div>

                {/* History Date Range + Player Bar */}
                {historyMode ? (
                    <div className="absolute top-4 right-4 z-[600] bg-white rounded shadow-md border border-slate-200 p-4 flex flex-col gap-3 min-w-[320px]">
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
                                        <span className="font-black text-slate-900 uppercase tracking-tighter">
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
                                className="text-xs border border-slate-300 rounded p-1 outline-none"
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
                        <div className="absolute top-3 right-3 z-[600] bg-white/90 backdrop-blur-sm border border-slate-200 rounded-md shadow-sm p-2 flex gap-2 items-center">
                            <input
                                type="datetime-local"
                                value={historyRange.from}
                                onChange={e => setHistoryRange(r => ({ ...r, from: e.target.value }))}
                                className="text-[10px] border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">→</span>
                            <input
                                type="datetime-local"
                                value={historyRange.to}
                                onChange={e => setHistoryRange(r => ({ ...r, to: e.target.value }))}
                                className="text-[10px] border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 bg-white"
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
                                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[340px] overflow-hidden"
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
                                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center gap-2">
                                    <Car size={14} className="text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-600">{selectedVehicle?.name}</span>
                                    <span className="ml-auto text-[10px] font-mono text-slate-400">{selectedVehicle?.id}</span>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleExecuteCommand} className="p-5 space-y-4">
                                    <div className="text-sm text-slate-600 leading-relaxed">
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
                                            className="w-full text-center tracking-[0.8em] py-3 px-4 border-2 border-slate-300 rounded-xl font-mono font-black text-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 bg-slate-50"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowPinModal(false)}
                                            className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-sm transition-colors border border-slate-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={commandLoading || pinCode.length < 4}
                                            className={`flex-1 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all disabled:opacity-50 ${selectedVehicle?.ignition
                                                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'
                                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                                                }`}
                                        >
                                            {commandLoading ? '⏳ Sending...' : (selectedVehicle?.ignition ? '✂️ Cut Engine' : '✅ Restore Engine')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};


// --- DASHBOARDS ---


export default function App() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('geosurepath_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [fleet, setFleet] = useState([]);
    const [theme, setTheme] = useState('dark');
    const [mapTile, setMapTile] = useState(localStorage.getItem('mapTile') || 'street');
    useEffect(() => { localStorage.setItem('mapTile', mapTile); }, [mapTile]);
    const [wsStatus, setWsStatus] = useState('disconnected');

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('geosurepath_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('geosurepath_user');
    };



    useEffect(() => {
        const fetchFleet = async () => {
            try {
                // Try Traccar first
                const traccarRes = await fetch(`${TRACCAR_BASE}/api/positions`, {
                    headers: { 'Authorization': 'Basic ' + btoa('admin:admin') }
                });

                if (traccarRes.ok) {
                    const positions = await traccarRes.json();
                    const devicesRes = await fetch(`${TRACCAR_BASE}/api/devices`, {
                        headers: { 'Authorization': 'Basic ' + btoa('admin:admin') }
                    });
                    const devices = await devicesRes.json();

                    const traccarFleet = devices.map(dev => {
                        const pos = positions.find(p => p.deviceId === dev.id) || {};
                        const ignition = pos.attributes?.ignition || false;
                        const speed = pos.speed ? Math.round(pos.speed * 1.852) : 0;
                        let derivedStatus = 'offline';
                        if (pos.id) {
                            if (speed > 5 || pos.attributes?.motion) derivedStatus = 'moving';
                            else if (ignition) derivedStatus = 'idle';
                            else derivedStatus = 'stopped';
                        }

                        return {
                            id: dev.uniqueId,
                            name: dev.name,
                            phone: dev.phone || dev.contact || 'N/A',
                            type: dev.category || 'car',
                            status: derivedStatus,
                            speed: speed,
                            heading: pos.course || 0,
                            lat: typeof pos.latitude === 'number' ? pos.latitude : 21.0,
                            lng: typeof pos.longitude === 'number' ? pos.longitude : 79.0,
                            ignition: ignition,
                            fuel: pos.attributes?.fuel,
                            battery: pos.attributes?.battery || pos.attributes?.batteryLevel,
                            temp: pos.attributes?.temp1 || pos.attributes?.temperature,
                            lastUpdate: pos.deviceTime || Date.now()
                        };
                    });
                    if (traccarFleet.length > 0) {
                        setFleet(traccarFleet);
                        return;
                    }
                }
                // If Traccar returned no devices, keep fleet empty
                setFleet([]);
            } catch (err) {
                console.warn('Fleet fetch failed, using live data only');
                setFleet([]);
            }
        };

        fetchFleet();
        const interval = setInterval(fetchFleet, 10000);

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
                setFleet(prev => prev.map(v => v.id === msg.imei
                    ? { ...v, lat: parseFloat(msg.lat), lng: parseFloat(msg.lng), speed: parseInt(msg.speed) || 0, status: parseInt(msg.speed) > 2 ? 'moving' : 'idle' }
                    : v
                ));
            }
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
                {!user ? (
                    <Routes>
                        <Route path="/" element={<RegistrationPage onLogin={handleLogin} />} />
                        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                ) : (
                    <Layout user={user} onLogout={handleLogout}>
                        <Routes>
                            <Route path="/" element={<Navigate to={user.role === 'ADMIN' ? '/admin' : '/client'} replace />} />

                            {user.role === 'ADMIN' && (
                                <>
                                    <Route path="/admin" element={<Dashboard type="ADMIN" fleet={fleet} user={user} />} />
                                    <Route path="/command-center" element={<CommandCenter fleet={fleet} />} />
                                </>
                            )}

                            <Route path="/client" element={<Dashboard type="CLIENT" fleet={fleet} user={user} />} />
                            <Route path="/live" element={
                                <SimpleTracker
                                    fleet={fleet}
                                    mapTile={mapTile}
                                    theme={theme}
                                    setMapTile={setMapTile}
                                    setTheme={setTheme}
                                    user={user}
                                />
                            } />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/settings" element={<Settings user={user} theme={theme} setTheme={setTheme} />} />
                            <Route path="*" element={<Navigate to={user.role === 'ADMIN' ? '/admin' : '/client'} replace />} />
                        </Routes>
                    </Layout>
                )}
            </Router>
        </ErrorBoundary>
    );
}
