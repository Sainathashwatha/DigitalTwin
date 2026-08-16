"use client";

import { useEffect, useState } from "react";

interface TelemetryPoint {
  voltage: number;
  current: number;
  kW: number;
  kVA: number;
  kVAR: number;
  powerFactor: number;
  solar_kW?: number;
  kWh?: number;
}

export default function Dashboard() {
  const [data, setData] = useState<TelemetryPoint>({
    voltage: 230.0,
    current: 16.74,
    kW: 3.85,
    kVA: 4.05,
    kVAR: 1.24,
    powerFactor: 0.84,
    solar_kW: 2.10,
    kWh: 14.82,
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/backend/latest", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        if (d) setData(d);
      } else {
        const fallback = await fetch("http://127.0.0.1:8000/latest", { cache: "no-store" });
        if (fallback.ok) {
          const d = await fallback.json();
          if (d) setData(d);
        }
      }
    } catch (e) {
      try {
        const fallback = await fetch("http://127.0.0.1:8000/latest", { cache: "no-store" });
        if (fallback.ok) {
          const d = await fallback.json();
          if (d) setData(d);
        }
      } catch (err) {}
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  const pfCompliant = data.powerFactor >= 0.80;
  const isSurge = data.kW > 4.60;
  const isWarning = data.kW > 4.20;

  return (
    <div className="flex flex-col gap-6 text-slate-800">
      
      {/* Primary Electrical Telemetry Suite */}
      <div className="glass-panel rounded-3xl p-6 shadow-xl shadow-slate-200/50">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shadow-inner">
              SUB
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Live Substation Telemetry</h2>
              <p className="text-[11px] text-slate-500">Continuous 230V Line Monitoring (5s Stream)</p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
            isSurge 
              ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
              : isWarning
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isSurge ? 'Critical Overload' : isWarning ? 'High Demand' : 'Normal Load'}
          </span>
        </div>

        {/* 6 Key Parameter Tiles with Frosted Glass Physics */}
        <div className="grid grid-cols-2 gap-3.5">
          <Stat 
            label="Line Voltage" 
            value={`${data.voltage.toFixed(1)} V`} 
            sub="Single-phase nominal"
            accent="bg-sky-500/5 border-sky-100 text-sky-900"
            valueColor="text-sky-700"
          />
          <Stat 
            label="Total Current" 
            value={`${data.current.toFixed(2)} A`} 
            sub="Max rating: 20.0 A"
            accent="bg-cyan-500/5 border-cyan-100 text-cyan-900"
            valueColor={data.current > 20.0 ? "text-rose-600 font-bold" : data.current > 18.2 ? "text-amber-600" : "text-cyan-700"}
          />
          <Stat 
            label="Active Power (P)" 
            value={`${data.kW.toFixed(2)} kW`} 
            sub="Real billing power"
            accent="bg-blue-500/5 border-blue-100 text-blue-900"
            valueColor={data.kW > 4.60 ? "text-rose-600 font-bold" : data.kW > 4.20 ? "text-amber-600" : "text-blue-700"}
          />
          <Stat 
            label="Apparent Power (S)" 
            value={`${data.kVA.toFixed(2)} kVA`} 
            sub="Substation capacity"
            accent="bg-indigo-500/5 border-indigo-100 text-indigo-900"
            valueColor="text-indigo-700"
          />
          <Stat 
            label="Reactive Power (Q)" 
            value={`${data.kVAR.toFixed(2)} kVAR`} 
            sub="Magnetizing losses"
            accent="bg-purple-500/5 border-purple-100 text-purple-900"
            valueColor="text-purple-700"
          />
          <Stat 
            label="Power Factor" 
            value={`${data.powerFactor.toFixed(2)}`} 
            sub={pfCompliant ? "Optimal (≥0.80)" : "Lagging (<0.80)"}
            accent={pfCompliant ? "bg-emerald-500/5 border-emerald-100 text-emerald-900" : "bg-amber-500/5 border-amber-100 text-amber-900"}
            valueColor={pfCompliant ? "text-emerald-700" : "text-amber-700"}
          />
        </div>

      </div>

      {/* Microgrid Solar & Net Grid Feed */}
      <div className="glass-panel rounded-3xl p-5 shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Microgrid Solar Synergy
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Self-Consuming
          </span>
        </div>
        
        <div className="space-y-2.5">
          <div className="p-3 bg-white/70 backdrop-blur-md rounded-2xl border border-white flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Rooftop Solar PV</span>
            </div>
            <span className="font-mono text-amber-600 font-bold text-sm">
              +{Number(data.solar_kW || 2.1).toFixed(2)} kW
            </span>
          </div>

          <div className="p-3 bg-white/70 backdrop-blur-md rounded-2xl border border-white flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Net Utility Draw</span>
            </div>
            <span className="font-mono text-slate-800 font-bold text-sm">
              {Math.max(0, data.kW - (data.solar_kW || 0)).toFixed(2)} kW
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

function Stat({ 
  label, 
  value, 
  sub, 
  accent, 
  valueColor 
}: { 
  label: string; 
  value: string; 
  sub: string; 
  accent: string; 
  valueColor: string; 
}) {
  return (
    <div className={`p-4 rounded-2xl border ${accent} bg-white/80 backdrop-blur-md shadow-xs transition hover:shadow-md duration-200 flex flex-col justify-between`}>
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={`text-xl font-bold font-mono my-1 tracking-tight ${valueColor}`}>{value}</div>
      <span className="text-[10px] text-slate-400 font-medium">{sub}</span>
    </div>
  );
}