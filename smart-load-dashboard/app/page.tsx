"use client";

import { useState } from "react";
import Building3D from "./components/Building3D";
import Dashboard from "./components/Dashboard";
import LoadCurve from "./components/LoadCurve";
import AIInsights from "./components/AIinsights";
import NavbarTabs from "./components/NavbarTabs";

export default function Home() {
  const [tab, setTab] = useState("home");

  return (
    <div className="min-h-screen font-sans flex flex-col relative selection:bg-blue-500/20">
      
      {/* Background Decorative Frosted Light Blooms */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[130px]"></div>
        <div className="absolute -bottom-20 left-1/3 w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-[140px]"></div>
      </div>

      {/* NAVBAR / HEADER */}
      <NavbarTabs tab={tab} setTab={setTab} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow relative p-4 md:p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto h-full">

          {/* HOME TAB: 3D Twin & Substation Dashboard */}
          <div 
            className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300"
            style={{ display: tab === "home" ? 'grid' : 'none' }}
          >
            <div className="lg:col-span-2 glass-panel rounded-3xl relative overflow-hidden min-h-[620px] h-[75vh] flex flex-col p-1 shadow-lg shadow-slate-200/50">
              <Building3D />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <Dashboard />
            </div>
          </div>

          {/* CURVE TAB */}
          <div 
            className="h-full min-h-[600px] transition-opacity duration-300"
            style={{ display: tab === "curve" ? 'block' : 'none' }}
          >
            <LoadCurve />
          </div>

          {/* AI INSIGHTS TAB */}
          <div 
            className="h-full transition-opacity duration-300"
            style={{ display: tab === "ai" ? 'block' : 'none' }}
          >
            <AIInsights />
          </div>

        </div>
      </main>
      
      {/* Optional: Add this global style if you haven't already to enable smooth fade-ins */}
      <style dangerouslySetInnerHTML={{__html: `
        .animation-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}} />
    </div>
  );
}