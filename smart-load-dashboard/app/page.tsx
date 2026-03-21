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
    <div className="min-h-screen bg-[#020617] text-white font-sans overflow-hidden flex flex-col">
      
      {/* NAVBAR / HEADER */}
      {/* This assumes your NavbarTabs component handles the dark aesthetic header */}
      <NavbarTabs tab={tab} setTab={setTab} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow relative p-4 md:p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto h-full">

          {/* HOME TAB: 3D Twin & Dashboard 
            Using 'display' instead of conditional rendering so the 3D Canvas doesn't lag/reload.
          */}
          <div 
            className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 animation-fade-in"
            style={{ display: tab === "home" ? 'grid' : 'none' }}
          >
            {/* 3D Model Container - gets 2 columns for a wider aspect ratio */}
            <div className="lg:col-span-2 bg-slate-900/40 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden min-h-[500px]">
              <Building3D />
            </div>
            
            {/* Dashboard Container - acts as the right-side control panel */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <Dashboard />
            </div>
          </div>

          {/* CURVE TAB */}
          {tab === "curve" && (
            <div className="h-full min-h-[600px] animation-fade-in">
              <LoadCurve />
            </div>
          )}

          {/* AI INSIGHTS TAB */}
          {tab === "ai" && (
            <div className="h-full animation-fade-in">
              <AIInsights />
            </div>
          )}

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