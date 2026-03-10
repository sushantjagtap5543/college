import React, { useState, useEffect } from 'react';
import {
    Shield, RefreshCcw, Map, ArrowRight, Plus, X, Search,
    AlertCircle, Server, Database, Users, Activity, Clock, Zap, Target, Layers, Settings, ChevronRight, Cpu
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LabelList, Legend, AreaChart, Area
} from 'recharts';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { getVehicleIcon } from '../utils/statusIcons';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
    { id: 'dashboard', label: 'Overview', icon: Activity },
    { id: 'reports', label: 'Payments', icon: Layers },
    { id: 'clients', label: 'Customers', icon: Users },
    { id: 'vehicles', label: 'All Vehicles', icon: Shield },
    { id: 'devices', label: 'Stock', icon: Server },
    { id: 'models', label: 'Device Setup', icon: Target },
    { id: 'commands', label: 'Remote Cmds', icon: Zap },
    { id: 'logs', label: 'Activity Logs', icon: Search },
    { id: 'alerts', label: 'Live Alerts', icon: AlertCircle },
    { id: 'health', label: 'System Health', icon: Database },
    { id: 'backup', label: 'Maintenance', icon: Clock }
];

export default function AdminDashboard({
    clients, inventory, isLoading, fleet, fetchAdminData,
    smsForm, setSmsForm, isSmsSending, smsStatus, handleSmsDispatch,
    isAddingDevice, setIsAddingDevice, newDevice, setNewDevice, handleAddInventory,
    isAssigning, setIsAssigning, assignForm, setAssignForm, handleAssignDevice,
    handleToggleBlock, handleRenew, handleUpdateClient, handleUpdateBilling, API_BASE, onLogin
}) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [health, setHealth] = useState(null);
    const [revenue, setRevenue] = useState(null);
    const [alertsLog, setAlertsLog] = useState([]);
    const [unlinkedDevices, setUnlinkedDevices] = useState([]);
    const [commandTemplates, setCommandTemplates] = useState([]);

    const handleImpersonate = async (clientId) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/clients/impersonate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: clientId })
            });
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                onLogin(data.user);
            } else {
                alert(data.message || 'Failed to impersonate client.');
            }
        } catch (err) {
            alert('System error during remote access.');
        }
    };
    const [alertFilter, setAlertFilter] = useState('');
    const [backupStatus, setBackupStatus] = useState(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [isAddingClient, setIsAddingClient] = useState(false);
    const [newClientForm, setNewClientForm] = useState({ name: '', email: '', password: '', phone: '' });

    const handleAddClient = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/admin/clients/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClientForm)
            });
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                alert('Account authorized successfully.');
                setIsAddingClient(false);
                setNewClientForm({ name: '', email: '', password: '', phone: '' });
                fetchAdminData();
            } else {
                alert(data.message || 'Authorization failed.');
            }
        } catch (err) {
            alert('System error during client authorization.');
        }
    };
    const [backupMsg, setBackupMsg] = useState('');
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [allVehicles, setAllVehicles] = useState([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(false);
    const [speedEditId, setSpeedEditId] = useState(null);
    const [speedEditVal, setSpeedEditVal] = useState('');
    const [speedSaveMsg, setSpeedSaveMsg] = useState({});
    const [engineStatus, setEngineStatus] = useState({});
    const [deviceModels, setDeviceModels] = useState([]);
    const [logicalCmds, setLogicalCmds] = useState([]);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [commandMappings, setCommandMappings] = useState([]);
    const [newModel, setNewModel] = useState({ name: '', protocol: 'GT06' });
    const [mappingSaveStatus, setMappingSaveStatus] = useState({});
    const [commandLogs, setCommandLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Command Validation Pin 
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinCode, setPinCode] = useState('');
    const [pinError, setPinError] = useState('');
    const [pendingCmd, setPendingCmd] = useState(null);

    // Edit Client State
    const [editingClient, setEditingClient] = useState(null);
    const [editClientForm, setEditClientForm] = useState({ name: '', email: '', password: '', subscriptionPlan: '', subscriptionEndDate: '' });

    useEffect(() => {
        if (activeTab === 'logs') fetchCommandLogs();
        if (activeTab === 'health') fetchHealth();
        if (activeTab === 'reports') fetchRevenue();
        if (activeTab === 'alerts') fetchAlerts();
        if (activeTab === 'backup') fetchBackupStatus();
        if (activeTab === 'vehicles') fetchAllVehicles();
        if (activeTab === 'models' || activeTab === 'commands') {
            fetchModels();
            if (activeTab === 'commands') fetchCommandTemplates();
        }
        fetchUnlinkedDevices(); // Always check for newborns
    }, [activeTab]);

    const fetchUnlinkedDevices = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/unlinked-devices`)).json();
            if (d.status === 'SUCCESS') setUnlinkedDevices(d.unlinked);
        } catch { }
    };

    const fetchCommandTemplates = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/command-templates`)).json();
            if (d.status === 'SUCCESS') setCommandTemplates(d.templates);
        } catch { }
    };

    const handleSaveTemplate = async (template) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/command-templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template)
            });
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                alert('Command blueprint updated successfully.');
                fetchCommandTemplates();
            }
        } catch { }
    };

    useEffect(() => {
        if (selectedModelId) fetchMappings(selectedModelId);
    }, [selectedModelId]);

    const fetchCommandLogs = async () => {
        setLogsLoading(true);
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/command-logs`)).json();
            if (d.status === 'SUCCESS') setCommandLogs(d.logs);
        } catch { }
        finally { setLogsLoading(false); }
    };

    const fetchModels = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/models`)).json();
            if (d.status === 'SUCCESS') setDeviceModels(d.models);
        } catch { }
    };

    const fetchLogicalCmds = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/logical-commands`)).json();
            if (d.status === 'SUCCESS') setLogicalCmds(d.commands);
        } catch { }
    };

    const fetchMappings = async (modelId) => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/command-maps/${modelId}`)).json();
            if (d.status === 'SUCCESS') setCommandMappings(d.mappings);
        } catch { }
    };

    const handleAddModel = async (e) => {
        e.preventDefault();
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: newModel.name, protocol: newModel.protocol })
            })).json();
            if (d.status === 'SUCCESS') {
                setDeviceModels([...deviceModels, d.model]);
                setNewModel({ name: '', protocol: 'GT06' });
            }
        } catch { }
    };

    const handleUpdateMapping = async (logicalId, payload) => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/command-maps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: selectedModelId, logical_id: logicalId, payload })
            })).json();
            setMappingSaveStatus(p => ({ ...p, [logicalId]: d.status === 'SUCCESS' ? '✓' : '✗' }));
            setTimeout(() => setMappingSaveStatus(p => ({ ...p, [logicalId]: '' })), 2000);
        } catch { }
    };

    const [isEngineSending, setIsEngineSending] = useState(false);

    const fetchHealth = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/system-health`)).json();
            if (d.status === 'SUCCESS') setHealth(d.health);
        } catch {
            setHealth({ uptime: 'N/A', dbStats: {}, redisStatus: 'Offline', lastBackup: 'Never', memoryMB: 0, nodeVersion: 'N/A', googleDriveLink: 'https://drive.google.com/drive/folders/1xR_DVXjm78URhz9gnbkOM1ERLARM-wN8' });
        }
    };

    const fetchRevenue = async () => {
        setRevenueLoading(true);
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/revenue`)).json();
            if (d.status === 'SUCCESS') setRevenue(d.revenue);
        } catch { }
        finally { setRevenueLoading(false); }
    };

    const fetchAlerts = async () => {
        try {
            const q = alertFilter ? `&type=${alertFilter}` : '';
            const d = await (await fetch(`${API_BASE}/api/admin/alerts/all?limit=100${q}`)).json();
            if (d.status === 'SUCCESS') setAlertsLog(d.alerts || []);
        } catch { setAlertsLog([]); }
    };

    const fetchBackupStatus = async () => {
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/backup/status`)).json();
            if (d.status === 'SUCCESS') setBackupStatus(d);
        } catch { }
    };

    const fetchAllVehicles = async () => {
        setVehiclesLoading(true);
        try {
            const d = await (await fetch(API_BASE + '/api/admin/vehicles')).json();
            if (d.status === 'SUCCESS') setAllVehicles(d.vehicles);
        } catch { setAllVehicles([]); }
        finally { setVehiclesLoading(false); }
    };

    const handleSpeedSave = async (vehicleId) => {
        const limit = parseInt(speedEditVal);
        if (isNaN(limit) || limit < 10 || limit > 300) {
            setSpeedSaveMsg(p => ({ ...p, [vehicleId]: 'Range: 10-300' }));
            return;
        }
        try {
            const d = await (await fetch(API_BASE + '/api/admin/vehicles/' + vehicleId + '/speed-limit', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ speedLimit: limit })
            })).json();
            setSpeedSaveMsg(p => ({ ...p, [vehicleId]: d.status === 'SUCCESS' ? '✓ Saved' : '✗ Failed' }));
            setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, speed_limit: limit } : v));
            setTimeout(() => setSpeedSaveMsg(p => ({ ...p, [vehicleId]: '' })), 2000);
        } catch { setSpeedSaveMsg(p => ({ ...p, [vehicleId]: '✗ Error' })); }
        setSpeedEditId(null);
    };

    const initiateEngineControl = (vehicleImei, command) => {
        setPendingCmd({ imei: vehicleImei, command });
        setPinCode('');
        setPinError('');
        setShowPinModal(true);
    };

    const handleEngineControlSubmit = async (e) => {
        e.preventDefault();
        if (pinCode !== '1234') {
            setPinError('INVALID SECURE PIN');
            return;
        }

        const { imei: vehicleImei, command } = pendingCmd;
        setIsEngineSending(true);
        setPinError('');

        try {
            const d = await (await fetch(API_BASE + '/api/commands/gprs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imei: vehicleImei, commandType: command })
            })).json();
            setEngineStatus(p => ({ ...p, [vehicleImei]: d.status === 'SUCCESS' ? 'Sent' : 'Failed' }));
            if (d.status === 'SUCCESS') {
                setShowPinModal(false);
                setPinCode('');
                alert(`SUCCESS: Engine command ${command} executed.`);
            } else {
                setPinError(d.message || 'Dispatch Failed.');
            }
            setTimeout(() => setEngineStatus(p => ({ ...p, [vehicleImei]: '' })), 3000);
        } catch {
            setEngineStatus(p => ({ ...p, [vehicleImei]: 'Error' }));
            setPinError('Network Error.');
        }
        finally { setIsEngineSending(false); }
    };

    const triggerBackup = async () => {
        setBackupLoading(true); setBackupMsg('');
        try {
            const d = await (await fetch(`${API_BASE}/api/admin/backup/trigger`, { method: 'POST' })).json();
            setBackupMsg(d.message || (d.status === 'SUCCESS' ? 'Backup complete!' : 'Backup failed.'));
            if (d.status === 'SUCCESS') fetchBackupStatus();
        } catch (e) { setBackupMsg('Error: ' + e.message); }
        finally { setBackupLoading(false); }
    };

    const tdC = 'p-5 text-xs text-slate-700 font-bold';
    const thC = 'p-5 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 bg-slate-50/50';

    const nextBilling = (created_at) => {
        // Fallback Date if backend missing 'created_at' in Accounts payload
        const baseDate = created_at ? new Date(created_at) : new Date('2026-03-01T00:00:00Z');
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        return baseDate.toLocaleDateString();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans">

            {/* Premium Admin Header */}
            <div className="flex-shrink-0 px-10 py-8 bg-white border-b border-slate-200 shadow-sm relative z-20">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-5">
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-14 h-14 bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-300">
                            <Shield className="text-emerald-400" size={28} />
                        </motion.div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Infrastructure Core</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Server size={10} /> Tier-IV Network
                                </span>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Global Status: Nominal</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden lg:flex flex-col items-end border-r border-slate-100 pr-6">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Compute Load</span>
                            <span className="text-sm font-black text-slate-900">0.04% Utilization</span>
                        </div>
                        <button onClick={fetchAdminData} className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-all shadow-2xl shadow-slate-400 active:scale-95">
                            <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} /> Force Sync
                        </button>
                    </div>
                </div>

                {/* Tab Bar - Executive Sub-navigation */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all whitespace-nowrap flex items-center gap-3 ${activeTab === t.id
                                ? 'bg-slate-900 text-white shadow-xl scale-105'
                                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}>
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Viewport ── */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10">

                {/* ── DASHBOARD (Command Center) ── */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { label: 'Active Ecosystems', v: clients.length, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                                { label: 'Hardware Mesh', v: inventory.length, icon: Server, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                                { label: 'Warehouse Stock', v: inventory.filter(i => !i.is_assigned).length, icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                                { label: 'Live Data Streams', v: fleet.filter(v => v.status === 'moving').length, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                            ].map((k, i) => (
                                <motion.div whileHover={{ y: -5 }} key={i} className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-[24px] ${k.bg} flex items-center justify-center ${k.color}`}>
                                        <k.icon size={28} />
                                    </div>
                                    <div>
                                        <div className="text-3xl font-black text-slate-900">{k.v}</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{k.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {unlinkedDevices.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-50 border border-rose-100 p-8 rounded-[40px] flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm text-rose-500">
                                        <Activity size={32} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">New Hardware Detected by Traccar</h4>
                                        <p className="text-[11px] text-rose-600 font-bold uppercase mt-1 opacity-70 italic tracking-tight">{unlinkedDevices.length} NEW UUIDs detected on network. Please assign them to assets.</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveTab('devices')} className="bg-rose-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all active:scale-95 leading-none">
                                    Register Now
                                </button>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2 bg-white rounded-[40px] shadow-sm border border-slate-200 p-3 overflow-hidden flex flex-col min-h-[500px]">
                                <div className="p-6 flex justify-between items-center">
                                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-900 flex items-center gap-3">
                                        <Map size={16} className="text-emerald-500" /> Deployment Topology
                                    </h3>
                                    <button onClick={() => window.location.href = '/live'} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 hover:underline">
                                        Spectrum View <ArrowRight size={12} />
                                    </button>
                                </div>
                                <div className="rounded-[32px] overflow-hidden flex-1 m-2 border border-slate-100">
                                    <MapContainer
                                        center={fleet.find(v => v.lat && v.lng)
                                            ? [+fleet.find(v => v.lat).lat, +fleet.find(v => v.lng).lng]
                                            : [21.1458, 79.0882]}
                                        zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; ESRI" />
                                        <MarkerClusterGroup chunkedLoading>
                                            {fleet.map(v => v.lat && v.lng
                                                ? <Marker key={v.id} position={[+v.lat, +v.lng]} icon={getVehicleIcon(v)} />
                                                : null)}
                                        </MarkerClusterGroup>
                                    </MapContainer>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 flex flex-col">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-900">Security Incidents</h3>
                                    <div className="flex gap-1.5 items-center">
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-rose-500 uppercase">Live</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-5 overflow-y-auto max-h-[450px] no-scrollbar">
                                    {alertsLog.slice(0, 12).map((a, i) => (
                                        <div key={i} className="p-5 bg-slate-50/50 rounded-[24px] border border-slate-100 flex gap-5 items-start transition-all hover:bg-white hover:shadow-md hover:border-slate-200 group">
                                            <div className="w-1 h-12 rounded-full bg-rose-500 group-hover:scale-y-110 transition-transform" />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(a.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="text-xs font-black text-slate-900 mt-1.5">{a.vehicle_name || a.imei}</div>
                                                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight mt-0.5">{a.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {alertsLog.length === 0 && <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-3">
                                        <Activity size={40} className="opacity-20" />
                                        <div className="text-xs font-black uppercase tracking-widest opacity-50 text-center">No sensor collisions detected</div>
                                    </div>}
                                </div>
                                <button onClick={() => setActiveTab('alerts')} className="mt-8 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all w-full py-4 border-2 border-dashed border-slate-100 rounded-[20px] hover:border-slate-300">View Full Archive</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── OPERATIONS (Reports) ── */}
                {activeTab === 'reports' && (
                    <div className="space-y-10 animate-in fade-in duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { label: 'Ecosystem MRR', v: `₹${(revenue?.estimatedMRR ?? 0).toLocaleString()}`, icon: Layers, color: 'text-blue-500' },
                                { label: 'Projected ARR', v: `₹${(revenue?.estimatedARR ?? 0).toLocaleString()}`, icon: Activity, color: 'text-indigo-500' },
                                { label: 'Growth Vector', v: `+${(revenue?.monthlyRegistrations?.[0]?.new_clients || 0)}`, icon: Target, color: 'text-emerald-500' },
                                { label: 'Asset Utilization', v: `${Math.min(100, (fleet.length / (inventory.length || 1)) * 100).toFixed(1)}%`, icon: Zap, color: 'text-amber-500' },
                            ].map((k, i) => (
                                <div key={i} className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 rounded-2xl bg-slate-50 ${k.color}`}>
                                            <k.icon size={20} />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-slate-900">{k.v}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{k.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Mesh Expansion Velocity</h3>
                                    <div className="flex gap-2">
                                        <div className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-500">6 Months</div>
                                    </div>
                                </div>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer>
                                        <AreaChart data={revenue?.monthlyRegistrations || []}>
                                            <defs>
                                                <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontWeight: 900, fontSize: '10px' }} />
                                            <Area type="monotone" dataKey="new_clients" stroke="#2563eb" strokeWidth={5} fillOpacity={1} fill="url(#colorReg)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm flex flex-col">
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-8">Node Billing Lifecycle</h3>
                                <div className="flex-1 overflow-auto no-scrollbar">
                                    <table className="w-full text-left">
                                        <thead><tr>
                                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ecosystem</th>
                                            <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Cycle</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {clients.slice(0, 10).map((c, i) => (
                                                <tr key={i} className="group cursor-pointer">
                                                    <td className="py-5">
                                                        <div className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{c.name}</div>
                                                        <div className="text-[9px] text-slate-400 font-bold tracking-tighter">{c.email}</div>
                                                    </td>
                                                    <td className="py-5">
                                                        <div className="text-[10px] font-black text-slate-600 font-mono">{nextBilling(c.created_at)}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button className="mt-8 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline text-center">Reconcile All Accounts</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ACCOUNTS (Clients) ── */}
                {activeTab === 'clients' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in zoom-in-95 duration-700">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Unified Sovereignty</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Master Ledger Access • {clients.length} Records</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsAddingClient(!isAddingClient)} className="bg-emerald-600 text-white px-10 py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest flex items-center gap-4 transition-all hover:-translate-y-1 shadow-2xl active:scale-95">
                                    {isAddingClient ? <X size={16} /> : <Plus size={16} />} Authorize Client
                                </button>
                                <button onClick={() => setIsAssigning(!isAssigning)} className="bg-slate-900 text-white px-10 py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest flex items-center gap-4 transition-all hover:-translate-y-1 shadow-2xl active:scale-95">
                                    {isAssigning ? <X size={16} /> : <Plus size={16} />} Provision Asset
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {isAddingClient && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-10 overflow-hidden">
                                    <form onSubmit={handleAddClient} className="bg-emerald-50 p-10 rounded-[40px] border border-emerald-100 flex flex-wrap gap-8 items-end">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Client Name</label>
                                            <input required type="text" value={newClientForm.name} onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-emerald-500 shadow-sm" placeholder="John Doe" />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Email Address</label>
                                            <input required type="email" value={newClientForm.email} onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-emerald-500 shadow-sm" placeholder="client@example.com" />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Temporary Password</label>
                                            <input required type="password" value={newClientForm.password} onChange={e => setNewClientForm({ ...newClientForm, password: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-emerald-500 shadow-sm" placeholder="••••••••" />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Contact Mobile</label>
                                            <input required type="text" value={newClientForm.phone} onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-emerald-500 shadow-sm" placeholder="+1234567890" />
                                        </div>
                                        <button type="submit" className="bg-emerald-600 text-white px-10 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95">
                                            Authorize
                                        </button>
                                    </form>
                                </motion.div>
                            )}

                            {isAssigning && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-10 overflow-hidden">
                                    <form onSubmit={handleAssignDevice} className="bg-slate-50 p-10 rounded-[40px] border border-slate-100 flex flex-wrap gap-8 items-end">
                                        <div className="flex-1 min-w-[250px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Target Ecosystem</label>
                                            <select required value={assignForm.clientId} onChange={e => setAssignForm({ ...assignForm, clientId: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-blue-500 transition-all shadow-sm">
                                                <option value="">Search Credentials...</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[250px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Hardware UUID (IMEI)</label>
                                            <select required value={assignForm.imei} onChange={e => setAssignForm({ ...assignForm, imei: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-blue-500 transition-all shadow-sm">
                                                <option value="">Select Unassigned Unit...</option>
                                                {inventory.filter(i => !i.is_assigned).map(i => <option key={i.imei} value={i.imei}>{i.imei}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[250px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Vehicle Number</label>
                                            <input required type="text" value={assignForm.vehicleNumber} onChange={e => setAssignForm({ ...assignForm, vehicleNumber: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="ABC-1234" />
                                        </div>
                                        <div className="flex-1 min-w-[250px]">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Driver Name</label>
                                            <input required type="text" value={assignForm.driverName} onChange={e => setAssignForm({ ...assignForm, driverName: e.target.value })} className="w-full bg-white px-6 py-4 rounded-[20px] border border-slate-200 text-sm font-black outline-none focus:border-blue-500 transition-all shadow-sm" placeholder="Pilot Name" />
                                        </div>
                                        <button type="submit" className="bg-emerald-500 text-black px-12 py-4 rounded-[20px] font-black uppercase tracking-widest text-[11px] self-end h-[60px] shadow-lg shadow-emerald-100 hover:scale-105 active:scale-95 transition-all">Authorize Node</button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead><tr>
                                    <th className={thC}>Principal Identity</th>
                                    <th className={thC}>Mesh Strength</th>
                                    <th className={thC}>Entropy Hash</th>
                                    <th className={thC}>Authorization</th>
                                    <th className={thC + ' text-right'}>Operations</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {clients.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-all group">
                                            <td className="py-8 px-5">
                                                <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{c.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{c.email}</div>
                                            </td>
                                            <td className="py-8 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">{c.vehicle_count || 0}</div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Nodes</span>
                                                </div>
                                            </td>
                                            <td className="py-8 px-5 font-mono text-[10px] text-blue-500/50 font-black tracking-widest select-all uppercase">{(c.plain_password || 'encrypted').substring(0, 12)}</td>
                                            <td className="py-8 px-5">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase shadow-sm ${c.is_blocked ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                    {c.is_blocked ? 'De-Authorized' : 'Verified'}
                                                </span>
                                            </td>
                                            <td className="py-8 px-5 text-right">
                                                <div className="flex justify-end gap-3">
                                                    <button
                                                        onClick={() => handleImpersonate(c.id)}
                                                        className="px-5 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg hover:scale-105"
                                                    >
                                                        Remote Access
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const client = clients.find(cl => cl.id === c.id);
                                                            setEditingClient(c.id);
                                                            setEditClientForm({
                                                                name: c.name,
                                                                email: c.email,
                                                                password: '',
                                                                subscriptionPlan: client?.subscription_plan || 'Premium',
                                                                subscriptionEndDate: client?.subscription_end_date ? new Date(client.subscription_end_date).toISOString().split('T')[0] : ''
                                                            });
                                                        }}
                                                        className="px-5 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Edit profile
                                                    </button>
                                                    <button onClick={() => {
                                                        const client = clients.find(cl => cl.id === c.id);
                                                        setEditingClient(c.id);
                                                        setEditClientForm({
                                                            name: c.name,
                                                            email: c.email,
                                                            password: '',
                                                            subscriptionPlan: client?.subscription_plan || 'Premium',
                                                            subscriptionEndDate: client?.subscription_end_date ? new Date(client.subscription_end_date).toISOString().split('T')[0] : ''
                                                        });
                                                    }} className="px-5 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                                        Update Subscription
                                                    </button>
                                                    <button onClick={() => handleToggleBlock(c.id, c.is_blocked)} className={`px-5 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest transition-all ${c.is_blocked ? 'bg-emerald-500 text-black hover:scale-110 shadow-lg shadow-emerald-200' : 'bg-white border text-rose-500 hover:bg-rose-500 hover:text-white shadow-sm'}`}>
                                                        {c.is_blocked ? 'Restore Account' : 'Suspend Access'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Edit Client Modal Overlay */}
                        <AnimatePresence>
                            {editingClient && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl p-12 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50" />
                                        <h3 className="text-3xl font-black text-slate-900 mb-8 italic tracking-tighter uppercase">Authority Override: Account</h3>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Principal Name</label>
                                                <input
                                                    value={editClientForm.name}
                                                    onChange={e => setEditClientForm({ ...editClientForm, name: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Identity Email</label>
                                                <input
                                                    value={editClientForm.email}
                                                    onChange={e => setEditClientForm({ ...editClientForm, email: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Reset Master Key (Optional)</label>
                                                <input
                                                    type="password"
                                                    placeholder="Leave blank to keep current"
                                                    value={editClientForm.password}
                                                    onChange={e => setEditClientForm({ ...editClientForm, password: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Subscription Plan</label>
                                                    <select
                                                        value={editClientForm.subscriptionPlan}
                                                        onChange={e => setEditClientForm({ ...editClientForm, subscriptionPlan: e.target.value })}
                                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                                    >
                                                        <option value="Basic">Basic Plan</option>
                                                        <option value="Premium">Premium Plan</option>
                                                        <option value="Enterprise">Enterprise Plan</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Expiry Date</label>
                                                    <input
                                                        type="date"
                                                        value={editClientForm.subscriptionEndDate}
                                                        onChange={e => setEditClientForm({ ...editClientForm, subscriptionEndDate: e.target.value })}
                                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 mt-12">
                                            <button
                                                onClick={() => {
                                                    const { subscriptionPlan, subscriptionEndDate, ...rest } = editClientForm;
                                                    handleUpdateClient(editingClient, rest);
                                                    handleUpdateBilling(editingClient, { subscriptionPlan, subscriptionEndDate });
                                                    setEditingClient(null);
                                                }}
                                                className="flex-1 bg-slate-900 text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200"
                                            >
                                                Apply Override
                                            </button>
                                            <button
                                                onClick={() => setEditingClient(null)}
                                                className="px-10 bg-slate-100 text-slate-500 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] hover:bg-rose-50 hover:text-rose-500 transition-all"
                                            >
                                                Abort
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* ── FLEET CONTROL (Vehicles) ── */}
                {activeTab === 'vehicles' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in slide-in-from-right-10 duration-700">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Asset Intercept</h3>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Active Override Control Matrix</p>
                            </div>
                            <button onClick={fetchAllVehicles} className="bg-slate-100 text-slate-900 px-8 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-200 transition-all border border-slate-200 shadow-sm">
                                <RefreshCcw size={16} className={vehiclesLoading ? 'animate-spin' : ''} /> Synchronize Telemetry
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {allVehicles.map((v, i) => (
                                <motion.div
                                    whileHover={{ y: -5 }}
                                    key={i}
                                    className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-blue-500/20 transition-all group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:bg-blue-50 transition-colors" />

                                    <div className="relative flex justify-between items-start mb-6">
                                        <div className="flex flex-col">
                                            <div className="text-base font-black text-slate-900 uppercase italic tracking-tight">{v.vehicle_name}</div>
                                            <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{v.plate_number}</div>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-xs font-black text-blue-600 font-mono tracking-widest">{v.imei}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase mt-1">GPRS SECURE</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
                                        <div className="flex justify-between items-center mb-5">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Velocity Threshold</div>
                                            <div className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-sm font-bold italic">{v.speed_limit || 80} KM/H</div>
                                        </div>
                                        <button
                                            onClick={() => { setSpeedEditId(v.id); setSpeedEditVal(String(v.speed_limit || 80)); }}
                                            className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                        >
                                            Adjust Limit
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-3 relative">
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => initiateEngineControl(v.imei, 'ENGINE_STOP')}
                                                className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 border border-rose-100/50"
                                            >
                                                Kill Engine
                                            </button>
                                            <button
                                                onClick={() => initiateEngineControl(v.imei, 'ENGINE_RESUME')}
                                                className="flex-1 bg-emerald-50 text-emerald-600 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 border border-emerald-100/50"
                                            >
                                                Resume
                                            </button>
                                        </div>
                                        {engineStatus[v.imei] && (
                                            <div className="text-[10px] font-black text-blue-600 uppercase text-center mt-2 bg-blue-50 py-2 rounded-xl border border-blue-100 animate-pulse">
                                                Status: {engineStatus[v.imei]}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {allVehicles.length === 0 && (
                                <div className="col-span-full py-24 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <Activity size={48} className="opacity-20 animate-pulse" />
                                    <div className="text-sm font-black uppercase tracking-[0.2em] opacity-50">Operational Stasis • No Assets Detected</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── HARDWARE (Devices) ── */}
                {activeTab === 'devices' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in fade-in duration-700">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Master Shells</h3>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Inventory Ledger • {inventory.length} HW Units</p>
                            </div>
                            <button onClick={() => setIsAddingDevice(!isAddingDevice)} className="bg-slate-900 text-white px-10 py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest flex items-center gap-4 shadow-xl active:scale-95 transition-all">
                                {isAddingDevice ? <X size={16} /> : <Plus size={16} />} Register Hardware
                            </button>
                        </div>

                        {isAddingDevice && (
                            <motion.form initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onSubmit={handleAddInventory} className="bg-slate-900 p-10 rounded-[40px] shadow-2xl mb-12 flex flex-wrap gap-8 items-end">
                                <div className="flex-1 min-w-[300px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Hard-Coded UUID (IMEI)</label>
                                    <input type="text" placeholder="SHIPPING_IMEI_15" required maxLength={15} value={newDevice.imei} onChange={e => setNewDevice({ ...newDevice, imei: e.target.value })} className="w-full bg-slate-800 border-none px-6 py-5 rounded-[22px] text-white font-black font-mono focus:ring-2 ring-emerald-500 outline-none shadow-inner" />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Protocol Stack</label>
                                    <select value={newDevice.protocol} onChange={e => setNewDevice({ ...newDevice, protocol: e.target.value })} className="w-full bg-slate-800 border-none px-6 py-5 rounded-[22px] text-white font-black uppercase tracking-widest text-[11px] outline-none shadow-inner">
                                        <option value="GT06">GT06 / J13</option>
                                        <option value="TK103">TK / Coban</option>
                                        <option value="Teltonika">Teltonika / FMB</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-emerald-500 text-black px-12 py-5 rounded-[22px] font-black uppercase tracking-widest text-[11px] h-[64px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-900/40">Inject to Ledger</button>
                            </motion.form>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {inventory.map((inv, i) => (
                                <div key={i} className="bg-white rounded-[32px] p-8 border border-slate-100 flex flex-col items-center text-center hover:shadow-xl transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:bg-blue-50 transition-colors" />
                                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner relative">
                                        <Cpu size={28} />
                                    </div>
                                    <div className="text-sm font-black text-slate-900 mb-1 tracking-tight">{inv.imei}</div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Type: {inv.protocol}</div>

                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${inv.is_assigned ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                        {inv.is_assigned ? 'In Operation' : 'Vault Ready'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── SYSTEM (Health/Backup) ── */}
                {activeTab === 'health' && (
                    <div className="space-y-10 animate-in fade-in duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { label: 'Server Uptime', v: health?.uptime || 'N/A', icon: Clock, desc: 'Session continuity index' },
                                { label: 'Data Retention', v: 'LIFETIME', icon: Shield, desc: 'Strategic permanence policy' },
                                { label: 'Persistence Load', v: health?.dbStats?.dbSize || 'N/A', icon: Database, desc: 'PostgreSQL storage footprint' },
                            ].map((h, i) => (
                                <div key={i} className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm">
                                    <div className="flex items-center gap-5 mb-8">
                                        <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xl">
                                            <h.icon size={24} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h.label}</div>
                                            <div className="text-xl font-black text-slate-900 mt-1">{h.v}</div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{h.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-900 rounded-[40px] p-12 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-20 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all" />
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <h3 className="text-3xl font-black italic tracking-tighter mb-4">Master Ledger Snapshot</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-xl text-emerald-400">LIFETIME DATA PERSISTENCE: ENABLED</p>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest max-w-xl">Deep system inspection of telemetry partitions. Data is automatically mirrored to Google Cloud every 24 hours.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-black text-emerald-400 tabular-nums">1.2ms</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Mean Latency</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mt-16 relative z-10">
                                {Object.entries(health?.dbStats || {}).filter(([k]) => k !== 'dbSize').map(([key, val]) => (
                                    <div key={key} className="border-l-2 border-slate-800 pl-8">
                                        <div className="text-3xl font-black text-white">{String(val)}</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{key} Registry</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RECOVERY (Backup) ── */}
                {activeTab === 'backup' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-12 shadow-sm animate-in zoom-in-95 duration-700 max-w-5xl mx-auto">
                        <div className="flex items-center gap-8 mb-12">
                            <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-blue-200">
                                <Clock size={48} />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Archive Orchestration</h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">Cloud Synchonization Status: Verified</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 italic font-black text-slate-500 text-sm leading-relaxed">
                                    "Platform persistence is prioritized. Cold telemetry is never purged from the primary ledger, ensuring lifetime tracking history. Cloud redundancy provides a full disaster recovery fail-safe."
                                </div>
                                <div className="flex flex-col gap-4">
                                    <button onClick={triggerBackup} disabled={backupLoading} className="w-full bg-slate-900 text-white rounded-[24px] py-6 font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                                        {backupLoading ? 'Synchronizing Cluster...' : 'Initiate Cold-Storage Migration'}
                                    </button>
                                    {backupMsg && <div className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-500">{backupMsg}</div>}
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Remote Path</span>
                                        <a href={backupStatus?.driveLink || health?.googleDriveLink} className="text-xs font-black text-blue-600 hover:underline break-all uppercase selection:bg-blue-100">CLOUD_ROOT_ARCHIVE_SECURE_v4</a>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Next Automated Sequence</span>
                                        <span className="text-xs font-black text-slate-900 uppercase">01:00:00 UTC</span>
                                    </div>
                                </div>
                                <div className="pt-8 border-t border-slate-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Mirroring Protocol</span>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">AES-256 Gdrive</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ALERTS (Alert History) ── */}
                {activeTab === 'alerts' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in fade-in duration-700">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Security Archive</h3>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Historical Incident Logs</p>
                            </div>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    placeholder="Filter by Type/IMEI..."
                                    className="px-6 py-3 rounded-2xl border border-slate-100 text-xs font-black outline-none focus:border-blue-500 shadow-sm"
                                    value={alertFilter}
                                    onChange={(e) => setAlertFilter(e.target.value)}
                                />
                                <button onClick={fetchAlerts} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Refresh</button>
                            </div>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead><tr>
                                    <th className={thC}>Timestamp</th>
                                    <th className={thC}>Target Asset</th>
                                    <th className={thC}>Incident Vector</th>
                                    <th className={thC}>Network Key (IMEI)</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {alertsLog.map((a, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-6 px-5 text-[10px] font-black text-slate-400 font-mono italic">
                                                {new Date(a.timestamp).toLocaleString()}
                                            </td>
                                            <td className="py-6 px-5">
                                                <div className="text-xs font-black text-slate-900 uppercase">{a.vehicle_name || 'Generic Node'}</div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase">{a.plate_number || 'N/A'}</div>
                                            </td>
                                            <td className="py-6 px-5">
                                                <div className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">{a.message}</div>
                                            </td>
                                            <td className="py-6 px-5 text-[10px] font-black text-slate-400 font-mono tracking-widest">
                                                {a.imei}
                                            </td>
                                        </tr>
                                    ))}
                                    {alertsLog.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="py-24 text-center">
                                                <div className="text-slate-300 font-black uppercase tracking-widest text-xs">No incident records found in secure archive</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── MODELS (Device Protocols) ── */}
                {activeTab === 'models' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in zoom-in-95 duration-700">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Protocol Matrix</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-2">Manage Device Communication Standards</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-1 space-y-8">
                                <form onSubmit={handleAddModel} className="bg-slate-900 p-8 rounded-[32px] shadow-2xl space-y-6">
                                    <h4 className="text-white text-[11px] font-black uppercase tracking-widest border-b border-white/10 pb-4">Define New Model</h4>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Model Name</label>
                                        <input required value={newModel.name} onChange={e => setNewModel({ ...newModel, name: e.target.value })} placeholder="e.g. Concox GT06N" className="w-full bg-slate-800 border-none px-5 py-4 rounded-[18px] text-white font-bold text-sm outline-none focus:ring-2 ring-emerald-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Base Protocol</label>
                                        <select value={newModel.protocol} onChange={e => setNewModel({ ...newModel, protocol: e.target.value })} className="w-full bg-slate-800 border-none px-5 py-4 rounded-[18px] text-white font-bold text-sm outline-none focus:ring-2 ring-emerald-500 transition-all uppercase tracking-widest italic">
                                            <option value="GT06">GT06 / J13</option>
                                            <option value="TK103">TK / Coban</option>
                                            <option value="Teltonika">Teltonika / FMB</option>
                                            <option value="H02">H02 / Watch</option>
                                        </select>
                                    </div>
                                    <button type="submit" className="w-full bg-emerald-500 text-black py-4 rounded-[18px] font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20">Initialize Model</button>
                                </form>
                            </div>

                            <div className="lg:col-span-2 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {deviceModels.map((m, i) => (
                                        <div key={i} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-emerald-500 transition-colors">
                                                    <Target size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-900 uppercase italic">{m.model_name}</div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{m.protocol} Stack</div>
                                                </div>
                                            </div>
                                            <button onClick={() => { setSelectedModelId(m.id); setActiveTab('commands'); }} className="w-10 h-10 bg-slate-200/50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {deviceModels.length === 0 && <div className="col-span-2 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] border-2 border-dashed border-slate-100 rounded-[40px]">No infrastructure models registered</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── COMMANDS (GPRS Templates) ── */}
                {activeTab === 'commands' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in slide-in-from-right-10 duration-700">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">GPRS Command Matrix</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-2">Define Protocol-Specific Execution Strings</p>
                            </div>
                            <button
                                onClick={() => {
                                    const proto = prompt('Enter Protocol (e.g., GT06, TK103, Teltonika):');
                                    const act = prompt('Enter Action (IGNITION_ON / IGNITION_OFF):');
                                    const str = prompt('Enter Command String:');
                                    if (proto && act && str) handleSaveTemplate({ protocol: proto, action: act, command_string: str, description: `Remote ${act} for ${proto}` });
                                }}
                                className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl hover:-translate-y-1 transition-all active:scale-95"
                            >
                                <Plus size={14} /> New Blueprint
                            </button>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className={thC}>Protocol Stack</th>
                                        <th className={thC}>Directives</th>
                                        <th className={thC}>Execution String</th>
                                        <th className={thC + ' text-right'}>Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {commandTemplates.map((t, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                            <td className="py-8 px-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg">
                                                        <Cpu size={18} />
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900 uppercase italic tracking-tighter">{t.protocol}</span>
                                                </div>
                                            </td>
                                            <td className="py-8 px-5">
                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${t.action === 'IGNITION_ON' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                                    }`}>
                                                    {t.action}
                                                </span>
                                            </td>
                                            <td className="py-8 px-5">
                                                <div className="relative group/input max-w-md">
                                                    <input
                                                        defaultValue={t.command_string}
                                                        onBlur={(e) => handleSaveTemplate({ ...t, command_string: e.target.value })}
                                                        className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-xl text-xs font-mono font-black text-blue-600 focus:bg-white focus:border-blue-500 outline-none transition-all shadow-inner"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity text-[8px] font-black uppercase text-slate-400 tracking-widest">Auto-Save</div>
                                                </div>
                                            </td>
                                            <td className="py-8 px-5 text-right">
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Erase this execution blueprint?')) {
                                                            await fetch(`${API_BASE}/api/admin/command-templates/${t.id}`, { method: 'DELETE' });
                                                            fetchCommandTemplates();
                                                        }
                                                    }}
                                                    className="w-10 h-10 bg-rose-50 text-rose-400 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {commandTemplates.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="py-32 text-center">
                                                <div className="flex flex-col items-center gap-6 grayscale opacity-40 italic">
                                                    <Zap size={64} className="animate-pulse" />
                                                    <div className="text-sm font-black uppercase tracking-[0.4em] text-slate-300">No Execution Templates Initialized</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── AUDIT TRAIL (Logs) ── */}
                {activeTab === 'logs' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in fade-in duration-700">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Audit Flux</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-2">Global System Interaction History</p>
                            </div>
                            <button onClick={fetchCommandLogs} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                <RefreshCcw size={18} className={logsLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {commandLogs.length > 0 ? (
                                <div className="overflow-auto rounded-[32px] border border-slate-100 shadow-sm">
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-slate-50/50">
                                            <th className={thC}>Sequence Time</th>
                                            <th className={thC}>Relay Node (IMEI)</th>
                                            <th className={thC}>Directive</th>
                                            <th className={thC}>Payload Signature</th>
                                            <th className={thC + ' text-right'}>Status</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {commandLogs.map((l, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-6 font-mono text-[10px] text-slate-400">{new Date(l.timestamp).toLocaleString()}</td>
                                                    <td className="p-6 font-black text-xs text-slate-900 uppercase italic tracking-tight">{l.imei}</td>
                                                    <td className="p-6">
                                                        <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">{l.command_type}</span>
                                                    </td>
                                                    <td className="p-6 font-mono text-[10px] text-blue-500/60 max-w-[200px] truncate">{(l.payload || 'N/A')}</td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Dispatched</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-32 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center gap-6 opacity-30 italic">
                                    <Search size={64} />
                                    <span className="text-sm font-black uppercase tracking-widest">No spectral trace detected in current time-slice</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SECURITY ALERTS (Alerts) ── */}
                {activeTab === 'alerts' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in fade-in duration-700">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Security Incidents</h3>
                                <p className="text-slate-600 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">Full Archive of System & Asset Alerts</p>
                            </div>
                            <button onClick={fetchAlerts} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                <RefreshCcw size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {alertsLog.length > 0 ? (
                                <div className="space-y-4">
                                    {alertsLog.map((a, i) => (
                                        <div key={i} className="p-6 bg-slate-50/50 rounded-[24px] border border-slate-100 flex gap-6 items-center transition-all hover:bg-white hover:shadow-md hover:border-slate-200 group">
                                            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{a.vehicle_name || a.imei}</div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(a.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs text-rose-600 font-bold tracking-tight uppercase">{a.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-32 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center gap-6 opacity-40">
                                    <Activity size={64} className="text-slate-300" />
                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">No Alerts Recorded</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MAINTENANCE (Backup) ── */}
                {activeTab === 'backup' && (
                    <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm animate-in fade-in duration-700">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">Maintenance Matrix</h3>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-2">Disaster Recovery & System Cooldown</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="bg-slate-50/50 rounded-[32px] border border-slate-100 p-10">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                        <Database size={24} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-slate-900 uppercase tracking-tight">Cloud Snapshot</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automated System Redundancy</div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center py-4 border-b border-slate-100">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Execution</span>
                                        <span className="text-xs font-black text-slate-900">{backupStatus?.lastBackup || 'Never'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-4 border-b border-slate-100">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Archive Size</span>
                                        <span className="text-xs font-black text-slate-900">{backupStatus?.fileSize || '0 KB'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={triggerBackup}
                                    disabled={backupLoading}
                                    className="w-full mt-10 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] shadow-xl transition-all disabled:opacity-50"
                                >
                                    {backupLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Clock size={14} />}
                                    Commence Global Backup
                                </button>
                                {backupMsg && (
                                    <div className="mt-4 p-4 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase text-center border border-emerald-100">
                                        {backupMsg}
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-50/50 rounded-[32px] border border-slate-100 p-10">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-slate-900 uppercase tracking-tight">System Integrity</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Health Parameters</div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider">
                                    Performing system maintenance ensures 99.99% uptime and protects sovereign data against local corruption or hardware failure.
                                </p>
                                <div className="mt-10 p-6 bg-white rounded-2xl border border-slate-100 flex items-center gap-4">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                                    <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">All Nodes Synchronized</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Command PIN Modal */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[340px] overflow-hidden"
                        >
                            <div className={`p-5 text-white flex items-center gap-3 ${pendingCmd?.command === 'ENGINE_STOP' ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-emerald-600 to-green-500'}`}>
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                                    {pendingCmd?.command === 'ENGINE_STOP' ? '🔴' : '🟢'}
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-widest opacity-80">Secure Command</div>
                                    <div className="text-base font-black">
                                        {pendingCmd?.command === 'ENGINE_STOP' ? 'Engine Cut' : 'Engine Restore'}
                                    </div>
                                </div>
                            </div>
                            <form onSubmit={handleEngineControlSubmit} className="p-5 space-y-4">
                                <div className="text-sm text-slate-600 leading-relaxed">
                                    Enter your 4-digit PIN to confirm this action on <span className="font-bold">{pendingCmd?.imei}</span>.
                                </div>
                                {pinError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2">
                                        <Shield size={12} /> {pinError}
                                    </div>
                                )}
                                <div>
                                    <input
                                        type="password" maxLength="4" autoFocus
                                        value={pinCode}
                                        onChange={(e) => setPinCode(e.target.value)}
                                        placeholder="••••"
                                        className="w-full text-center tracking-[0.8em] py-3 px-4 border-2 border-slate-300 rounded-xl font-mono font-black text-2xl outline-none focus:border-blue-500 transition-all text-slate-800 bg-slate-50"
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setShowPinModal(false)} className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-sm transition-colors border border-slate-200">Cancel</button>
                                    <button type="submit" disabled={isEngineSending || pinCode.length < 4} className={`flex-1 py-2.5 rounded-xl font-black text-sm uppercase text-white transition-all disabled:opacity-50 ${pendingCmd?.command === 'ENGINE_STOP' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                        {isEngineSending ? '⏳ Sending' : '✅ Confirm'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
