'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#090D1A] text-slate-100 font-sans selection:bg-blue-500/20 relative overflow-hidden flex flex-col justify-between">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[300px] bg-emerald-600/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Navigation */}
      <nav className="h-20 flex items-center justify-between px-8 md:px-20 border-b border-slate-900/60 bg-[#0B0F19]/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20">
            PB
          </div>
          <span className="text-sm font-black tracking-widest text-slate-100 uppercase">
            PAINT BRIDGE AI
          </span>
        </div>
        <Link 
          href="/dashboard" 
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-550 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="px-8 md:px-20 pt-16 pb-24 max-w-7xl mx-auto flex-1 flex flex-col justify-center">
        <div className="grid md:grid-cols-12 gap-16 items-center">
          
          {/* Left Text Column */}
          <div className="space-y-8 md:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              Next-Gen Order Processing
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] text-slate-100">
              The AI Bridge for <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
                Paint Stores.
              </span>
            </h2>
            
            <p className="text-base text-slate-400 max-w-lg leading-relaxed font-medium">
              Automatically extract paint orders from WhatsApp messages, images, and voice notes using advanced Google Gemini AI & Pinecone search. Save directly to Excel logs.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link 
                href="/dashboard" 
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-550 hover:to-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl text-center transition-all shadow-xl shadow-blue-550/10 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Go to Dashboard
              </Link>
              
              <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-slate-400 shadow-lg shadow-black/10 backdrop-blur-sm">
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 overflow-hidden">
                       <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+10}`} alt="avatar" />
                     </div>
                   ))}
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest leading-tight italic">
                  Trusted by<br/>Hardware Owners
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Column */}
          <div className="relative hidden lg:block md:col-span-5">
            {/* Visual Element: Modern Data Card */}
            <div className="relative z-10 bg-slate-900/35 border border-white/5 p-10 rounded-[48px] shadow-2xl shadow-black/30 backdrop-blur-xl rotate-3 hover:rotate-0 transition-all duration-700">
               <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                     <div className="h-2 w-24 bg-slate-800 rounded-full" />
                     <div className="h-6 w-12 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center text-[9px] font-black text-blue-400">ACTIVE</div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-14 w-full bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between px-5">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center text-xs">💬</div>
                          <div className="h-2 w-32 bg-slate-700 rounded-full" />
                        </div>
                        <div className="h-2 w-8 bg-slate-800 rounded-full" />
                    </div>
                    <div className="h-14 w-[90%] bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between px-5 ml-auto">
                        <div className="h-2 w-16 bg-slate-800 rounded-full" />
                        <div className="flex items-center gap-4">
                          <div className="h-2 w-20 bg-slate-700 rounded-full" />
                          <div className="w-8 h-8 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center text-xs">✅</div>
                        </div>
                    </div>
                  </div>
               </div>
               
               {/* Floating Badge */}
               <div className="absolute -top-8 -right-8 w-28 h-28 bg-gradient-to-tr from-blue-600 to-indigo-650 rounded-full flex items-center justify-center text-white text-[10px] font-black uppercase text-center p-4 shadow-2xl shadow-blue-500/20 -rotate-12 animate-bounce duration-[3000ms] border border-blue-400/20">
                  GEN AI POWERED
               </div>
            </div>
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-550/10 opacity-60 blur-[100px] -z-10" />
          </div>
        </div>
      </main>

      {/* Feature Grid */}
      <section className="bg-[#0B0F19]/40 py-24 px-8 md:px-20 border-t border-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto">
           <div className="text-center mb-16">
              <h3 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Seamless Automation</h3>
              <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em]">Optimizing your daily orders</p>
           </div>
           <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                title="WhatsApp Sync" 
                desc="Real-time monitoring of group messages. Automatically parses orders directly from chats." 
                icon="💬"
              />
              <FeatureCard 
                title="Gemini 2.5 AI" 
                desc="Smart extraction from order scripts, voice notes, and billing screenshots." 
                icon="🧠"
              />
              <FeatureCard 
                title="Spreadsheet Logs" 
                desc="Export validated paint orders directly to Excel spreadsheets for easy accounting." 
                icon="📊"
              />
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 text-center border-t border-slate-900/60 bg-[#090D1A]">
        <p className="text-[9px] font-black text-slate-650 uppercase tracking-[0.5em] italic">
          © 2026 PAINT BRIDGE AI &bull; INTELLIGENT SOURCING
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string, desc: string, icon: string }) {
  return (
    <div className="p-8 bg-slate-900/25 hover:bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 group">
      <div className="text-4xl mb-6 group-hover:scale-105 transition-transform inline-block">{icon}</div>
      <h3 className="text-lg font-black mb-3 tracking-tight uppercase italic text-slate-100">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
  );
}
