"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function LoadCurve() {
  const [data, setData] = useState<any[]>([]);
  const [peakDemand, setPeakDemand] = useState<number>(0);
  const [peakTime, setPeakTime] = useState<string>("");
  const [avgDemand, setAvgDemand] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = async () => {
    try {
      let res = await fetch("/backend/history?limit=30", { cache: "no-store" });
      if (!res.ok) {
        res = await fetch("http://127.0.0.1:8000/history?limit=30", { cache: "no-store" });
      }
      if (res.ok) {
        const d = await res.json();
        if (d && Array.isArray(d) && d.length > 0) {
          const formatted = d.map((item: any) => {
            let label = item.time_label;
            if (!label && item.timestamp) {
              const dt = new Date(item.timestamp);
              if (!isNaN(dt.getTime())) {
                label = dt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
              }
            }
            if (!label) label = new Date().toLocaleTimeString();

            return {
              time: label,
              kW: Number((item.kW || 0).toFixed(2)),
              current: Number((item.current || 0).toFixed(1)),
              pf: Number((item.powerFactor || 0.85).toFixed(2)),
              solar: Number((item.solar_kW || 0).toFixed(2)),
            };
          });

          setData(formatted);
          setLastUpdated(new Date().toLocaleTimeString());

          const kwList = formatted.map((p) => p.kW);
          const maxKw = Math.max(...kwList);
          const avgKw = kwList.reduce((a, b) => a + b, 0) / kwList.length;

          setPeakDemand(maxKw);
          setAvgDemand(avgKw);
          const maxItem = formatted.find((d) => d.kW === maxKw);
          if (maxItem) setPeakTime(maxItem.time);
        }
      }
    } catch (err) {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6 text-slate-800">
      
      {/* 3 Metric Cards with Clean Aesthetics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div className="glass-panel p-5 rounded-3xl shadow-lg shadow-slate-200/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Instant Peak Demand</span>
            <div className="text-2xl font-bold font-mono text-blue-600 mt-1 tracking-tight">
              {peakDemand.toFixed(2)} kW
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Recorded at {peakTime || "Active run"}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 shadow-inner">
            PEAK
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl shadow-lg shadow-slate-200/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Rolling Average Load</span>
            <div className="text-2xl font-bold font-mono text-indigo-600 mt-1 tracking-tight">
              {avgDemand.toFixed(2)} kW
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Across last 30 live polling cycles</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shadow-inner">
            AVG
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl shadow-lg shadow-slate-200/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Substation Breaker Limit</span>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1 tracking-tight">
              4.60 kW
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Headroom: {Math.max(0, 4.60 - peakDemand).toFixed(2)} kW</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-700 shadow-inner">
            LIMIT
          </div>
        </div>

      </div>

      {/* Main Frosted Glass Chart Container */}
      <div className="glass-panel p-6 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Real-Time Dynamic Load Profile Curve
              </h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live streaming active power draw (kW) with continuous temporal tracking every 5s • Last stream tick: {lastUpdated || "Syncing..."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs"></span>
              Active Load (kW)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
              Solar PV (kW)
            </span>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="h-[420px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

              <XAxis 
                dataKey="time" 
                tick={{ fill: "#64748b", fontSize: 11 }} 
                stroke="#cbd5e1"
                tickLine={false}
                minTickGap={25}
                dy={10}
              />
              <YAxis 
                domain={[0, 6.0]} 
                tick={{ fill: "#64748b", fontSize: 11 }} 
                stroke="#cbd5e1"
                tickLine={false}
                unit=" kW"
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Solar Curve Fill */}
              <Area
                type="monotone"
                dataKey="solar"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#amberGradient)"
                isAnimationActive={false}
              />

              {/* Active Load Curve Fill */}
              <Area
                type="monotone"
                dataKey="kW"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#blueGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-panel p-3.5 rounded-2xl shadow-xl border border-white text-xs space-y-1.5">
        <div className="font-semibold text-slate-800 border-b border-slate-200/80 pb-1 flex justify-between gap-4">
          <span className="font-mono">{label}</span>
          <span className="text-slate-500 font-mono">{data.pf} PF</span>
        </div>
        <div className="flex justify-between gap-4 text-blue-600 font-medium">
          <span>Active Power:</span>
          <span className="font-bold font-mono">{data.kW} kW</span>
        </div>
        <div className="flex justify-between gap-4 text-amber-600 font-medium">
          <span>Solar PV:</span>
          <span className="font-bold font-mono">+{data.solar} kW</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-500 text-[11px]">
          <span>Current:</span>
          <span className="font-mono">{data.current} A</span>
        </div>
      </div>
    );
  }
  return null;
}
