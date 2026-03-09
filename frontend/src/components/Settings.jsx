import React, { useState } from 'react';
import {
    User, Bell, Shield, Smartphone, Globe, Moon, Sun,
    Save, Key, Mail, Lock, CheckCircle2, AlertTriangle,
    Eye, EyeOff
} from 'lucide-react';

const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'audit', label: 'Audit Logs', icon: Globe },
];

export default function Settings({ user, theme, setTheme }) {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

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

                        {activeTab === 'appearance' && (
                            <section className="space-y-6">
                                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm"><Sun size={20} /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Appearance & Interface</h4>
                                        <p className="text-slate-500 text-xs">Customize the visual experience of your dashboard.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${theme === 'light' ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-amber-500 shadow-inner"><Sun size={24} /></div>
                                        <span className="font-black text-xs uppercase tracking-widest text-slate-700">Light Mode</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${theme === 'dark' ? 'border-blue-600 bg-slate-800 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-blue-400 shadow-inner"><Moon size={24} /></div>
                                        <span className={`font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>Dark Mode</span>
                                    </button>
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
