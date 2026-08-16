"use client";

type Props = {
  tab: string;
  setTab: (tab: string) => void;
};

export default function NavbarTabs({ tab, setTab }: Props) {
  const tabs = [
    { id: "home", label: "3D Digital Twin", badge: "3D" },
    { id: "curve", label: "Live Load Curve", badge: "RAW" },
    { id: "ai", label: "AI Energy Intelligence", badge: "AI" },
  ];

  return (
    <header className="sticky top-0 z-50 px-6 py-4">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand / Title with frosted glass physics */}
        <div className="flex items-center gap-3.5 glass-panel px-5 py-2.5 rounded-2xl shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white text-xs shadow-md shadow-blue-500/20 font-bold">
            DT
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-800">
                Electrical Digital Twin
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">IoT Smart Load Monitoring & Autonomous Agent</p>
          </div>
        </div>

        {/* Minimalist Frosted Glass Tab Selector */}
        <nav className="flex items-center p-1.5 glass-panel rounded-2xl shadow-sm gap-1">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? "bg-white text-slate-900 shadow-md shadow-slate-900/5 border border-white scale-[1.02]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? "bg-slate-900 text-white" : "bg-slate-200/70 text-slate-600"
                }`}>
                  {t.badge}
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </header>
  );
}