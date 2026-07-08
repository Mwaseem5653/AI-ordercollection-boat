'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import QRModal from '../../components/QRModal';
import DeleteModal from '../../components/DeleteModal';

// ── Types ──────────────────────────────────────────────────
interface OrderItem {
  Date: string;
  'Group Name': string;
  'Customer Name': string;
  'Phone Number': string;
  'Trading Name': string;
  'Product Name': string;
  'Product Size': string;
  'Quantity (Pcs)': number;
  Unit: string;
  NTF: 'YES' | 'NO';
}

interface Stats {
  total: number;
  orders: number;
  pending: number;
  ignored: number;
}

export default function Dashboard() {
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState('loading');
  const [backendStatus, setBackendStatus] = useState('disconnected');
  const [stats, setStats] = useState<Stats>({ total: 0, orders: 0, pending: 0, ignored: 0 });
  const [orders, setOrders] = useState<OrderItem[]>([]);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'manual'>('all');
  
  // Modals state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const API_BASE =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001';

  const fetchData = useCallback(async () => {
    try {
      const qrRes = await fetch(`${API_BASE}/api/qr`, { cache: 'no-store' });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQr(qrData.qr || '');
        setStatus(qrData.status);
        setBackendStatus('connected');
        
        const [statsRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats`, { cache: 'no-store' }),
          fetch(`${API_BASE}/api/orders`, { cache: 'no-store' }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (ordersRes.ok) setOrders(await ordersRes.json());
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle QR modal auto-open when qr_ready
  useEffect(() => {
    if (status === 'qr_ready' && qr) {
      setIsQrOpen(true);
    }
  }, [status, qr]);

  const handleClearConfirm = async () => {
    await fetch(`${API_BASE}/api/orders/clear`, { method: 'POST' });
    setOrders([]);
    setStats({ total: 0, orders: 0, pending: 0, ignored: 0 });
  };

  // Filter & Search Logic
  const filteredOrders = orders.filter(item => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = 
      item['Customer Name']?.toLowerCase().includes(term) ||
      item['Product Name']?.toLowerCase().includes(term) ||
      item['Phone Number']?.toLowerCase().includes(term) ||
      item['Trading Name']?.toLowerCase().includes(term) ||
      item['Group Name']?.toLowerCase().includes(term);
      
    if (filterType === 'verified') {
      return matchesSearch && item.NTF !== 'YES';
    }
    if (filterType === 'manual') {
      return matchesSearch && item.NTF === 'YES';
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-screen bg-[#090D1A] text-slate-100 font-sans overflow-hidden antialiased selection:bg-blue-500/20">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="h-16 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-slate-800/60 flex items-center justify-between px-6 shrink-0 z-20 shadow-lg shadow-black/10">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all">
              PB
            </div>
            <span className="text-sm font-black tracking-wider text-slate-100 uppercase group-hover:text-blue-400 transition-colors">
              PAINT BRIDGE AI
            </span>
          </Link>
          <div className="h-4 w-px bg-slate-800 hidden md:block" />
          <nav className="hidden md:flex items-center gap-6">
            <button className="text-blue-400 text-[10px] font-black uppercase tracking-widest border-b-2 border-blue-500 py-5 mt-0.5">
              Live Monitor
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 bg-slate-900/60 border border-slate-800/80 rounded-full shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                backendStatus === 'disconnected' ? 'bg-red-400' : status === 'qr_ready' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                backendStatus === 'disconnected' ? 'bg-red-500' : status === 'qr_ready' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              {backendStatus === 'disconnected' ? 'Offline' : status === 'qr_ready' ? 'Awaiting Scan' : 'Connected'}
            </span>
          </div>

          {/* Quick QR Trigger (Visible when QR is loaded) */}
          {qr && (
            <button 
              onClick={() => setIsQrOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-[10px] font-black uppercase tracking-wider rounded-full transition-all cursor-pointer shadow-md"
            >
              Show QR
            </button>
          )}

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {backendStatus === 'disconnected' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090D1A]/50">
            <div className="relative mb-6">
              <div className="w-12 h-12 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-500">AI</div>
            </div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic animate-pulse">
              Awaiting System Startup...
            </p>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0 bg-[#0B0F19]/40 border-b border-slate-900">
              <StatCard label="Total Inbound Messages" value={stats.total} color="blue" icon="💬" gradient="from-blue-500/10 to-indigo-500/5 border-blue-500/20" />
              <StatCard label="Verified Orders Saved" value={stats.orders} color="emerald" icon="✅" gradient="from-emerald-500/10 to-teal-500/5 border-emerald-500/20" />
              <StatCard label="Active Chat Threads" value={stats.pending} color="amber" icon="⚡" gradient="from-amber-500/10 to-orange-500/5 border-amber-500/20" />
              <StatCard label="General Chats Filtered" value={stats.ignored} color="slate" icon="🛡️" gradient="from-slate-500/10 to-zinc-500/5 border-slate-500/20" />
            </div>

            {/* Dynamic Controls Bar */}
            <div className="px-6 py-4 shrink-0 bg-[#090D1A] flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-900/60">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 height-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    type="text"
                    placeholder="Search by customer, brand, trading..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/60 hover:bg-slate-950/80 focus:bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 transition-all font-medium"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-slate-950/60 p-1 border border-slate-850 rounded-xl w-full sm:w-auto">
                  <button 
                    onClick={() => setFilterType('all')}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filterType === 'all' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterType('verified')}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filterType === 'verified' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/10 shadow-md' : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Verified
                  </button>
                  <button 
                    onClick={() => setFilterType('manual')}
                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filterType === 'manual' ? 'bg-amber-600/15 text-amber-400 border border-amber-500/10 shadow-md' : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Action Needed
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                <button 
                  onClick={() => setIsDeleteOpen(true)} 
                  className="h-9 px-4 border border-slate-800/80 hover:border-red-500/30 bg-slate-950/40 hover:bg-red-500/5 text-slate-400 hover:text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Wipe Ledger
                </button>
                
                <a 
                  href={`${API_BASE}/api/download`} 
                  className="h-9 px-5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:scale-102 hover:shadow-lg hover:shadow-blue-500/10 flex items-center gap-2.5 shadow-md shadow-black/10 cursor-pointer"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Generate Excel Report
                </a>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 p-6 overflow-hidden bg-[#090D1A]">
              <div className="bg-slate-900/30 border border-slate-900 rounded-[24px] shadow-2xl h-full flex flex-col overflow-hidden backdrop-blur-md">
                
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="text-[9px] font-black text-slate-500 uppercase tracking-wider bg-[#0B0F19]/60 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 border-b border-slate-900">Timestamp</th>
                        <th className="px-4 py-4 border-b border-slate-900">Source Group</th>
                        <th className="px-4 py-4 border-b border-slate-900">Customer</th>
                        <th className="px-4 py-4 border-b border-slate-900">Phone</th>
                        <th className="px-4 py-4 border-b border-slate-900">Trading Entity</th>
                        <th className="px-4 py-4 border-b border-slate-900">Product Details</th>
                        <th className="px-4 py-4 border-b border-slate-900 text-center">Qty</th>
                        <th className="px-4 py-4 border-b border-slate-900 text-center">Unit</th>
                        <th className="px-6 py-4 border-b border-slate-900 text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/40">
                      {filteredOrders.slice().reverse().map((item: OrderItem, i: number) => (
                        <tr 
                          key={i} 
                          className={`group transition-all hover:bg-slate-800/20 ${
                            item.NTF === 'YES' ? 'bg-amber-500/2 border-l-2 border-amber-500/60' : ''
                          }`}
                        >
                          <td className="px-6 py-4.5 text-[10px] font-medium text-slate-450 tabular-nums whitespace-nowrap">
                            {item.Date}
                          </td>
                          <td className="px-4 py-4.5 font-bold text-slate-350 text-[11px] uppercase truncate max-w-[140px]">
                            {item['Group Name']}
                          </td>
                          <td className="px-4 py-4.5 font-black text-slate-200 uppercase text-[11px] truncate max-w-[140px]">
                            {item['Customer Name']}
                          </td>
                          <td className="px-4 py-4.5 text-[10px] font-bold text-slate-450 tabular-nums">
                            {item['Phone Number']}
                          </td>
                          <td className="px-4 py-4.5 font-extrabold text-blue-400 text-[11px] uppercase tracking-wide">
                            {item['Trading Name'] || '—'}
                          </td>
                          <td className="px-4 py-4.5 max-w-[280px]">
                            <div className="font-extrabold text-slate-100 text-[11px] uppercase leading-tight group-hover:text-blue-350 transition-colors">
                              {item['Product Name']}
                            </div>
                            {item['Product Size'] && (
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                {item['Product Size']}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4.5 text-center font-black text-blue-400 text-xs">
                            {item['Quantity (Pcs)']}
                          </td>
                          <td className="px-4 py-4.5 text-center text-[10px] font-bold text-slate-400 uppercase">
                            {item.Unit || '—'}
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            {item.NTF === 'YES' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[9px] font-black uppercase border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.05)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Manual Action
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[9px] font-black uppercase border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.05)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Verified
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                      <svg className="w-12 h-12 text-slate-700 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <div className="font-black uppercase tracking-[0.25em] text-[10px] text-slate-600">No Transaction Records</div>
                      {searchQuery && (
                        <p className="text-[10px] text-slate-600 mt-1">Try resetting your filters or search keywords</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* QR Link Modal */}
      <QRModal qr={qr} onClose={() => setIsQrOpen(false)} />

      {/* Wipe Confirmation Modal */}
      <DeleteModal 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        onConfirm={handleClearConfirm} 
      />
    </div>
  );
}

// ── StatCard Component ──────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'amber' | 'slate';
  icon: string;
  gradient: string;
}

function StatCard({ label, value, icon, gradient }: StatCardProps) {
  return (
    <div className={`relative p-5 bg-gradient-to-br ${gradient} border rounded-2xl overflow-hidden shadow-lg transition-all hover:-translate-y-0.5 duration-300 group`}>
      <div className="absolute right-4 bottom-2 text-4xl opacity-10 group-hover:scale-110 transition-transform select-none">{icon}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-black tabular-nums tracking-tighter text-slate-100 flex items-baseline gap-2">
        {value}
        <span className="text-[9px] font-bold text-slate-500 tracking-normal uppercase">items</span>
      </div>
    </div>
  );
}