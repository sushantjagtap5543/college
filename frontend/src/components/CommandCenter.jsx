import React, { useState } from 'react';
import {
    Terminal, Send, Smartphone, Shield, Zap,
    History, CheckCircle2, AlertTriangle, Info,
    Power, RefreshCw, MapPin, Loader2, Search
} from 'lucide-react';

export default function CommandCenter({ fleet = [] }) {
    const [selectedDevice, setSelectedDevice] = useState('');
    const [commandType, setCommandType] = useState('engine_stop');
    const [customCommand, setCustomCommand] = useState('');
    const [sending, setSending] = useState(false);
    const [commandHistory, setCommandHistory] = useState([
        { id: 1, device: 'Truck Alpha', command: 'Engine Stop', status: 'SUCCESS', time: '10:45 AM' },
        { id: 2, device: 'Van Beta', command: 'Refresh Loc', status: 'FAILED', time: '09:12 AM' },
    ]);
    const [status, setStatus] = useState(null);
    const [securityCode, setSecurityCode] = useState('');
    const [userCodeInput, setUserCodeInput] = useState('');

    const commands = [
        { id: 'engine_stop', label: 'Engine Stop', icon: Power, color: 'text-rose-500', desc: 'Securely immobilize the vehicle engine.' },
        { id: 'engine_resume', label: 'Engine Resume', icon: Zap, color: 'text-emerald-500', desc: 'Restore engine power for normal operation.' },
        { id: 'refresh_location', label: 'Force Refresh', icon: RefreshCw, color: 'text-blue-500', desc: 'Request immediate GPS coordinate update.' },
        { id: 'clear_alarms', label: 'Reset Alarms', icon: Shield, color: 'text-amber-500', desc: 'Dismiss all active device-side siren/alerts.' },
    ];

    const generateCode = () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setSecurityCode(code);
        setUserCodeInput('');
    };

    const handleCommandSelect = (id) => {
        setCommandType(id);
        if (id === 'engine_stop') {
            generateCode();
        } else {
            setSecurityCode('');
            setUserCodeInput('');
        }
    };

    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : `${window.location.protocol}//${window.location.hostname}`;

    const handleSend = async () => {
        if (!selectedDevice) return;

        const device = fleet.find(v => v.id === selectedDevice);

        if (commandType === 'engine_stop') {
            if (userCodeInput !== securityCode) {
                setStatus({ type: 'error', message: 'Security code mismatch. Please check and try again.' });
                return;
            }
            if (device && device.speed > 20) {
                setStatus({ type: 'error', message: `Cannot immobilize: Vehicle speed is ${device.speed} km/h (above safe threshold of 20 km/h).` });
                return;
            }
        }

        setSending(true);
        setStatus(null);

        try {
            const cmd = commands.find(c => c.id === commandType);

            let backendCommand = commandType;
            if (commandType === 'engine_stop') backendCommand = 'CUT_ENGINE';
            if (commandType === 'engine_resume') backendCommand = 'RESTORE_ENGINE';
            if (commandType === 'custom') backendCommand = customCommand;

            const res = await fetch(`${API_BASE}/api/commands/sms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: selectedDevice,
                    commandType: backendCommand,
                    isDemo: false
                })
            });

            const data = await res.json();

            setCommandHistory([
                {
                    id: Date.now(),
                    device: device?.name || selectedDevice,
                    command: cmd?.label || customCommand || 'Command',
                    status: data.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                },
                ...commandHistory
            ]);

            if (data.status === 'SUCCESS') {
                setStatus({ type: 'success', message: 'Command dispatched successfully.' });
            } else {
                setStatus({ type: 'error', message: data.message || 'Dispatch failed.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Network error. Backend unreachable.' });
        } finally {
            setSending(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            <div className="bg-slate-900 text-white p-6 shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Terminal className="text-blue-400" /> Command Center
                    </h1>
                    <p className="text-slate-400 text-sm font-medium">Remote Secure Device Orchestration</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-xs font-bold">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> GPRS LINK: ACTIVE
                </div>
            </div>

            <div className="flex-1 flex gap-6 p-6 overflow-hidden">
                {/* Control Panel */}
                <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Search size={16} className="text-blue-600" /> Step 1: Target Identification
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                <select
                                    value={selectedDevice}
                                    onChange={e => setSelectedDevice(e.target.value)}
                                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 outline-none text-sm font-bold text-slate-700 appearance-none shadow-inner"
                                >
                                    <option value="">Select Target Vehicle / Device</option>
                                    {fleet.map(v => <option key={v.id} value={v.id}>{v.name} ({v.id})</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Terminal size={16} className="text-blue-600" /> Step 2: Command Selection
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {commands.map(cmd => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => handleCommandSelect(cmd.id)}
                                        className={`flex flex-col p-5 rounded-3xl border-2 transition-all text-left ${commandType === cmd.id
                                            ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-50'
                                            : 'border-slate-100 hover:border-slate-200 bg-white'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-2xl bg-white mb-3 shadow-sm border border-slate-100 flex items-center justify-center ${cmd.color}`}>
                                            <cmd.icon size={20} />
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm mb-1">{cmd.label}</div>
                                        <div className="text-[10px] text-slate-500 font-medium leading-relaxed">{cmd.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {commandType === 'engine_stop' && (
                            <div className="space-y-4 p-6 bg-rose-50/50 rounded-3xl border border-rose-100 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-rose-700 uppercase tracking-widest">Security Confirmation</h4>
                                        <p className="text-[10px] text-rose-600 font-medium">To stop the engine, please enter the code shown below.</p>
                                    </div>
                                    <div className="px-4 py-2 bg-rose-600 text-white font-mono text-xl font-black rounded-xl tracking-[0.2em] shadow-lg shadow-rose-200">
                                        {securityCode}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={userCodeInput}
                                        onChange={e => setUserCodeInput(e.target.value)}
                                        placeholder="Type 4-digit code here"
                                        className="w-full px-6 py-4 rounded-2xl border-2 border-rose-100 focus:border-rose-500 outline-none text-center text-lg font-black tracking-[0.5em] text-rose-900 bg-white shadow-inner"
                                    />
                                    {userCodeInput.length === 4 && userCodeInput === securityCode && (
                                        <div className="absolute right-4 top-4 text-emerald-500">
                                            <CheckCircle2 size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-4">
                            <button
                                onClick={handleSend}
                                disabled={!selectedDevice || sending || (commandType === 'engine_stop' && userCodeInput !== securityCode)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(37,99,235,0.2)] transition-all flex justify-center items-center gap-3"
                            >
                                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                {sending ? 'Sending Command...' : 'Dispatch Command'}
                            </button>
                        </div>

                        {status && (
                            <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                <CheckCircle2 size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">{status.message}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="w-96 bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <History size={16} className="text-slate-400" /> Command Log
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {commandHistory.map(log => (
                            <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{log.device}</div>
                                    <div className="text-sm font-bold text-slate-700">{log.command}</div>
                                    <div className="text-[9px] font-medium text-slate-400 mt-1">{log.time}</div>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-[9px] font-black tracking-widest ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                    {log.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
