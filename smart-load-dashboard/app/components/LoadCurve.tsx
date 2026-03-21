"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

export default function LoadCurve() {
  const [data, setData] = useState<any[]>([]);
  const [peakDemand, setPeakDemand] = useState<number>(0);
  const [peakTime, setPeakTime] = useState<string>("");
  const [showPeakToast, setShowPeakToast] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:8000/history");
      if (!res.ok) return;

      const d = await res.json();

      const formatted = d.map((item: any) => ({
        time: new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        kW: Number(item.kW) || 0,
        fullTime: item.timestamp, // keep original for reference if needed
      }));

      const reversed = formatted.reverse();
      setData(reversed);

      // Calculate new peak from this fetch
      const maxKw = Math.max(...reversed.map((d: any) => d.kW));
      const maxItem = reversed.find((d: any) => d.kW === maxKw);

      if (maxKw > peakDemand && maxKw > 0) {
        setPeakDemand(maxKw);
        setPeakTime(maxItem?.time || "");
        setShowPeakToast(true);

        // Auto-hide toast after 5 seconds
        setTimeout(() => setShowPeakToast(false), 5000);
      }
    } catch (err) {
      console.error("Failed to load power history", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Find the data point with peak for ReferenceDot
  const peakPoint = useMemo(() => {
    if (!data.length || peakDemand === 0) return null;
    return data.find((d) => d.kW === peakDemand) || null;
  }, [data, peakDemand]);

  return (
    <div className="relative bg-gradient-to-br from-gray-900 via-slate-950 to-gray-950 rounded-2xl border border-slate-800/60 shadow-2xl shadow-black/40 overflow-hidden">
      {/* Peak Notification Toast */}
      {showPeakToast && (
        <div className="absolute top-4 right-4 z-50 animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-white rounded-xl shadow-xl shadow-amber-900/40 border border-amber-500/30 backdrop-blur-sm">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold">New Peak Demand Detected!</p>
              <p className="text-sm opacity-90">
                {peakDemand.toFixed(2)} kW at {peakTime}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-800/50 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <span className="text-white text-xl font-bold">⚡</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Power Load Curve
            </h2>
            <p className="text-xs text-slate-400">Real-time consumption trend</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-medium px-3 py-1.5 bg-slate-800/60 rounded-full text-slate-300 border border-slate-700/50">
            {data.length > 0
              ? `${data[0].time} – ${data[data.length - 1].time}`
              : "Loading..."}
          </div>

          {peakDemand > 0 && (
            <div className="text-xs font-semibold px-3 py-1.5 bg-amber-900/40 rounded-full text-amber-300 border border-amber-700/40 flex items-center gap-1.5">
              <span>Peak:</span>
              <span>{peakDemand.toFixed(1)} kW</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-5 pb-7 pt-4">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <defs>
              <linearGradient id="colorKw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#334155"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              dy={8}
            />

            <YAxis
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val} kW`}
              width={50}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.6)",
                color: "#e2e8f0",
                fontSize: "13px",
              }}
              labelStyle={{ color: "#60a5fa", fontWeight: 600 }}
              itemStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => [`${value.toFixed(2)} kW`, "Load"]}
            />

            <Line
              type="monotone"
              dataKey="kW"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 6,
                stroke: "#60a5fa",
                strokeWidth: 3,
                strokeOpacity: 0.4,
                fill: "#0f172a",
              }}
              fill="url(#colorKw)"
            />

            {/* Highlight current peak with a dot + label */}
            {peakPoint && (
              <ReferenceDot
                x={peakPoint.time}
                y={peakPoint.kW}
                r={6}
                fill="#fbbf24"
                stroke="#d97706"
                strokeWidth={2}
                ifOverflow="visible"
              >
                {/* Custom label above the peak dot */}
                <text
                  x={0}
                  y={-12}
                  textAnchor="middle"
                  fill="#fbbf24"
                  fontSize={11}
                  fontWeight="bold"
                  className="drop-shadow-md"
                >
                  Peak {peakPoint.kW.toFixed(1)} kW
                </text>
              </ReferenceDot>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div className="text-center py-6 text-slate-500 text-sm">
          Waiting for data from backend...
        </div>
      )}
    </div>
  );
}
