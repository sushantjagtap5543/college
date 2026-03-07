import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Map as MapIcon, Shield, Activity, Users, Settings, LogIn, ChevronRight,
    Car, Bell, PowerOff, Battery, Thermometer, Box, Database, Search, Filter,
    LogOut, Crosshair, ArrowRight, CheckCircle2, AlertTriangle, PlayCircle,
    FileText, CreditCard, Droplet, LayoutDashboard, Zap, Menu, X, Hexagon, Route as RouteIcon,
    TrendingDown, CheckSquare, Wrench, FolderOpen, UserCircle, Briefcase, Share2, FileWarning, Smartphone, Monitor, Rocket, Server, DollarSign
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline, Polygon, Circle, DrawingManager, MarkerClusterer } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = "AIzaSyDC06bvPGvLheTFVj9kJbctdh6A81zCIPk";
const LIBRARIES = ['drawing', 'places', 'geometry', 'visualization'];

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Draggable from 'react-draggable';

// --- Dynamic API Base URLs to support both local dev and AWS deployment ---
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : `${window.location.protocol}//${window.location.hostname}:8080`;

const WS_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:8080'
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8080`;

const TRACCAR_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : `${window.location.protocol}//${window.location.hostname}:8082`;

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

// --- TRACKZEE-STYLE VEHICLE ICON (Google Maps Version) ---
const getVehicleIcon = (vehicle, colorOverride) => {
    const status = vehicle.status || 'offline';
    const pinColor = colorOverride || vehicle.color || '#10b981';
    const statusColor = status === 'moving' ? '#10b981'
        : status === 'idle' ? '#f59e0b'
            : status === 'alert' ? '#ef4444'
                : status === 'stopped' ? '#3b82f6'
                    : '#94a3b8';
    const ignition = vehicle.ignition !== false;
    const isMoving = status === 'moving';

    const carSvg = vehicle.type === 'truck'
        ? `<rect x="12" y="11" width="16" height="18" rx="3" fill="white" opacity="0.95"/>
           <rect x="14" y="8"  width="12" height="5"  rx="2" fill="white" opacity="0.85"/>
           <rect x="12" y="27" width="4"  height="3"  rx="1" fill="white" opacity="0.75"/>
           <rect x="24" y="27" width="4"  height="3"  rx="1" fill="white" opacity="0.75"/>`
        : vehicle.type === 'van'
            ? `<rect x="13" y="10" width="14" height="20" rx="3" fill="white" opacity="0.95"/>
           <rect x="15" y="7"  width="10" height="5"  rx="2" fill="white" opacity="0.85"/>
           <rect x="13" y="27" width="4"  height="3"  rx="1" fill="white" opacity="0.75"/>
           <rect x="23" y="27" width="4"  height="3"  rx="1" fill="white" opacity="0.75"/>`
            : `<ellipse cx="20" cy="19" rx="6"  ry="9"  fill="white" opacity="0.95"/>
           <ellipse cx="17" cy="13" rx="2.5" ry="2" fill="white" opacity="0.8"/>
           <ellipse cx="23" cy="13" rx="2.5" ry="2" fill="white" opacity="0.8"/>
           <rect    x="14" y="26"  width="4" height="3" rx="1" fill="white" opacity="0.85"/>
           <rect    x="22" y="26"  width="4" height="3" rx="1" fill="white" opacity="0.85"/>`;

    const pulseRing = isMoving ? `
        <circle cx="20" cy="18" r="22" fill="none" stroke="${statusColor}" stroke-width="2" opacity="0.35">
            <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>
        </circle>` : '';

    const svgString = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        ${pulseRing}
        <defs>
          <filter id="ps_g">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.45)"/>
          </filter>
        </defs>
        <path d="M20 3 C11 3,4 10,4 19 C4 28,20 45,20 45 C20 45,36 28,36 19 C36 10,29 3,20 3 Z" fill="${pinColor}" filter="url(#ps_g)"/>
        <circle cx="20" cy="18" r="12" fill="rgba(0,0,0,0.18)"/>
        ${carSvg}
        <circle cx="20" cy="18" r="12" fill="none" stroke="${statusColor}" stroke-width="1.5" opacity="0.7"/>
        <circle cx="32" cy="8" r="5" fill="${ignition ? '#22c55e' : '#94a3b8'}" stroke="white" stroke-width="1.5"/>
        <circle cx="32" cy="8" r="2" fill="white" opacity="0.5">
            ${isMoving ? '<animate attributeName="opacity" values="0.2;0.8;0.2" dur="1s" repeatCount="indefinite"/>' : ''}
        </circle>
        {/* Status Blinker (corner dot) */}
        <circle cx="8" cy="8" r="4" fill="${statusColor}">
            <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite"/>
        </circle>
    </svg>`;

    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
        anchor: new window.google.maps.Point(20, 45),
        scaledSize: new window.google.maps.Size(40, 50)
    };
};

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

// --- COMPONENTS ---
const LandingPage = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex flex-col relative bg-slate-50 dark:bg-slate-900 font-sans selection:bg-brand-500 selection:text-white">

            {/* --- PREMIUM NAVBAR --- */}
            <header className="px-6 md:px-12 py-4 flex justify-between items-center z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/logo.png" alt="GEOSUREPATH Logo" className="h-10 md:h-12 object-contain" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    <div className="hidden items-center gap-2">
                        <div className="bg-brand-500 p-2 rounded-xl shadow-lg shadow-brand-500/20"><MapIcon className="text-white" size={24} /></div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">GEOSUREPATH<span className="text-brand-500 text-3xl leading-none">.</span></h2>
                    </div>
                </div>

                <nav className="hidden lg:flex items-center gap-8 font-bold text-sm text-slate-600 dark:text-slate-300">
                    <a href="#features" className="hover:text-brand-500 transition-colors">Features</a>
                    <a href="#industries" className="hover:text-brand-500 transition-colors">Solutions</a>
                    <a href="#hardware" className="hover:text-brand-500 transition-colors">Supported Devices</a>
                    <a href="#pricing" className="hover:text-brand-500 transition-colors">Pricing</a>
                </nav>

                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/login')} className="hidden sm:flex font-bold text-slate-600 dark:text-slate-300 hover:text-brand-500 transition-colors px-4 py-2">Sign In</button>
                    <button onClick={() => navigate('/register')} className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 transition-all">Get Started</button>
                </div>
            </header>

            <main className="flex-1 w-full overflow-hidden">

                {/* --- HERO SECTION --- */}
                <section className="relative pt-20 pb-32 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between max-w-[1400px] mx-auto gap-12">
                    {/* Background Orbs */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/4" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/2 translate-y-1/4" />

                    <motion.div
                        initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}
                        className="lg:w-1/2 z-10 text-center lg:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs mb-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" /> Platform V2.0 is Live
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
                            Advanced GPS <br />
                            Tracking <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-blue-600">Software</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto lg:mx-0 font-medium leading-relaxed">
                            Empower your business with real-time fleet visibility, intelligent geofencing, and comprehensive reports. The ultimate white-label GPS platform for global telematics businesses.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                            <button onClick={() => navigate('/register')} className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-brand-500/30 hover:-translate-y-1 transition-all text-lg flex items-center justify-center gap-2">
                                Start Free Trial <ArrowRight size={20} />
                            </button>
                            <button onClick={() => window.location.href = '#features'} className="w-full sm:w-auto bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-4 px-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-lg">
                                Explore Features
                            </button>
                        </div>
                        <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> No Credit Card</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> 14-Day Trial</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> Instant Setup</span>
                        </div>
                    </motion.div>

                    {/* Dashboard Mockup image simulation */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, rotateY: 15 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ duration: 1, delay: 0.2 }}
                        className="lg:w-1/2 relative perspective-1000 w-full"
                    >
                        <div className="relative rounded-3xl overflow-hidden border border-slate-200/50 dark:border-slate-700 shadow-2xl bg-slate-900 group">
                            {/* Browser Header Bar */}
                            <div className="h-8 bg-slate-800 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            </div>
                            {/* Mockup Content (Abstract UI) */}
                            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[#e5e7eb] dark:bg-[#0f172a] opacity-50" style={{ backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                {/* Example Map Route Overlay */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-brand-500/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen" />
                                <svg className="absolute inset-0 w-full h-full stroke-brand-500 stroke-2 fill-none stroke-[3] opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <path d="M10 90 Q 30 10 50 50 T 90 10" />
                                    <circle cx="90" cy="10" r="2" className="fill-brand-500" />
                                    <circle cx="10" cy="90" r="2" className="fill-emerald-500" />
                                </svg>

                                {/* Floating UI Elements inside Mockup */}
                                <div className="absolute top-6 left-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 w-48 transition-transform group-hover:-translate-y-2 duration-500">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">Nissan Leaf</div>
                                            <div className="text-[10px] text-emerald-500 font-bold">Moving • 65 km/h</div>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 w-3/4" />
                                    </div>
                                </div>

                                <div className="absolute bottom-6 right-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-transform group-hover:-translate-y-2 duration-500 delay-100">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Fleet</div>
                                    <div className="text-3xl font-black text-slate-800 dark:text-white">1,248</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* --- LOGO CAROUSEL --- */}
                <section className="py-10 border-y border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                    <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Trusted By Fleet Managers Worldwide</p>
                    <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Placeholder Logos */}
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-2 font-black text-xl text-slate-800 dark:text-white">
                                <Hexagon className="text-brand-500" /> LOGO {i}
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- FEATURES GRID --- */}
                <section id="features" className="py-32 px-6 md:px-12 max-w-[1400px] mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">Built For Scale & Precision</h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium">Everything you need to track, manage, and optimize your fleet in one unified platform.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { icon: <MapIcon size={32} />, color: "text-brand-500", bg: "bg-brand-50 dark:bg-brand-500/10", border: 'group-hover:border-brand-500', title: 'Real-Time Tracking', desc: 'Monitor your assets live on high-resolution maps with zero-latency WebSocket streaming.' },
                            { icon: <RouteIcon size={32} />, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: 'group-hover:border-indigo-500', title: 'Route History', desc: 'Playback past routes, analyze trip data, and identify inefficiencies with intuitive scrubbing tools.' },
                            { icon: <Hexagon size={32} />, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: 'group-hover:border-emerald-500', title: 'Geofences & POIs', desc: 'Draw custom polygonal zones and receive instant alerts when assets enter or exit critical areas.' },
                            { icon: <Bell size={32} />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", border: 'group-hover:border-amber-500', title: 'Instant Alerts', desc: 'Configure SMS, Email, and Push notifications for overspeeding, engine idling, or parameter breaches.' },
                            { icon: <FileText size={32} />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", border: 'group-hover:border-blue-500', title: 'Detailed Reports', desc: 'Generate comprehensive Excel/PDF reports on fuel consumption, driving behavior, and daily activity.' },
                            { icon: <PowerOff size={32} />, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10", border: 'group-hover:border-rose-500', title: 'Remote Control', desc: 'Send direct GPRS commands to immobilize engines or activate relays instantly from the dashboard.' }
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true, margin: '-50px' }}
                                className={`bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 group`}
                            >
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${f.bg} ${f.color} transition-transform group-hover:scale-110`}>
                                    {f.icon}
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-slate-800 dark:text-white">{f.title}</h3>
                                <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* --- HARDWARE SUPPORT COMPONENT --- */}
                <section id="hardware" className="py-24 bg-slate-900 border-y border-slate-800 text-white overflow-hidden relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
                    <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center">
                        <h2 className="text-4xl md:text-5xl font-black mb-6">Compatible With 1000+ Trackers</h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">Teltonika, Ruptela, Queclink, Coban, Concox and many more. Simply point your tracker to our IP and Port.</p>

                        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-3xl p-8 md:p-12 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                            <div className="text-left flex-1">
                                <span className="text-brand-500 font-bold tracking-widest uppercase text-sm mb-2 block">Quick Configuration</span>
                                <div className="text-2xl text-slate-300 mb-1">Server IP: <span className="font-mono text-white font-black bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 ml-2">geosurepath.com</span></div>
                                <div className="text-2xl text-slate-300">Port: <span className="font-mono text-white font-black bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 ml-2">5023</span></div>
                            </div>
                            <button className="btn-primary py-4 px-8 text-lg rounded-2xl shadow-xl shadow-brand-500/20 w-full md:w-auto">View Supported Devices</button>
                        </div>
                    </div>
                </section>

                {/* --- CTA SECTION --- */}
                <section className="py-32 px-6 text-center">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}>
                        <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight mb-8">Ready To Transform Your Fleet?</h2>
                        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10">Join thousands of businesses managing their assets with GEOSUREPATH.</p>
                        <button onClick={() => navigate('/register')} className="bg-brand-500 hover:bg-brand-600 text-white font-black text-xl py-5 px-12 rounded-2xl shadow-2xl shadow-brand-500/40 hover:-translate-y-1 transition-all">
                            Create Free Account
                        </button>
                    </motion.div>
                </section>

                {/* --- FOOTER --- */}
                <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 px-6 md:px-12">
                    <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2">
                            <MapIcon className="text-brand-500" />
                            <span className="font-bold text-slate-800 dark:text-white">GEOSUREPATH.</span>
                        </div>
                        <div className="text-slate-500 text-sm font-medium">
                            &copy; {new Date().getFullYear()} GEOSUREPATH. All rights reserved.
                        </div>
                        <div className="flex gap-6 text-sm font-bold text-slate-600 dark:text-slate-400">
                            <a href="#" className="hover:text-brand-500">Privacy Policy</a>
                            <a href="#" className="hover:text-brand-500">Terms of Service</a>
                            <a href="#" className="hover:text-brand-500">Contact Us</a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

const LoginPage = ({ onLogin }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e, role) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter both email and password.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        // Mock authentication success
        onLogin(role);
        navigate(role === 'ADMIN' ? '/admin' : '/client');
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-slate-50 dark:bg-slate-900 px-4 font-sans selection:bg-brand-500 selection:text-white">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />

            <div className="absolute top-8 left-8 flex items-center gap-2 cursor-pointer z-20" onClick={() => navigate('/')}>
                <div className="bg-brand-500 p-1.5 rounded-lg shadow-md hover:shadow-lg transition-shadow"><MapIcon className="text-white" size={20} /></div>
                <span className="font-black text-xl text-slate-800 dark:text-white tracking-tight">GEOSUREPATH.</span>
            </div>

            <motion.div
                className="w-full max-w-[420px] z-10"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            >
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-700/50">
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-100 dark:border-brand-500/20 shadow-inner">
                            <LogIn className="text-brand-500" size={28} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Welcome Back</h2>
                        <p className="text-slate-500 font-medium mt-2">Sign in to your workspace</p>
                    </div>

                    <form className="space-y-6" onSubmit={(e) => handleLogin(e, 'CLIENT')}>
                        {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3 shadow-sm">
                                <AlertTriangle size={18} className="shrink-0" /> {error}
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <UserCircle className="text-slate-400" size={18} />
                                    </div>
                                    <input
                                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                    <a href="#" className="text-xs font-bold text-brand-500 hover:text-brand-600 transition-colors">Forgot Password?</a>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Shield className="text-slate-400" size={18} />
                                    </div>
                                    <input
                                        type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-black py-4 rounded-xl shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 transition-all text-base flex justify-center items-center gap-2">
                                Sign In <ArrowRight size={18} />
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 flex items-center justify-between text-xs font-bold border-t border-slate-100 dark:border-slate-700/50 pt-6">
                        <button type="button" onClick={(e) => handleLogin(e, 'ADMIN')} className="text-slate-500 hover:text-indigo-500 transition-colors flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                            <Shield size={14} /> Admin Access
                        </button>
                        <span className="text-slate-400">
                            New here? <button onClick={() => navigate('/register')} className="text-brand-500 hover:text-brand-600 ml-1">Create Account</button>
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const RegistrationPage = () => {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [imei, setImei] = useState('');
    const [sim, setSim] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleImeiCheck = async (val) => {
        setImei(val);
        if (val.length >= 15) {
            try {
                // MOCK Validation fallback if DB isn't running
                const MOCK_INVENTORY = {
                    '863012938475102': '8991203049581',
                    '869727079043556': '5754280844707',
                    '869727079043558': '1234567890123'
                };

                if (MOCK_INVENTORY[val]) {
                    setSim(MOCK_INVENTORY[val]);
                    setError(false);
                } else {
                    setSim('Pending Assignment');
                    setError(false);
                }
            } catch (err) {
                setSim('');
                setError(true);
            }
        } else {
            setError(false);
            setSim('');
        }
    };

    const handleRegister = async () => {
        setLoading(true);
        try {
            const req = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, email, imei })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                navigate('/client');
            } else {
                setError(true);
            }
        } catch (err) {
            console.error('Registration API Error (Fallback to Local Test Mode):', err);
            alert("Local Test Mode: Simulating successful DB registration!");
            navigate('/client');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-slate-50 dark:bg-slate-900 px-4 font-sans selection:bg-brand-500 selection:text-white py-12">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[100px] -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />

            <div className="absolute top-8 left-8 flex items-center gap-2 cursor-pointer z-20" onClick={() => navigate('/')}>
                <div className="bg-brand-500 p-1.5 rounded-lg shadow-md hover:shadow-lg transition-shadow"><MapIcon className="text-white" size={20} /></div>
                <span className="font-black text-xl text-slate-800 dark:text-white tracking-tight">GEOSUREPATH.</span>
            </div>

            <motion.div
                className="w-full max-w-[540px] z-10"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            >
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-700/50">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Create Account</h2>
                        <p className="text-slate-500 font-medium mt-2">Fill in your details to activate your device</p>
                    </div>

                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                                <input
                                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="John"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-bold text-black dark:text-black shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                                <input
                                    type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Doe"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-bold text-black dark:text-black shadow-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="client@company.com"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-bold text-black dark:text-black shadow-sm"
                            />
                        </div>

                        <div className="h-px w-full bg-slate-100 dark:bg-slate-700/50 my-2" />

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="mb-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    <Database size={14} className="text-brand-500" /> Device IMEI (15 Digits)
                                </label>
                                <input
                                    type="text" value={imei} onChange={(e) => handleImeiCheck(e.target.value)} required maxLength={15} placeholder="e.g. 863012938475102"
                                    className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500 focus:border-brand-500'} bg-white dark:bg-slate-800 outline-none transition-all text-sm font-bold text-black dark:text-black shadow-sm font-mono`}
                                />
                                {error && <div className="text-rose-500 text-xs font-bold mt-2 flex items-center gap-1"><AlertTriangle size={12} /> IMEI not found in inventory.</div>}
                            </div>

                            <div>
                                <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    <span>Associated SIM Number</span>
                                    {sim && !error && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12} /> Verified</span>}
                                </label>
                                <input
                                    type="text" value={sim} readOnly placeholder="Auto-populated upon IMEI match..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-black dark:text-black font-mono transition-all text-sm shadow-inner cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row gap-4">
                            <button type="button" onClick={() => navigate('/login')} className="w-full sm:w-1/3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all text-sm flex justify-center items-center gap-2">
                                Back
                            </button>
                            <button type="submit" disabled={error || !sim || loading} className={`w-full sm:w-2/3 bg-brand-500 hover:bg-brand-600 text-white font-black py-4 rounded-xl shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 transition-all text-sm flex justify-center items-center gap-2 ${error || !sim || loading ? 'opacity-50 cursor-not-allowed hover:translate-y-0 shadow-none' : ''}`}>
                                {loading ? 'Processing...' : 'Complete Account Setup'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

// --- LAYOUTS ---

const SimpleTracker = ({ fleet, isLoaded, mapTile, theme, setMapTile, setTheme }) => {
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [mapInstance, setMapInstance] = useState(null);

    const filteredFleet = fleet.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-900 border-none font-sans text-white">
            {/* Minimal Side List */}
            <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 z-50">
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-brand-500 p-2 rounded-xl">
                            <MapIcon className="text-white" size={20} />
                        </div>
                        <h1 className="font-black text-xl tracking-tight">GeoSurePath<span className="text-brand-500">.</span></h1>
                    </div>
                    {/* Search / Filter by IMEI */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-brand-500 transition-colors" size={14} />
                        <input
                            type="text"
                            placeholder="Track by IMEI or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-brand-500 focus:bg-slate-800 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Live Fleet ({filteredFleet.length})</div>
                    {filteredFleet.map((v, idx) => (
                        <div
                            key={v.id}
                            onClick={() => {
                                setSelectedVehicle(v);
                                if (mapInstance) mapInstance.panTo({ lat: Number(v.lat), lng: Number(v.lng) });
                            }}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedVehicle?.id === v.id ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${v.status === 'moving' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-amber-500'}`} />
                                        <span className="font-bold text-sm tracking-tight">{v.name}</span>
                                    </div>
                                    <span className="text-[9px] font-black font-mono text-slate-500 pl-4">IMEI: {v.id}</span>
                                </div>
                                <span className="text-[10px] font-black font-mono bg-slate-700 px-2 py-0.5 rounded text-slate-300">{v.speed} km/h</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-2">
                                <Activity size={12} className="text-brand-500" />
                                {v.status === 'moving' ? 'Currently In Motion' : 'Idle / Parked'}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button
                        onClick={() => setMapTile(mapTile === 'street' ? 'satellite' : 'street')}
                        className="flex-1 py-3 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                    >
                        {mapTile === 'street' ? 'SAT' : 'MAP'}
                    </button>
                </div>
            </aside>

            {/* Full Screen Map */}
            <main className="flex-1 relative bg-slate-950">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={{ height: '100%', width: '100%' }}
                        center={selectedVehicle ? { lat: Number(selectedVehicle.lat), lng: Number(selectedVehicle.lng) } : { lat: 21.1458, lng: 79.0882 }}
                        zoom={selectedVehicle ? 16 : 5}
                        onLoad={map => setMapInstance(map)}
                        options={{
                            zoomControl: true,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                            mapTypeId: mapTile === 'satellite' ? 'satellite' : 'roadmap',
                            styles: [
                                { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                                { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                                { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                                { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
                                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
                            ]
                        }}
                    >
                        <MarkerClusterer>
                            {clusterer =>
                                fleet.filter(v => v.lat && v.lng).map((v, i) => (
                                    <Marker
                                        key={v.id}
                                        position={{ lat: Number(v.lat), lng: Number(v.lng) }}
                                        clusterer={clusterer}
                                        icon={getVehicleIcon(v)}
                                        onClick={() => setSelectedVehicle(v)}
                                    />
                                ))
                            }
                        </MarkerClusterer>
                    </GoogleMap>
                ) : (
                    <div className="flex h-full items-center justify-center font-black text-slate-500 tracking-widest uppercase">Initializing Radar...</div>
                )}
            </main>
        </div>
    );
};


// --- DASHBOARDS ---


function App() {
    const [fleet, setFleet] = useState([]);
    const [theme, setTheme] = useState('dark');
    const [mapTile, setMapTile] = useState('street');
    const [wsStatus, setWsStatus] = useState('disconnected');

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: LIBRARIES
    });

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
                        return {
                            id: dev.uniqueId,
                            name: dev.name,
                            type: dev.category || 'car',
                            status: pos.id ? (pos.attributes?.motion ? 'moving' : 'idle') : 'offline',
                            speed: pos.speed ? Math.round(pos.speed * 1.852) : 0,
                            heading: pos.course || 0,
                            lat: typeof pos.latitude === 'number' ? pos.latitude : 21.0,
                            lng: typeof pos.longitude === 'number' ? pos.longitude : 79.0,
                            ignition: pos.attributes?.ignition || false,
                            lastUpdate: pos.deviceTime || Date.now()
                        };
                    });
                    if (traccarFleet.length > 0) {
                        setFleet(traccarFleet);
                        return;
                    }
                }

                // Fallback to Demo Data for "Hassle-Free" experience
                const demoFleet = [
                    { id: '869727079043558', name: 'Live Tracker (869727079043558)', type: 'car', status: 'moving', speed: 45, lat: 21.1458, lng: 79.0882, ignition: true, color: '#10b981', lastUpdate: Date.now() },
                    { id: 'DEMO02', name: 'Heavy Truck B', type: 'truck', status: 'idle', speed: 0, lat: 21.1500, lng: 79.1000, ignition: false, color: '#f59e0b', lastUpdate: Date.now() - 300000 },
                    { id: 'DEMO03', name: 'Mini Van A', type: 'van', status: 'alert', speed: 12, lat: 21.1400, lng: 79.0700, ignition: true, color: '#ef4444', lastUpdate: Date.now() - 60000 }
                ];
                setFleet(demoFleet);
            } catch (err) {
                console.warn('Fleet fetch failed, using demo data');
                setFleet([{ id: '869727079043558', name: 'Live Tracker (869727079043558)', status: 'offline', ignition: false, speed: 0, lat: 21.0, lng: 79.0, isDemo: true, type: 'car', color: '#94a3b8' }]);
            }
        };

        fetchFleet();
        const interval = setInterval(fetchFleet, 10000);

        // WebSocket for real-time updates
        const ws = new WebSocket(WS_BASE);
        ws.onopen = () => setWsStatus('connected');
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'LOCATION_UPDATE' && msg.imei) {
                    setFleet(prev => prev.map(v => v.id === msg.imei
                        ? { ...v, lat: parseFloat(msg.lat), lng: parseFloat(msg.lng), speed: parseInt(msg.speed) || 0, status: parseInt(msg.speed) > 2 ? 'moving' : 'idle' }
                        : v
                    ));
                }
            } catch (e) { }
        };
        ws.onclose = () => setWsStatus('disconnected');

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    return (
        <ErrorBoundary>
            <SimpleTracker
                fleet={fleet}
                isLoaded={isLoaded}
                mapTile={mapTile}
                theme={theme}
                setMapTile={setMapTile}
                setTheme={setTheme}
            />
        </ErrorBoundary>
    );
}

export default App;

