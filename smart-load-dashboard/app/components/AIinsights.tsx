import React from "react";

const AIInsights = () => {
  const load = 1.84;

  const suggestions = [
    "Turn off non-essential appliances",
    "Shift usage to off-peak hours",
    "Reduce AC temperature usage",
  ];

  return (
    <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-3">🤖 AI Alerts</h2>

      <p className="mb-2">
        Current Load: <span className="font-semibold">{load} kW</span>
      </p>

      <p className="mb-3 text-red-400 font-semibold">
        ⚠️ Abnormal Load Detected!
      </p>

      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="bg-red-900/40 px-3 py-2 rounded-lg text-sm border border-red-500"
          >
            • {s}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIInsights;