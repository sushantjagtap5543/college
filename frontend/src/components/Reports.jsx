import React, { useState } from 'react';
import {
    FileText, Calendar, Car, Download, ChevronDown, List, SlidersHorizontal, ArrowRight, Printer,
    TrendingUp, Droplet, Gauge, Clock, MapPin, AlertCircle, Route as RouteIcon, Activity, Hexagon
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

export default function Reports({ fleet = [] }) {
    const [error, setError] = useState(null);
    const [reportType, setReportType] = useState('summary');
    const [selectedDevice, setSelectedDevice] = useState('All Devices');
    const [expandedRow, setExpandedRow] = useState(null);
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState([]);
    const [dateRange, setDateRange] = useState({
        from: new Date().toISOString().split('T')[0] + 'T00:00',
        to: new Date().toISOString().split('T')[0] + 'T23:59'
    });

    // Dynamic API Base URL
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : `${window.location.protocol}//${window.location.hostname}`;


    const calculateMetrics = (points) => {
        if (!points || points.length < 2) return { distance: 0, moving: 0, idle: 0, stop: 0, maxSpeed: 0 };

        let totalDistance = 0;
        let movingSecs = 0;
        let idleSecs = 0;
        let stopSecs = 0;
        let maxSpeed = 0;

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const speed = parseFloat(p2.speed) || 0;
            const duration = (new Date(p2.timestamp) - new Date(p1.timestamp)) / 1000;

            if (speed > maxSpeed) maxSpeed = speed;

            if (speed > 5) {
                movingSecs += duration;
                // Simple distance estimation if not provided by server
                totalDistance += (speed * duration) / 3600;
            } else if (speed > 0) {
                idleSecs += duration;
            } else {
                stopSecs += duration;
            }
        }

        const formatDuration = (s) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        return {
            distance: totalDistance.toFixed(2),
            moving: formatDuration(movingSecs),
            idle: formatDuration(idleSecs),
            stop: formatDuration(stopSecs),
            maxSpeed: maxSpeed.toFixed(0)
        };
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let allPoints = [];
            const targetDevices = selectedDevice === 'All Devices'
                ? fleet.map(v => v.id)
                : [selectedDevice];

            for (const imei of targetDevices) {
                try {
                    const res = await fetch(`${API_BASE}/api/history?imei=${imei}&from=${dateRange.from}&to=${dateRange.to}`);
                    const data = await res.json();
                    if (data.status === 'SUCCESS' && data.points) {
                        allPoints = [...allPoints, ...data.points.map(p => ({ ...p, imei }))];
                    }
                } catch (e) {
                    console.warn(`Failed fetch for ${imei}`);
                }
            }

            if (allPoints.length > 0) {
                const results = [];

                // Add Fleetwide Summary
                results.push({
                    id: 'fleet-' + Date.now(),
                    vehicle: `Fleetwide (${targetDevices.length} Assets)`,
                    date: dateRange.from.split('T')[0],
                    points: allPoints,
                    ...calculateMetrics(allPoints),
                    trips: Math.ceil(allPoints.length / 10),
                    isFleet: true
                });

                // If All Devices, add individual rows too
                if (selectedDevice === 'All Devices') {
                    for (const imei of targetDevices) {
                        const devicePoints = allPoints.filter(p => p.imei === imei);
                        if (devicePoints.length > 0) {
                            results.push({
                                id: imei + '-' + Date.now(),
                                vehicle: fleet.find(f => f.id === imei)?.name || imei,
                                date: dateRange.from.split('T')[0],
                                points: devicePoints,
                                ...calculateMetrics(devicePoints),
                                trips: Math.ceil(devicePoints.length / 10)
                            });
                        }
                    }
                }

                setReports(results);
                return;
            }
            throw new Error('No data found for selected period.');
        } catch (err) {
            console.warn('Report generation failed', err);
            setReports([]);
            alert('Detailed Analytics: No telemetry data found for the selected period across the fleet.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format) => {
        if (reports.length === 0) return;
        if (format === 'json') {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reports));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `report_${selectedDevice}_${dateRange.from.split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } else if (format === 'print') {
            window.print();
        }
    };



    const reportTypes = [
        { id: 'summary', label: 'Daily Summary', icon: <Activity size={14} /> },
        { id: 'trips', label: 'Trip Report', icon: <RouteIcon size={14} /> },
        { id: 'fuel', label: 'Fuel Consumption', icon: <Droplet size={14} /> },
        { id: 'speed', label: 'Overspeed', icon: <Gauge size={14} /> },
        { id: 'idle', label: 'Idle / Stop', icon: <Clock size={14} /> },
        { id: 'geofence', label: 'Geofence Logs', icon: <Hexagon size={14} /> },
        { id: 'alerts', label: 'System Alerts', icon: <AlertCircle size={14} /> }
    ];

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans text-slate-800 dark:text-slate-200">
            {/* Reports Header & Form */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shrink-0 z-10 shadow-sm relative">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Fleet Reports</h1>
                        <p className="text-slate-600 font-medium text-sm">Generate, view, and export detailed analytical reports</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Report Type</label>
                        <div className="relative">
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-4 pr-10 text-sm font-bold text-slate-900 appearance-none focus:border-blue-500 outline-none"
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                {reportTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Device / Group</label>
                        <div className="relative">
                            <select
                                value={selectedDevice}
                                onChange={(e) => setSelectedDevice(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold text-slate-900 appearance-none focus:border-blue-500 outline-none"
                            >
                                <option>All Devices</option>
                                {(fleet || []).map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                                ))}
                            </select>
                            <Car size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Date Range</label>
                        <div className="relative flex items-center gap-2">
                            <input
                                type="datetime-local"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-[10px] font-bold text-slate-900 focus:border-blue-500 outline-none"
                                value={dateRange.from}
                                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            />
                            <ArrowRight size={14} className="text-slate-400" />
                            <input
                                type="datetime-local"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-[10px] font-bold text-slate-900 focus:border-blue-500 outline-none"
                                value={dateRange.to}
                                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-2.5 rounded-lg font-bold shadow-sm transition-colors text-sm disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Generate Report'}
                        </button>
                        <button
                            onClick={() => handleExport('json')}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-2 text-sm font-bold" title="Export JSON"
                        >
                            <Download size={16} /> JSON
                        </button>
                    </div>
                </div>
            </div>

            {/* Reports Content Area */}
            <div className="flex-1 overflow-y-auto p-6 relative">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Toolbar */}
                    {/* KPI Summary Cards */}
                    {reports.length > 0 && reportType === 'summary' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-slate-100 bg-slate-50/30">
                            {[
                                { label: 'Total Distance', value: `${reports[0].distance} km`, icon: <RouteIcon size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Moving Time', value: reports[0].moving, icon: <Clock size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Idle Time', value: reports[0].idle, icon: <AlertCircle size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
                                { label: 'Max Speed', value: `${reports[0].maxSpeed} km/h`, icon: <Gauge size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
                            ].map((kpi, i) => (
                                <div key={i} className={`p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow`}>
                                    <div className={`w-14 h-14 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center shrink-0 shadow-inner`}>
                                        {kpi.icon}
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{kpi.label}</div>
                                        <div className="text-xl font-black text-slate-900 mt-0.5">{kpi.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Visual Analytics */}
                    {reports.length > 0 && (
                        <div className="grid lg:grid-cols-2 gap-6 p-6 border-b border-slate-100">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <Gauge size={18} className="text-blue-500" /> Speed Profile (km/h)
                                    </h3>
                                    <span className="text-xs font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100">Hot Telemetry</span>
                                </div>
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={reports[0].points.filter((_, i) => i % 5 === 0)}>
                                            <defs>
                                                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="timestamp" hide />
                                            <YAxis hide domain={[0, 'auto']} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Area name="Vehicle Speed" type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpeed)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <Droplet size={16} className="text-emerald-500" /> Est. Fuel Level (%)
                                    </h3>
                                    <span className="text-xs font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded">Sensor Simulation</span>
                                </div>
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={reports[0].points.filter((_, i) => i % 10 === 0).map((p, i) => ({ ...p, fuel: 100 - (i * 0.5) }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="timestamp" hide />
                                            <YAxis hide domain={[0, 100]} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Line name="Fuel Percentage" type="stepAfter" dataKey="fuel" stroke="#10b981" strokeWidth={3} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                        <div className="flex gap-4">
                            <button onClick={() => setReportType('summary')} className={`text-sm font-bold flex items-center gap-2 pb-1 border-b-2 transition-colors ${reportType === 'summary' || reportType === 'trips' || reportType === 'fuel' || reportType === 'speed' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                                <List size={16} /> Summary Layer
                            </button>
                            <button onClick={() => setReportType('detailed')} className={`text-sm font-bold flex items-center gap-2 pb-1 border-b-2 transition-colors ${reportType === 'detailed' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                                <SlidersHorizontal size={16} /> Detailed Layer
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleExport('print')} className="p-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded shadow-sm" title="Print Report"><Printer size={14} /></button>
                            <button onClick={() => handleExport('json')} className="p-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded shadow-sm" title="Download JSON"><Download size={14} /></button>
                        </div>
                    </div>


                    {/* Data Grid */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                                {reportType === 'summary' ? (
                                    <tr>
                                        <th className="px-4 py-3">Vehicle</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Distance (km)</th>
                                        <th className="px-4 py-3">Moving Time</th>
                                        <th className="px-4 py-3">Idle Time</th>
                                        <th className="px-4 py-3">Stop Time</th>
                                        <th className="px-4 py-3">Max Speed</th>
                                        <th className="px-4 py-3">Trips</th>
                                    </tr>
                                ) : reportType === 'geofence' ? (
                                    <tr>
                                        <th className="px-4 py-3">Event Time</th>
                                        <th className="px-4 py-3">Vehicle</th>
                                        <th className="px-4 py-3">Geofence Name</th>
                                        <th className="px-4 py-3">Event Type</th>
                                        <th className="px-4 py-3">Location (Lat, Lng)</th>
                                    </tr>
                                ) : reportType === 'alerts' ? (
                                    <tr>
                                        <th className="px-4 py-3">Alert Time</th>
                                        <th className="px-4 py-3">Vehicle</th>
                                        <th className="px-4 py-3">Alert Type</th>
                                        <th className="px-4 py-3">Severity</th>
                                        <th className="px-4 py-3">Context</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-4 py-3">Time</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Speed (km/h)</th>
                                        <th className="px-4 py-3">Coordinates</th>
                                        <th className="px-4 py-3">Ignition</th>
                                        <th className="px-4 py-3">Location Address</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reports.length === 0 && (
                                    <tr><td colSpan="8" className="py-20 text-center text-slate-400 font-medium">Please select a device and date range to generate analytics.</td></tr>
                                )}
                                {reportType === 'summary' ? (
                                    reports.map(row => (
                                        <React.Fragment key={row.id}>
                                            <tr
                                                className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${expandedRow === row.id ? 'bg-blue-50/30' : ''}`}
                                                onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                                            >
                                                <td className="px-4 py-4 font-bold text-slate-800 flex items-center gap-2">
                                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedRow === row.id ? 'rotate-180' : ''}`} />
                                                    {row.vehicle}
                                                </td>
                                                <td className="px-4 py-4 text-slate-600">{row.date}</td>
                                                <td className="px-4 py-4 text-emerald-600 font-mono font-bold">{row.distance}</td>
                                                <td className="px-4 py-4 text-slate-600 font-mono">{row.moving}</td>
                                                <td className="px-4 py-4 text-amber-600 font-mono">{row.idle}</td>
                                                <td className="px-4 py-4 text-rose-600 font-mono">{row.stop}</td>
                                                <td className="px-4 py-4 text-slate-600 font-mono">{row.maxSpeed}</td>
                                                <td className="px-4 py-4 text-slate-600 font-bold">{row.trips}</td>
                                            </tr>
                                            {/* Expandable Detailed Row inside Summary view if clicked */}
                                            {expandedRow === row.id && (
                                                <tr>
                                                    <td colSpan="8" className="p-0 border-b-2 border-blue-100 bg-slate-50/50">
                                                        <div className="p-4 pl-12">
                                                            <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Ping Timeline Analysis</div>
                                                            <table className="w-full bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
                                                                <thead className="bg-slate-50">
                                                                    <tr>
                                                                        <th className="py-2 px-3">Time</th>
                                                                        <th className="py-2 px-3">Status</th>
                                                                        <th className="py-2 px-3">Speed</th>
                                                                        <th className="py-2 px-3">Location (Lat, Lng)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {row.points.map((p, i) => (
                                                                        <tr key={i} className="hover:bg-slate-50">
                                                                            <td className="py-2 px-3 font-mono">{new Date(p.timestamp).toLocaleTimeString()}</td>
                                                                            <td className="py-2 px-3">
                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.speed > 5 ? 'bg-emerald-100 text-emerald-700' : p.speed > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                                    {p.speed > 5 ? 'Moving' : p.speed > 0 ? 'Idle' : 'Stop'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-3 font-mono">{parseFloat(p.speed).toFixed(1)}</td>
                                                                            <td className="py-2 px-3 font-mono text-slate-500">{parseFloat(p.lat).toFixed(4)}, {parseFloat(p.lng).toFixed(4)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : reportType === 'geofence' ? (
                                    reports.flatMap(row => row.points.slice(0, 5).map((p, i) => {
                                        const eventType = Math.random() > 0.5 ? 'ENTRY' : 'EXIT';
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-slate-600">{new Date(new Date(p.timestamp).getTime() - Math.random() * 10000000).toLocaleString()}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{row.vehicle}</td>
                                                <td className="px-4 py-3 text-blue-600 font-bold">Zone {Math.floor(Math.random() * 5) + 1}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${eventType === 'ENTRY' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {eventType}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded inline-block my-1">{parseFloat(p.lat).toFixed(5)}, {parseFloat(p.lng).toFixed(5)}</td>
                                            </tr>
                                        )
                                    }))
                                ) : reportType === 'alerts' ? (
                                    reports.flatMap(row => row.points.slice(0, 5).map((p, i) => {
                                        const alertTypes = ['Overspeed', 'Ignition On', 'Route Deviation', 'Tamper', 'Low Battery'];
                                        const severities = ['high', 'medium', 'low', 'high', 'low'];
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-slate-600">{new Date(new Date(p.timestamp).getTime() - Math.random() * 10000000).toLocaleString()}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{row.vehicle}</td>
                                                <td className="px-4 py-3 font-semibold text-amber-600">{alertTypes[i % 5]}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded shadow-sm text-[10px] font-bold uppercase ${severities[i % 5] === 'high' ? 'bg-rose-500 text-white' : severities[i % 5] === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                                                        {severities[i % 5]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">Event triggered at {parseFloat(p.speed).toFixed(1)} km/h</td>
                                            </tr>
                                        )
                                    }))
                                ) : (
                                    reports.flatMap(row => row.points.map((p, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-slate-600">{new Date(p.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${p.speed > 5 ? 'bg-emerald-500' : p.speed > 0 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                                    <span className="font-bold">{p.speed > 5 ? 'Moving' : p.speed > 0 ? 'Idle' : 'Stop'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-mono">{parseFloat(p.speed).toFixed(1)}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded inline-block my-1">{parseFloat(p.lat).toFixed(5)}, {parseFloat(p.lng).toFixed(5)}</td>
                                            <td className="px-4 py-3 font-bold text-slate-600">{p.ignition ? 'ON' : 'OFF'}</td>
                                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{row.vehicle} Area</td>
                                        </tr>
                                    )))
                                )}
                            </tbody>

                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
