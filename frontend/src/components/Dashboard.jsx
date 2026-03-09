import React, { useState, useEffect } from 'react';
import {
    Route as RouteIcon, MapPin, Clock, Battery, Map,
    StopCircle, AlertCircle, Activity, Gauge, Database,
    Users, Plus, Server, CheckCircle2, Search, X, Settings,
    LayoutDashboard, ArrowRight, Shield, UserCircle, RefreshCcw, KeyRound, Zap
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
    AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getVehicleIcon, VEHICLE_ICON_OPTIONS, getVehicleIconPref } from '../utils/statusIcons';
import AdminDashboard from './AdminDashboard';

// Auto-fit map bounds to all vehicle positions
const MapAutoCenter = ({ fleet }) => {
    const map = useMap();
    useEffect(() => {
        const validPositions = fleet
            .filter(v => v.lat && v.lng && !isNaN(Number(v.lat)) && !isNaN(Number(v.lng)))
            .map(v => [Number(v.lat), Number(v.lng)]);
        if (validPositions.length === 0) return;
        if (validPositions.length === 1) {
            map.setView(validPositions[0], 14);
        } else {
            try { map.fitBounds(validPositions, { padding: [40, 40] }); } catch (e) { }
        }
    }, [fleet, map]);
    return null;
};

// Reuse basic icon logic for dashboard preview
// (Replaced by shared utility)

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : `${window.location.protocol}//${window.location.hostname}`;

export default function Dashboard({ type = 'CLIENT', fleet = [], user }) {
    const [clients, setClients] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [isAddingDevice, setIsAddingDevice] = useState(false);
    const [newDevice, setNewDevice] = useState({ imei: '', sim: '', protocol: 'GT06' });
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignForm, setAssignForm] = useState({ clientId: '', imei: '', plateNumber: '', vehicleType: 'car' });
    const [isLoading, setIsLoading] = useState(type === 'ADMIN');

    // SMS Dispatch State
    const [smsForm, setSmsForm] = useState({ adminMobile: '', targetMobile: '', commandStr: '' });
    const [isSmsSending, setIsSmsSending] = useState(false);
    const [smsStatus, setSmsStatus] = useState('');

    // Client Vehicle Management State
    const [isClientAdding, setIsClientAdding] = useState(false);
    const [clientVehicleForm, setClientVehicleForm] = useState({ imei: '', vehicleName: '', plateNumber: '' });

    const kpis = [
        { label: 'Total Distance', value: '113.8 Km', icon: RouteIcon, trend: '+12%' },
        { label: 'Active Trips', value: '12', icon: MapPin, trend: 'Live' },
        { label: 'Drive Time', value: '8h 24m', icon: Clock, trend: '-5%' },
        { label: 'Idling', value: '2h 15m', icon: Activity, trend: '+2%' },
        { label: 'Stop Duration', value: '1d 4h', icon: StopCircle, trend: 'Normal' },
        { label: 'Fuel Usage', value: '42.5 L', icon: Zap, trend: '-8%' },
        { label: 'Avg Speed', value: '42 Km/h', icon: Gauge, trend: 'Stable' },
        { label: 'Max Speed', value: '98 Km/h', icon: Gauge, trend: 'Alert' },
    ];

    const runningCount = fleet.filter(v => v.status === 'moving').length;
    const idleCount = fleet.filter(v => v.status === 'idle').length;
    const stopCount = fleet.filter(v => v.status === 'stopped' || v.status === 'offline' || !v.status).length;
    const alertCount = fleet.filter(v => v.status === 'alert').length;

    const statuses = [
        { label: 'Moving', count: runningCount },
        { label: 'Idle', count: idleCount },
        { label: 'Stopped', count: stopCount },
        { label: 'Alert', count: alertCount },
        { label: 'Inactive', count: 0 },
        { label: 'Connected', count: fleet.length },
    ];

    const [chartTimeFilter, setChartTimeFilter] = useState('week');

    const getChartData = () => {
        const data = [];
        const today = new Date();

        if (chartTimeFilter === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                data.push({
                    name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    util: Math.floor(Math.random() * 60) + 10,
                    idle: Math.floor(Math.random() * 20) + 2
                });
            }
        } else if (chartTimeFilter === 'month') {
            for (let i = 4; i >= 1; i--) {
                data.push({
                    name: `Week ${5 - i}`,
                    util: Math.floor(Math.random() * 200) + 50,
                    idle: Math.floor(Math.random() * 80) + 10
                });
            }
        } else if (chartTimeFilter === 'year') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentMonth = today.getMonth();
            for (let i = 5; i >= 0; i--) {
                const mIdx = (currentMonth - i + 12) % 12;
                data.push({
                    name: months[mIdx],
                    util: Math.floor(Math.random() * 800) + 200,
                    idle: Math.floor(Math.random() * 300) + 50
                });
            }
            // Reverse so chronological left to right
            data.reverse();
        }
        return data;
    };

    const chartData = getChartData();

    useEffect(() => {
        if (type === 'ADMIN') {
            fetchAdminData();
        }
    }, [type]);

    const fetchAdminData = async () => {
        setIsLoading(true);
        try {
            const [clientRes, invRes] = await Promise.all([
                fetch(`${API_BASE}/api/admin/clients`),
                fetch(`${API_BASE}/api/devices`)
            ]);
            const clientData = await clientRes.json();
            const invData = await invRes.json();

            if (clientData.status === 'SUCCESS') setClients(clientData.clients || []);
            if (invData.status === 'SUCCESS') setInventory(invData.devices || []);
        } catch (err) {
            console.error('Failed to fetch admin data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSmsDispatch = async (e) => {
        e.preventDefault();
        setIsSmsSending(true);
        setSmsStatus('SENDING...');
        try {
            const req = await fetch(`${API_BASE}/api/commands/sms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: smsForm.targetMobile,
                    commandType: smsForm.commandStr,
                    adminMobile: smsForm.adminMobile,
                    isAdminSms: true
                })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setSmsStatus('SUCCESS');
                setTimeout(() => setSmsStatus(''), 3000);
            } else {
                setSmsStatus('FAILED');
            }
        } catch (err) {
            setSmsStatus('ERROR');
        } finally {
            setIsSmsSending(false);
        }
    };

    const handleAddInventory = async (e) => {
        e.preventDefault();
        try {
            const req = await fetch(`${API_BASE}/api/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newDevice, status: 'Unassigned' })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setInventory([data.device, ...inventory]);
                setIsAddingDevice(false);
                setNewDevice({ imei: '', sim: '', protocol: 'GT06' });
            }
        } catch (err) {
            alert('Failed to add device to inventory.');
        }
    };

    const handleAssignDevice = async (e) => {
        e.preventDefault();
        try {
            const req = await fetch(`${API_BASE}/api/admin/devices/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignForm)
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                fetchAdminData();
                setIsAssigning(false);
                setAssignForm({ clientId: '', imei: '', plateNumber: '', vehicleType: 'car' });
            }
        } catch (err) {
            alert('Failed to assign device.');
        }
    };

    const handleClientAddVehicle = async (e) => {
        e.preventDefault();
        try {
            const req = await fetch(`${API_BASE}/api/vehicles/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...clientVehicleForm, userId: user?.id })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setIsClientAdding(false);
                setClientVehicleForm({ imei: '', vehicleName: '', plateNumber: '' });
                alert('Vehicle added successfully. Refreshing fleet...');
                window.location.reload();
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert('Failed to add vehicle.');
        }
    };

    const handleRemoveVehicle = async (vehicleId) => {
        if (!window.confirm('Are you sure you want to remove this vehicle?')) return;
        try {
            const req = await fetch(`${API_BASE}/api/vehicles/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                alert('Vehicle removed.');
                window.location.reload();
            }
        } catch (err) {
            alert('Failed to remove vehicle.');
        }
    };

    const handleToggleBlock = async (clientId, isCurrentlyBlocked) => {
        try {
            const req = await fetch(`${API_BASE}/api/admin/clients/toggle-block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: clientId, blocked: !isCurrentlyBlocked })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                setClients(clients.map(c => c.id === clientId ? { ...c, is_blocked: !isCurrentlyBlocked } : c));
            }
        } catch (err) {
            console.error('Failed to toggle block status', err);
        }
    };

    const handleRenew = async (clientId, manualDays = null) => {
        const days = manualDays || window.prompt('Enter days to add to subscription:', '365');
        if (!days || isNaN(days)) return;

        try {
            const req = await fetch(`${API_BASE}/api/admin/clients/renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: clientId, daysToAdd: parseInt(days) })
            });
            const data = await req.json();
            if (data.status === 'SUCCESS') {
                alert(`SUCCESS: Subscription extended by ${days} days.`);
                fetchAdminData();
            } else {
                alert(data.message || 'Renewal failed.');
            }
        } catch (err) {
            console.error('Failed to renew subscription', err);
            alert('Network error during renewal.');
        }
    };

    const handleUpdateClient = async (userId, data) => {
        try {
            const req = await fetch(`${API_BASE}/api/admin/clients/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...data })
            });
            const res = await req.json();
            if (res.status === 'SUCCESS') {
                alert('User details updated successfully.');
                fetchAdminData();
            } else {
                alert(res.message || 'Update failed.');
            }
        } catch (err) {
            console.error('Update Error:', err);
            alert('Network error.');
        }
    };

    if (type === 'ADMIN') {
        return <AdminDashboard
            clients={clients} inventory={inventory} isLoading={isLoading}
            fleet={fleet} fetchAdminData={fetchAdminData}
            smsForm={smsForm} setSmsForm={setSmsForm}
            isSmsSending={isSmsSending} smsStatus={smsStatus}
            handleSmsDispatch={handleSmsDispatch}
            isAddingDevice={isAddingDevice} setIsAddingDevice={setIsAddingDevice}
            newDevice={newDevice} setNewDevice={setNewDevice}
            handleAddInventory={handleAddInventory}
            isAssigning={isAssigning} setIsAssigning={setIsAssigning}
            assignForm={assignForm} setAssignForm={setAssignForm}
            handleAssignDevice={handleAssignDevice}
            handleToggleBlock={handleToggleBlock}
            handleRenew={handleRenew}
            handleUpdateClient={handleUpdateClient}
            API_BASE={API_BASE}
        />;
    }



    // --- CLIENT VIEW ---

    return (
        <div className="h-full overflow-y-auto p-6 bg-slate-50/50 text-slate-900 font-sans custom-scrollbar">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Fleet Intelligence <span className="text-indigo-600">Live</span></h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <Activity size={12} className="animate-pulse" /> Real-time operational oversight
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black text-slate-600 flex items-center gap-2">
                        <Clock size={14} /> {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Premium Status Banner - Executive Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 mb-10">
                {statuses.map((s, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        key={i}
                        className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-black text-slate-900">{s.count}</div>
                            <div className="text-[10px] font-bold text-slate-400">UNITS</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* KPI Executive Matrix - High Contrast */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-10">
                {kpis.map((kpi, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        key={i}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 group hover:border-slate-300 transition-all"
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <kpi.icon size={18} />
                        </div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-tight mb-1">{kpi.label}</div>
                        <div className="flex items-baseline justify-between">
                            <div className="text-slate-950 font-black text-lg tracking-tight">{kpi.value}</div>
                            {kpi.trend && (
                                <span className={`text-[10px] font-black ${kpi.trend.startsWith('+') ? 'text-emerald-500' : kpi.trend.startsWith('-') ? 'text-rose-500' : 'text-slate-400'}`}>
                                    {kpi.trend}
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Central Intelligence Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Live Geo-Spatial Pulse */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-2 flex flex-col overflow-hidden group">
                    <div className="h-full min-h-[450px] relative rounded-[22px] overflow-hidden">
                        <MapContainer
                            center={fleet.find(v => v.lat && v.lng)
                                ? [Number(fleet.find(v => v.lat && v.lng).lat), Number(fleet.find(v => v.lat && v.lng).lng)]
                                : [18.52, 73.85]}
                            zoom={12}
                            style={{ height: '450px', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap'
                            />
                            <MarkerClusterGroup chunkedLoading>
                                {fleet.map(v => v.lat && v.lng && (
                                    <Marker
                                        key={v.id}
                                        position={[Number(v.lat), Number(v.lng)]}
                                        icon={getVehicleIcon(v)}
                                    />
                                ))}
                            </MarkerClusterGroup>
                            <MapAutoCenter fleet={fleet} />
                        </MapContainer>

                        {/* Map Overlay HUD */}
                        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                            <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-white font-black text-[10px] uppercase tracking-widest">Global Telemetry Stream</span>
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-4 z-[1000]">
                            <button onClick={() => window.location.href = '/live'} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl border border-slate-200 hover:-translate-y-1 transition-all">
                                Expand Tactical Map
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Utilization & Health */}
                <div className="space-y-8">
                    {/* Utilization Chart Card */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Fleet Utilization</h3>
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                                    <Area type="monotone" dataKey="util" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUtil)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Operational Alerts Stack */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex-1">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Security Pulse</h3>
                            <span className="text-[10px] font-black text-rose-500 px-2 py-0.5 bg-rose-50 rounded-lg">Critical Alert</span>
                        </div>
                        <div className="space-y-4">
                            {[
                                { title: 'Geofence Breach', dev: 'Truck 14', time: '2m ago', color: 'rose' },
                                { title: 'Ignition Cycle', dev: 'Van 02', time: '14m ago', color: 'emerald' },
                                { title: 'Manual SOS', dev: 'Car 09', time: '1h ago', color: 'rose' }
                            ].map((alert, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                    <div className={`w-2 h-10 rounded-full ${alert.color === 'rose' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                    <div className="flex-1">
                                        <div className="text-xs font-black text-slate-900">{alert.title}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{alert.dev} • {alert.time}</div>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Managed Assets List - Executive View */}
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Registered Assets</h3>
                        <p className="text-slate-400 font-medium text-xs">Manage lifecycle and telemetry for your connected hardware</p>
                    </div>
                    <button
                        onClick={() => setIsClientAdding(!isClientAdding)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3"
                    >
                        {isClientAdding ? <X size={16} /> : <Plus size={16} />}
                        {isClientAdding ? 'Close Panel' : 'Provision Asset'}
                    </button>
                </div>

                <AnimatePresence>
                    {isClientAdding && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-10 overflow-hidden">
                            <form onSubmit={handleClientAddVehicle} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">IMEI Identification</label>
                                    <input required value={clientVehicleForm.imei} onChange={e => setClientVehicleForm({ ...clientVehicleForm, imei: e.target.value })} className="w-full bg-white px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500" placeholder="15 Digit IMEI" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Asset Alias</label>
                                    <input required value={clientVehicleForm.vehicleName} onChange={e => setClientVehicleForm({ ...clientVehicleForm, vehicleName: e.target.value })} className="w-full bg-white px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500" placeholder="e.g. Service Van 01" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Regulatory Plate</label>
                                    <input required value={clientVehicleForm.plateNumber} onChange={e => setClientVehicleForm({ ...clientVehicleForm, plateNumber: e.target.value })} className="w-full bg-white px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500" placeholder="Plate Number" />
                                </div>
                                <button type="submit" className="w-full bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px]">Secure & Provision</button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fleet.map(v => (
                        <motion.div
                            whileHover={{ y: -5 }}
                            key={v.id}
                            className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-emerald-500/20 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:bg-emerald-50 transition-colors" />

                            <div className="relative flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${v.status === 'moving' ? 'bg-emerald-50 text-emerald-600' :
                                        v.status === 'idle' ? 'bg-amber-50 text-amber-600' :
                                            'bg-slate-50 text-slate-400'
                                        }`}>
                                        {VEHICLE_ICON_OPTIONS.find(o => o.id === (v.iconType || 'car'))?.emoji || '🚗'}
                                    </div>
                                    <div>
                                        <div className="text-base font-black text-slate-900 leading-tight">{v.name}</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">IMEI: {v.id}</div>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${v.status === 'moving' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' :
                                    v.status === 'idle' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                                        'bg-slate-200 text-slate-600'
                                    }`}>
                                    {v.status || 'Offline'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/50">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Velocity</div>
                                    <div className="text-xl font-bold text-slate-900">{v.speed || 0} <span className="text-xs font-medium opacity-40">KM/H</span></div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/50">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Heading</div>
                                    <div className="text-xl font-bold text-slate-900">{v.heading || 0}° <span className="text-xs font-medium opacity-40">DEG</span></div>
                                </div>
                            </div>

                            <div className="flex gap-2 relative">
                                <button
                                    onClick={() => window.location.href = '/live'}
                                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MapPin size={12} /> Live Trace
                                </button>
                                <button
                                    onClick={() => handleRemoveVehicle(v.vehicle_id || v.id)}
                                    className="p-3.5 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                >
                                    <StopCircle size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                    {fleet.length === 0 && (
                        <div className="col-span-full py-24 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <Activity size={48} className="opacity-20 animate-pulse" />
                            <div className="text-sm font-black uppercase tracking-[0.2em] opacity-50">Operational Stasis • No Assets Detected</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

}
