'use client';

interface QRModalProps {
  qr: string;
  onClose: () => void;
}

export default function QRModal({ qr, onClose }: QRModalProps) {
  if (!qr) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      {/* Modal Container */}
      <div className="bg-[#0F172A] border border-blue-500/20 rounded-[32px] p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)] w-full max-w-[380px] flex flex-col items-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer font-bold"
        >
          &times;
        </button>

        {/* Icon Header */}
        <div className="w-14 h-14 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/5">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 17h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-black text-slate-100 tracking-tight text-center mb-1 uppercase italic">Link WhatsApp</h3>
        <p className="text-xs text-slate-400 font-bold text-center leading-relaxed mb-6">
          Scan this QR code with your WhatsApp Link Device option to start AI monitoring.
        </p>
        
        {/* QR Code Container with forced size */}
        <div className="bg-white p-4 rounded-3xl shadow-[0_0_20px_rgba(255,255,255,0.05)] mb-6 w-52 h-52 flex items-center justify-center shrink-0 border border-slate-200">
           <img 
             src={qr} 
             alt="WhatsApp QR Code" 
             className="max-w-full max-h-full object-contain"
           />
        </div>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-900 border border-slate-800 px-5 py-3 rounded-full">
          <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          Awaiting Connection
        </div>
      </div>
    </div>
  );
}
