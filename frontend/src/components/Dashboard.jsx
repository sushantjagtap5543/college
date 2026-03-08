import React, { useState, useEffect } from 'react';
import {
    Route as RouteIcon, MapPin, Clock, Battery, Map,
    StopCircle, AlertCircle, Activity, Gauge, Database,
    Users, Plus, Server, CheckCircle2, Search, X, Settings,
    LayoutDashboard, ArrowRight, Shield, UserCircle, RefreshCcw, KeyRound
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getVehicleIcon, VEHICLE_ICON_OPTIONS, getVehicleIconPref } from '../utils/statusIcons';

// Reuse basic icon logic for dashboard preview
// (Replaced by shared utility)

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : `${window.location.protocol}//${window.location.hostname}:8080`;

export default function Dashboard({ type = 'CLIENT', fleet = [], user }) {
    const [clients, setClients] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [isAddingDevice, setIsAddingDevice] = useState(false);
    const [newDevice, setNewDevice] = useState({ imei: '', sim: '' });
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
        { label: 'Travel Distance', value: '113 Km', icon: RouteIcon, color: '#3b82f6' },
        { label: 'Trip', value: '5', icon: MapPin, color: '#3b82f6' },
        { label: 'Driving Duration', value: '4 h', icon: Clock, color: '#3b82f6' },
        { label: 'Idle Duration', value: '25 h 3 m', icon: Activity, color: '#3b82f6' },
        { label: 'Stop Duration', value: '2 d 21 h', icon: StopCircle, color: '#3b82f6' },
        { label: 'Inactive Duration', value: '0 m', icon: Battery, color: '#3b82f6' },
        { label: 'Average Speed', value: '21 Km/h', icon: Gauge, color: '#3b82f6' },
        { label: 'Maximum Speed', value: '47 Km/h', icon: Gauge, color: '#3b82f6' },
    ];

    const runningCount = fleet.filter(v => v.status === 'moving').length;
    const idleCount = fleet.filter(v => v.status === 'idle').length;
    const stopCount = fleet.filter(v => v.status === 'stopped' || v.status === 'offline' || !v.status).length;
    const alertCount = fleet.filter(v => v.status === 'alert').length;

    const statuses = [
        { label: 'Running', count: runningCount, color: '#10b981', bg: 'bg-[#10b981]' },
        { label: 'Idle', count: idleCount, color: '#f59e0b', bg: 'bg-[#f59e0b]' },
        { label: 'Stop', count: stopCount, color: '#ef4444', bg: 'bg-[#ef4444]' },
        { label: 'Alert', count: alertCount, color: '#f43f5e', bg: 'bg-rose-500' },
        { label: 'Inactive', count: 0, color: '#3b82f6', bg: 'bg-[#3b82f6]' },
        { label: 'Total', count: fleet.length, color: '#334155', bg: 'bg-[#334155]' },
    ];

    const chartData = [
        { name: '01', util: 0, idle: 0 },
        { name: '02', util: 0, idle: 0 },
        { name: '03', util: 20, idle: 5 },
        { name: '04', util: 0, idle: 0 },
        { name: '05', util: 0, idle: 0 },
        { name: '06', util: 45, idle: 12 },
        { name: '07', util: 0, idle: 0 },
    ];

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
                setNewDevice({ imei: '', sim: '' });
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

    if (type === 'ADMIN') {
        // Keeping ADMIN dashboard mostly the same but converting to light theme quickly
        return (
            <div className="h-full overflow-y-auto p-6 bg-[#f3f4f6] text-slate-800 font-sans custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="text-blue-600" /> Admin Control Panel
                        </h1>
                    </div>
                    <button onClick={fetchAdminData} className="p-2 bg-white rounded border border-slate-200 hover:bg-slate-50 transition-colors">
                        <RefreshCcw size={20} className={isLoading ? 'animate-spin text-blue-500' : 'text-slate-500'} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Users size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{clients.length}</div>
                            <div className="text-sm text-slate-500">Total Clients</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-green-50 text-green-600 rounded-full"><Server size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{inventory.length}</div>
                            <div className="text-sm text-slate-500">Total Devices</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-amber-50 text-amber-600 rounded-full"><Database size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold">{inventory.filter(i => !i.is_assigned).length}</div>
                            <div className="text-sm text-slate-500">Unassigned</div>
                        </div>
                    </div>
                </div>

                {/* Simplified Admin Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* INVENTORY LIST */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex flex-col h-[500px]">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <h2 className="text-lg font-semibold text-slate-800">Device Master List</h2>
                            <button onClick={() => setIsAddingDevice(!isAddingDevice)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1">
                                {isAddingDevice ? <X size={16} /> : <Plus size={16} />} {isAddingDevice ? 'Cancel' : 'Add Device'}
                            </button>
                        </div>
                        {isAddingDevice && (
                            <form onSubmit={handleAddInventory} className="mb-4 bg-slate-50 p-4 rounded border">
                                <div className="flex gap-4">
                                    <input type="text" placeholder="IMEI" required value={newDevice.imei} onChange={e => setNewDevice({ ...newDevice, imei: e.target.value })} className="flex-1 px-3 py-2 border rounded bg-white text-slate-800" />
                                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Save</button>
                                </div>
                            </form>
                        )}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="p-3">IMEI</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Added</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory.map(inv => (
                                        <tr key={inv.id} className="border-b">
                                            <td className="p-3 font-mono text-slate-700">{inv.imei}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${inv.is_assigned ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {inv.is_assigned ? 'ASSIGNED' : 'UNASSIGNED'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-slate-500">{new Date(inv.added_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* CLIENTS LIST */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6 flex flex-col h-[500px]">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <h2 className="text-lg font-semibold text-slate-800">Client Accounts</h2>
                            <div className="flex gap-2">
                                <button onClick={() => navigate('/command-center')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 font-bold">
                                    <Zap size={16} className="text-amber-500" /> Command Center
                                </button>
                                <button onClick={() => setIsAssigning(!isAssigning)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1">
                                    {isAssigning ? <X size={16} /> : <Plus size={16} />} {isAssigning ? 'Cancel' : 'Assign Device'}
                                </button>
                            </div>
                        </div>
                        {isAssigning && (
                            <form onSubmit={handleAssignDevice} className="mb-4 bg-slate-50 p-4 rounded border space-y-3">
                                <select required value={assignForm.clientId} onChange={e => setAssignForm({ ...assignForm, clientId: e.target.value })} className="w-full p-2 border rounded bg-white text-slate-800">
                                    <option value="">Select Client</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
                                </select>
                                <select required value={assignForm.imei} onChange={e => setAssignForm({ ...assignForm, imei: e.target.value })} className="w-full p-2 border rounded bg-white text-slate-800">
                                    <option value="">Select IMEI (Unassigned)</option>
                                    {inventory.filter(i => !i.is_assigned).map(i => <option key={i.imei} value={i.imei}>{i.imei}</option>)}
                                </select>
                                <button type="submit" className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700">Assign Device</button>
                            </form>
                        )}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="p-3">Client</th>
                                        <th className="p-3">Direct Password</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.map(c => (
                                        <tr key={c.id} className="border-b">
                                            <td className="p-3">
                                                <div className="font-medium text-slate-800">{c.name}</div>
                                                <div className="text-xs text-slate-500">{c.email}</div>
                                            </td>
                                            <td className="p-3 font-mono text-xs font-bold text-blue-600">{c.plain_password || 'N/A'}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleToggleBlock(c.id, c.is_blocked)}
                                                    className={`px-3 py-1 rounded text-xs transition-colors ${c.is_blocked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                >
                                                    {c.is_blocked ? 'UNBLOCK' : 'BLOCK'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* SMS COMMAND DISPATCH */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertCircle className="text-amber-500" size={20} /> SMS Command Dispatch
                    </h2>
                    <form onSubmit={handleSmsDispatch} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Admin Sender Mobile</label>
                            <input required type="text" value={smsForm.adminMobile} onChange={e => setSmsForm({ ...smsForm, adminMobile: e.target.value })} className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500 text-slate-800" placeholder="+123" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Target Device Mobile</label>
                            <input required type="text" value={smsForm.targetMobile} onChange={e => setSmsForm({ ...smsForm, targetMobile: e.target.value })} className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500 text-slate-800" placeholder="+123" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Command String</label>
                            <input required type="text" value={smsForm.commandStr} onChange={e => setSmsForm({ ...smsForm, commandStr: e.target.value })} className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500 uppercase text-slate-800" placeholder="CMD" />
                        </div>
                        <button type="submit" disabled={isSmsSending} className="bg-amber-500 hover:bg-amber-600 text-white font-medium p-2 rounded mb-[1px] min-w-[120px]">
                            {isSmsSending ? '...' : smsStatus || 'Send SMS'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- CLIENT VIEW: EXACT TRACKZEE CLONE ---
    return (
        <div className="h-full overflow-y-auto p-4 bg-[#f3f4f6] text-slate-800 font-sans custom-scrollbar">

            {/* Top 8 Widgets */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-md shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center text-center h-[120px]">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}>
                            <kpi.icon size={20} />
                        </div>
                        <div className="text-slate-500 text-xs mb-1">{kpi.label}</div>
                        <div className="text-blue-500 font-semibold text-sm">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Status Colored Blocks */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {statuses.map((s, i) => (
                    <div key={i} className={`${s.bg} text-white rounded-md shadow-sm p-4 flex flex-col justify-center items-center h-[100px] hover:opacity-90 cursor-pointer transition-opacity`}>
                        <div className="text-3xl font-bold mb-1">{s.count}</div>
                        <div className="text-xs font-semibold tracking-wide uppercase opacity-90">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Middle Section: Map + Reminders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Live Map Overview */}
                <div className="lg:col-span-2 bg-white rounded-md shadow-sm border border-slate-200 p-4 min-h-[300px] flex flex-col group">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-semibold text-slate-700">Live Map Overview</h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> LIVE
                        </div>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-100 relative" style={{ height: '300px' }}>
                        <MapContainer
                            center={[21.1458, 79.0882]}
                            zoom={11}
                            style={{ height: '300px', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            {fleet.map(v => v.lat && v.lng && (
                                <Marker
                                    key={v.id}
                                    position={[Number(v.lat), Number(v.lng)]}
                                    icon={getVehicleIcon(v)}
                                />
                            ))}
                        </MapContainer>
                        <div className="absolute bottom-2 right-2 z-[1000]">
                            <button
                                onClick={() => window.location.href = '/live'}
                                className="bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm hover:bg-white transition-all flex items-center gap-1"
                            >
                                Open Full Map <ArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Renewal Reminders (As per Trackzee reference) */}
                <div className="bg-white rounded-md shadow-sm border border-slate-200 p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-semibold text-slate-700">Renewal Reminders</h3>
                        <span className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">View All</span>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-[11px] text-left">
                            <thead className="text-slate-400 font-bold border-b border-slate-50 uppercase tracking-tighter">
                                <tr>
                                    <th className="pb-2">Type</th>
                                    <th className="pb-2">Due</th>
                                    <th className="pb-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {[
                                    { type: 'Insurance', due: '12-Mar-2026', status: 'Due' },
                                    { type: 'Driving License', due: '05-Apr-2026', status: 'UpComing' },
                                    { type: 'Service Alert', due: 'Expiring Soon', status: 'Overdue' },
                                    { type: 'PUC Renewal', due: '20-Jun-2026', status: 'UpComing' },
                                ].map((rem, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 text-slate-700 font-semibold">{rem.type}</td>
                                        <td className="py-2 text-slate-500">{rem.due}</td>
                                        <td className="py-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rem.status === 'Overdue' ? 'bg-red-50 text-red-600' :
                                                rem.status === 'Due' ? 'bg-amber-50 text-amber-600' :
                                                    'bg-blue-50 text-blue-600'
                                                }`}>
                                                {rem.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom 2 Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Fleet Idling (Chart Placeholder) */}
                <div className="bg-white rounded-md shadow-sm border border-slate-200 p-4 min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Fleet Idling</h3>
                    <div className="flex-1 w-full flex items-end opacity-70">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Bar dataKey="idle" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense History / Fleet Utilisation (Chart Placeholder) */}
                <div className="bg-white rounded-md shadow-sm border border-slate-200 p-4 min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Fleet Utilisation</h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Bar dataKey="util" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Vehicle Management Section (Client) */}
            <div className="mt-8 bg-white rounded-md shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <KeyRound className="text-blue-500" /> My Fleet Management
                    </h3>
                    <button
                        onClick={() => setIsClientAdding(!isClientAdding)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
                    >
                        {isClientAdding ? <X size={16} /> : <Plus size={16} />}
                        {isClientAdding ? 'Cancel' : 'Add New Vehicle'}
                    </button>
                </div>

                <AnimatePresence>
                    {isClientAdding && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <form onSubmit={handleClientAddVehicle} className="bg-slate-50 p-6 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Device IMEI</label>
                                    <input
                                        required type="text" maxLength={15} placeholder="000000000000000"
                                        value={clientVehicleForm.imei} onChange={e => setClientVehicleForm({ ...clientVehicleForm, imei: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-sm font-bold bg-white text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Vehicle Name</label>
                                    <input
                                        required type="text" placeholder="My Car"
                                        value={clientVehicleForm.vehicleName} onChange={e => setClientVehicleForm({ ...clientVehicleForm, vehicleName: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-sm font-bold bg-white text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Plate Number</label>
                                    <input
                                        required type="text" placeholder="ABC-1234"
                                        value={clientVehicleForm.plateNumber} onChange={e => setClientVehicleForm({ ...clientVehicleForm, plateNumber: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-sm font-bold bg-white text-slate-800"
                                    />
                                </div>
                                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-black py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all">
                                    Register Vehicle
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Vehicle / Device</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fleet.map(v => (
                                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${v.status === 'moving' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                <span className="text-sm">{VEHICLE_ICON_OPTIONS.find(opt => opt.id === (v.iconType || getVehicleIconPref(v.id)))?.emoji || '🚗'}</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-sm">{v.name}</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter">IMEI: {v.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${v.status === 'moving' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {v.status || 'OFFLINE'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleRemoveVehicle(v.vehicle_id || v.id)}
                                            className="text-rose-500 hover:text-rose-700 font-black text-[10px] uppercase tracking-widest p-2"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {fleet.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="p-12 text-center text-slate-400 text-sm italic font-medium">No active vehicles found in your fleet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
