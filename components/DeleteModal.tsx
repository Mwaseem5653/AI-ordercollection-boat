'use client';

import { useState } from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteModal({ isOpen, onClose, onConfirm }: DeleteModalProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (inputValue === 'DELETE') {
      onConfirm();
      setInputValue('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-[#0F172A] border border-red-500/20 rounded-[32px] p-8 w-full max-w-[400px] shadow-[0_0_50px_rgba(239,68,68,0.1)] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-300 mx-auto">
        
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Danger Header Icon */}
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.05)] border border-red-500/20">
          <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        <h3 className="text-2xl font-black text-slate-100 tracking-tight mb-2 uppercase italic">Wipe Database?</h3>
        <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
          This will permanently delete all order history from the Excel file and reset stats. This action <span className="text-red-400 font-bold uppercase underline decoration-red-500/50">cannot be undone</span>.
        </p>

        <div className="mb-6">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2.5 italic">
            Type <span className="text-red-400 font-bold">DELETE</span> to confirm
          </label>
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Type here..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-4 text-sm font-black tracking-widest focus:outline-none focus:border-red-500/50 focus:ring-4 focus:ring-red-500/10 text-slate-200 transition-all uppercase"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => { onClose(); setInputValue(''); }}
            className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-widest rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={inputValue !== 'DELETE'}
            className="py-3.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-20 disabled:pointer-events-none"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
