import React, { useState } from 'react';
import { Wrench, Clock, AlertTriangle, CheckCircle2, Plus, Trash2, Calendar as CalendarIcon, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Maintenance({ fleet = [] }) {
    const [tasks, setTasks] = useState([
        { id: 1, vehicle: fleet[0]?.name || 'Truck Alpha', type: 'Oil Change', lastKm: 45000, nextKm: 50000, status: 'upcoming', priority: 'medium' },
        { id: 2, vehicle: fleet[1]?.name || 'Van Beta', type: 'Tire Rotation', lastKm: 28000, nextKm: 33000, status: 'overdue', priority: 'high' }
    ]);

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ vehicle: '', type: '', nextKm: '', priority: 'medium' });

    const handleAdd = (e) => {
        e.preventDefault();
        setTasks([...tasks, { ...form, id: Date.now(), status: 'upcoming', lastKm: 0 }]);
        setShowAdd(false);
    };

    return (
        <div className="h-full overflow-y-auto p-8 bg-slate-50 dark:bg-[#0f172a] font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-4">
                        <Wrench className="text-emerald-500" size={32} /> Maintenance Logs
                    </h1>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Preventative Asset Health Management</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="bg-slate-900 dark:bg-emerald-500 text-white dark:text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:-translate-y-1 transition-all">
                    <Plus size={18} /> Schedule Service
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <AnimatePresence>
                        {showAdd && (
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl">
                                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Target Asset</label>
                                        <select required value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border-none outline-none font-bold">
                                            <option value="">Choose Vehicle...</option>
                                            {fleet.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Service Directive</label>
                                        <input required placeholder="e.g. Engine Overhaul" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border-none outline-none font-bold" />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Next Threshold (KM)</label>
                                        <input required type="number" value={form.nextKm} onChange={e => setForm({ ...form, nextKm: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border-none outline-none font-bold" />
                                    </div>
                                    <div className="flex gap-4 items-end">
                                        <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest">Schedule</button>
                                        <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-black">Cancel</button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset / Task</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Threshold</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Index</th>
                                    <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {tasks.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-8 py-8">
                                            <div className="text-sm font-black text-slate-900 dark:text-white uppercase italic">{t.vehicle}</div>
                                            <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{t.type}</div>
                                        </td>
                                        <td className="px-8 py-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="w-full bg-blue-500" style={{ height: '70%' }} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-slate-900 dark:text-white">{t.nextKm.toLocaleString()} KM</div>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Target</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8">
                                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${t.status === 'overdue' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                                }`}>
                                                {t.status === 'overdue' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-8 text-right">
                                            <button className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-20 bg-emerald-500/10 blur-[80px] rounded-full group-hover:bg-emerald-500/20 transition-all" />
                        <h3 className="text-xl font-black italic tracking-tighter mb-6 relative z-10">Asset Lifespan Index</h3>
                        <div className="space-y-6 relative z-10">
                            {[
                                { label: 'Fleet Compliance', v: '94%', c: 'emerald' },
                                { label: 'Overdue Services', v: '02', c: 'rose' },
                                { label: 'Active Alerts', v: '05', c: 'amber' }
                            ].map((s, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{s.label}</span>
                                    <span className={`text-xl font-black ${s.c === 'emerald' ? 'text-emerald-400' : s.c === 'rose' ? 'text-rose-400' : 'text-amber-400'}`}>{s.v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-10 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Recent Activity</h4>
                        <div className="space-y-8">
                            {[
                                { t: 'Oil Change', v: 'Truck 04', d: '2 days ago', i: <CheckCircle2 className="text-emerald-500" /> },
                                { t: 'Brake Check', v: 'Van 12', d: '1 week ago', i: <CheckCircle2 className="text-emerald-500" /> },
                                { t: 'Inspection', v: 'Asset 09', d: 'Mar 12, 2024', i: <CalendarIcon className="text-blue-500" /> }
                            ].map((a, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        {a.i}
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-900 dark:text-white uppercase">{a.t}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{a.v} • {a.d}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
