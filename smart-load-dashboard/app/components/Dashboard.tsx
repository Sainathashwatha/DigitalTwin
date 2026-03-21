"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    const res = await fetch("http://localhost:8000/latest");
    const d = await res.json();
    setData(d);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">📊 Live Electrical Data</h2>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Voltage" value={`${data.voltage} V`} />
        <Stat label="Current" value={`${data.current} A`} />
        <Stat label="kW" value={data.kW} />
        <Stat label="kVA" value={data.kVA} />
        <Stat label="kVAR" value={data.kVAR} />
        <Stat label="Power Factor" value={data.powerFactor} />
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-gray-700 p-4 rounded-lg text-center">
      <div className="text-sm text-gray-300">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}