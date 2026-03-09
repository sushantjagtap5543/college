import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Map as MapIcon,
    FileText,
    Settings,
    Bell,
    UserCircle,
    LogOut,
    Shield,
    KeyRound,
    X,
    CheckCircle2,
    AlertTriangle,
    Menu,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : `${window.location.protocol}//${window.location.hostname}`;

const SIDEBAR_ITEMS = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/live', icon: MapIcon, label: 'Live Tracking' },
    { path: '/reports', icon: FileText, label: 'Reports' },
];

const BOTTOM_ITEMS = [
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children, user, onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [showPassModal, setShowPassModal] = useState(false);
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPass !== confirmPass) {
            setError('New passwords do not match.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, currentPassword: currentPass, newPassword: newPass })
            });
            const data = await res.json();
            if (data.status === 'SUCCESS') {
                setSuccess(true);
                setTimeout(() => {
                    setShowPassModal(false);
                    setSuccess(false);
                    setCurrentPass('');
                    setNewPass('');
                    setConfirmPass('');
                }, 2000);
            } else {
                setError(data.message || 'Failed to update password.');
            }
        } catch (err) {
            setError('System error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f3f4f6] overflow-hidden text-slate-800 font-sans selection:bg-blue-500 selection:text-white">
            {/* Sidebar Navigation - GeoSurePath Classic Navy */}
            <aside className="w-[80px] bg-[#1a233a] h-full flex flex-col items-center py-6 z-[100] shadow-xl border-r border-[#2a344a] relative shrink-0">
                {/* Logo */}
                <div
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-8 cursor-pointer shadow-lg border border-white/10 overflow-hidden hover:scale-105 transition-transform"
                    onClick={() => navigate('/')}
                    title="GeoSurePath Dashboard"
                >
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-10 h-10 object-contain"
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <span className="font-bold text-[#1a233a] text-[8px] text-center leading-tight hidden items-center justify-center">GEO<br />SURE</span>
                </div>

                <div className="w-8 border-b border-[#2a344a] mb-6" />

                {/* Primary Nav */}
                <nav className="flex flex-col gap-6 w-full items-center p-4">
                    {SIDEBAR_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path || (item.path === '/' && (location.pathname === '/client' || location.pathname === '/admin'));
                        return (
                            <Link
                                key={item.label}
                                to={item.path === '/' ? (user?.role === 'ADMIN' ? '/admin' : '/client') : item.path}
                                className={`flex flex-col items-center justify-center transition-all group w-14 h-14 rounded-2xl relative ${isActive ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-400 hover:text-white hover:bg-[#202b45]'}`}
                                title={item.label}
                            >
                                {isActive && (
                                    <div className="absolute -left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-md" />
                                )}
                                <item.icon className="w-6 h-6 z-10" strokeWidth={isActive ? 2.5 : 1.5} />
                                <span className={`text-[10px] font-bold mt-1 z-10 truncate w-full text-center ${isActive ? 'text-white' : 'text-slate-500'}`}>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="flex flex-col gap-6 w-full items-center mt-auto pb-6">
                    {BOTTOM_ITEMS.map((item) => (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex flex-col items-center justify-center transition-all group w-14 p-2 rounded-xl ${location.pathname === item.path ? 'bg-[#2a344a] text-white' : 'text-slate-400 hover:text-white hover:bg-[#202b45]'}`}
                            title={item.label}
                        >
                            <item.icon className="w-5 h-5 mb-1" strokeWidth={1.5} />
                            <span className="text-[10px] font-black text-center opacity-40 group-hover:opacity-100 uppercase tracking-tighter">{item.label}</span>
                        </Link>
                    ))}
                    <div className="w-8 border-b border-[#2a344a] my-2" />

                    <button onClick={onLogout} title="Log Out" className="flex flex-col items-center justify-center text-slate-400 hover:text-red-400 w-14 p-3 rounded-xl hover:bg-[#202b45] transition-all">
                        <LogOut className="w-8 h-8" strokeWidth={1.5} />
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f3f4f6]">
                {/* GeoSurePath Classic Header */}
                <header className="h-16 bg-[#1a233a] text-white flex items-center justify-between px-6 z-[90] shrink-0 shadow-lg border-b border-white/5">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                            <img src="/logo.png" alt="GeoSurePath" className="w-10 h-10 rounded-xl shadow-[0_0_16px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                            <div className="hidden bg-[#10b981] p-1.5 rounded-lg items-center justify-center">
                                <MapIcon className="text-black" size={16} />
                            </div>
                            <span className="font-black text-xl tracking-tighter uppercase italic">GEOSURE<span className="text-[#10b981]">PATH</span></span>
                        </div>

                        <div className="h-8 w-px bg-white/10 hidden md:block" />

                        <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 hidden md:block">
                            {location.pathname === '/' || location.pathname === '/client' || location.pathname === '/admin' ? 'Dashboard' :
                                location.pathname.startsWith('/live') ? 'Live Tracking' :
                                    location.pathname.startsWith('/reports') ? 'Reports' :
                                        location.pathname.startsWith('/alerts') ? 'Alerts' :
                                            location.pathname.startsWith('/settings') ? 'Settings' :
                                                'Live Flux'}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {user?.role === 'CLIENT' && user?.subscription_end_date && (
                            <div className="flex items-center bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold font-mono tracking-widest border border-white/20">
                                {(() => {
                                    const diffDays = Math.ceil((new Date(user.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24));
                                    if (diffDays <= 7) {
                                        return <span className="text-rose-300 flex items-center gap-2"><AlertTriangle size={14} /> {diffDays} DAYS LEFT (RENEW SOON)</span>;
                                    }
                                    return <span className="text-emerald-300">Expires: {diffDays} Days</span>;
                                })()}
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="opacity-80">Welcome,</span>
                            <span>{user?.name || 'User'}</span>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-2">{user?.role || 'CLIENT'}</span>
                        </div>
                    </div>
                </header>

                {/* Page Content Container */}
                <main className="flex-1 overflow-hidden relative z-10 custom-scrollbar">
                    {children}
                </main>

                {/* Password Change Modal - Classic Theme */}
                <AnimatePresence>
                    {showPassModal && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <KeyRound className="text-blue-500" size={20} /> Update Password
                                    </h3>
                                    <button onClick={() => setShowPassModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleUpdatePassword} className="p-6 space-y-5">
                                    {error && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
                                            <AlertTriangle size={16} /> {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-600 text-sm flex items-center gap-2">
                                            <CheckCircle2 size={16} /> Password updated successfully!
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Current Password</label>
                                            <input
                                                type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required
                                                className="w-full px-4 py-2.5 rounded border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">New Password</label>
                                            <input
                                                type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required
                                                className="w-full px-4 py-2.5 rounded border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Confirm New Password</label>
                                            <input
                                                type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required
                                                className="w-full px-4 py-2.5 rounded border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassModal(false)}
                                            className="px-5 py-2.5 rounded font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit" disabled={loading || success}
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm disabled:opacity-50 transition-colors"
                                        >
                                            {loading ? 'Saving...' : 'Update Password'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
