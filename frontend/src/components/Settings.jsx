import React, { useState } from 'react';
import {
    User, Bell, Shield, Smartphone, Globe, Moon, Sun,
    Save, Key, Mail, Lock, CheckCircle2, AlertTriangle,
    Eye, EyeOff, Truck, Box, Volume2, Play
} from 'lucide-react';
import {
    VEHICLE_ICON_OPTIONS,
    PIN_COLOR_OPTIONS,
    getVehicleIconPref,
    setVehicleIconPref,
    getVehicleColorPref,
    setVehicleColorPref
} from '../utils/statusIcons';
import {
    TONES,
    getSavedToneId,
    setSavedToneId,
    previewTone
} from '../utils/notificationTones';

const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'assets', label: 'My Vehicles', icon: Truck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'audit', label: 'Audit Logs', icon: Globe },
];

export default function Settings({ user, fleet = [], theme, setTheme }) {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    // Notification tone state
    const [selectedToneId, setSelectedToneId] = useState(() => getSavedToneId());

    // Form states
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8080'
        : `${window.location.protocol}//${window.location.hostname}`;

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (activeTab === 'profile') {
                const req = await fetch(`${API_BASE}/api/update-profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, name, email })
                });
                const res = await req.json();
                if (res.status === 'SUCCESS') {
                    // Update local storage so it persists right away
                    localStorage.setItem('geosurepath_user', JSON.stringify(res.user));
                    setSuccess(true);
                    setTimeout(() => { setSuccess(false); window.location.reload(); }, 1500);
                } else {
                    setError(res.message);
                }
            } else if (activeTab === 'security') {
                if (!currentPass || !newPass || newPass !== confirmPass) {
                    setError('Passwords do not match or fields are empty.');
                    setLoading(false);
                    return;
                }
                const req = await fetch(`${API_BASE}/api/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, currentPassword: currentPass, newPassword: newPass })
                });
                const res = await req.json();
                if (res.status === 'SUCCESS') {
                    setSuccess(true);
                    setCurrentPass('');
                    setNewPass('');
                    setConfirmPass('');
                    setTimeout(() => setSuccess(false), 3000);
                } else {
                    setError(res.message);
                }
            } else {
                // Settings saved for appearance (handled by setTheme immediately)
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err) {
            setError('System error. Failed to save.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
            <div className="bg-white border-b border-slate-200 p-6 shrink-0">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">System Settings</h1>
                <p className="text-slate-500 text-sm font-medium">Manage your personal preferences and platform configuration.</p>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-slate-200 p-4 space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setError(null); setSuccess(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-blue-50 text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-8">
                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 flex gap-3 items-center rounded-xl border border-rose-200 text-sm font-bold">
                                <AlertTriangle size={18} /> {error}
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <section className="space-y-6">
                                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User size={40} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{user?.name || 'User Profile'}</h3>
                                        <p className="text-slate-500 text-sm">{user?.email}</p>
                                        <button className="mt-2 text-blue-600 font-bold text-xs uppercase tracking-widest hover:text-blue-700">Change Photo</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800" />
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'notifications' && (
                            <section className="space-y-6">
                                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm"><Bell size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Notification Tones</h4>
                                        <p className="text-slate-500 text-xs">Choose the alert tone for GPS events. Serious alerts ring twice, normal alerts ring once.</p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 font-medium">
                                    🔔 <strong>Serious alerts</strong> (Overspeed, SOS, Tamper, Power Cut, Fuel Theft, Towing) → tone plays <strong>2×</strong> + red blink.<br />
                                    🔔 <strong>Normal alerts</strong> (Ignition ON/OFF, Geofence, Idle, GPS Lost) → tone plays <strong>1×</strong>.
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {TONES.map(tone => (
                                        <div
                                            key={tone.id}
                                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedToneId === tone.id
                                                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                    : 'border-slate-100 bg-white hover:border-slate-300'
                                                }`}
                                            onClick={() => setSelectedToneId(tone.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${selectedToneId === tone.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>{tone.id}</div>
                                                <span className="font-bold text-slate-700 text-sm">{tone.label}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); previewTone(tone.id); }}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-500 hover:text-white text-slate-500 transition-all"
                                                title="Preview"
                                            >
                                                <Play size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={() => { setSavedToneId(selectedToneId); previewTone(selectedToneId); setSuccess(true); setTimeout(() => setSuccess(false), 2000); }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                                    >
                                        <Volume2 size={16} /> Save Tone Preference
                                    </button>
                                </div>
                            </section>
                        )}

                        {activeTab === 'security' && (
                            <section className="space-y-6">
                                <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm"><Shield size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Security & Access</h4>
                                        <p className="text-slate-500 text-xs">Update your credentials and manage account security.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                                        <div className="relative">
                                            <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800" />
                                            <Lock size={16} className="absolute right-4 top-3.5 text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Minimum 8 chars" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                                            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat password" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm font-bold text-slate-800" />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'audit' && (
                            <section className="space-y-6">
                                <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl text-slate-600 shadow-sm"><Globe size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Activity & Audit Logs</h4>
                                        <p className="text-slate-500 text-xs">Monitor recent actions and security events on your account.</p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-6 py-4">Action</th>
                                                <th className="px-6 py-4">Source IP</th>
                                                <th className="px-6 py-4 text-right">Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {[
                                                { action: 'Login Success', ip: '192.168.1.45', time: '10 mins ago' },
                                                { action: 'Password Changed', ip: '3.108.114.12', time: '2 days ago' },
                                                { action: 'New Device Registered', ip: '192.168.1.45', time: '1 week ago' },
                                            ].map((log, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-700">{log.action}</td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{log.ip}</td>
                                                    <td className="px-6 py-4 text-right text-slate-400 text-xs font-medium">{log.time}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {activeTab === 'assets' && (
                            <section className="space-y-6">
                                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm"><Truck size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Vehicle Customization</h4>
                                        <p className="text-slate-500 text-xs">Personalize how your assets appear on the live map.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {fleet.map(v => (
                                        <div key={v.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-slate-50 border border-slate-100">
                                                        {VEHICLE_ICON_OPTIONS.find(opt => opt.id === getVehicleIconPref(v.id))?.emoji || '🚗'}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-bold text-slate-800 text-sm">{v.name}</h5>
                                                        <p className="text-[10px] font-mono text-slate-400">{v.id}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Icon Type</label>
                                                    <div className="grid grid-cols-6 gap-1">
                                                        {VEHICLE_ICON_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => {
                                                                    setVehicleIconPref(v.id, opt.id);
                                                                    setSuccess(true);
                                                                    setTimeout(() => setSuccess(false), 2000);
                                                                }}
                                                                className={`p-1.5 rounded-lg border transition-all hover:bg-slate-50 ${getVehicleIconPref(v.id) === opt.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100'}`}
                                                                title={opt.label}
                                                            >
                                                                <span className="text-lg">{opt.emoji}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pin Color</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {PIN_COLOR_OPTIONS.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setVehicleColorPref(v.id, c.id);
                                                                    setSuccess(true);
                                                                    setTimeout(() => setSuccess(false), 2000);
                                                                }}
                                                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${getVehicleColorPref(v.id) === c.id ? 'border-slate-800 ring-2 ring-slate-200' : 'border-white shadow-sm'}`}
                                                                style={{ backgroundColor: c.id }}
                                                                title={c.label}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {fleet.length === 0 && (
                                        <div className="p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                            <Box className="mx-auto text-slate-300 mb-4" size={48} />
                                            <h3 className="text-slate-500 font-bold">No assets found in your fleet</h3>
                                            <p className="text-slate-400 text-xs">Assets will appear here once they are registered to your account.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                            {success ? (
                                <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                    <CheckCircle2 size={18} /> Settings saved successfully!
                                </div>
                            ) : <div></div>}
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                            >
                                <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
