"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import OrderDashboard from "@/views/OrderDashboard";

const PAGE_COMPONENTS: Record<string, React.ComponentType<{ brand: string; season: string }>> = {
  order_dashboard: OrderDashboard,
};

export default function Home() {
  const [activePage, setActivePage] = useState("order_dashboard");
  const [brand, setBrand] = useState("V");
  const [season, setSeason] = useState("26S");

  const PageComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activePage={activePage}
        onPageChange={setActivePage}
        brand={brand}
        onBrandChange={setBrand}
        season={season}
        onSeasonChange={setSeason}
      />

      <main className="flex-1 ml-[240px]">
        {/* Hero Bar */}
        <div className="mx-6 mt-6 mb-4">
          <div
            className="rounded-2xl px-7 py-5 flex items-center justify-between relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/25">
                🏭
              </div>
              <div>
                <div className="text-[10px] font-bold text-indigo-400 tracking-[2px] uppercase mb-1">
                  ISO AI AGENT
                </div>
                <div className="text-xl font-bold text-white">
                  {brand === "V" ? "🦆 DUVETICA" : "🎾 SERGIO TACCHINI"} SCM Dashboard
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Season {season} | Sourcing & Production Management
                </div>
              </div>
            </div>
            <div className="flex gap-8">
              {[
                { label: "Pages", value: "16" },
                { label: "APIs", value: "13" },
                { label: "KPIs", value: "27" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-xl font-bold text-indigo-300 font-mono">{stat.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-indigo-500/5" />
            <div className="absolute -right-4 -bottom-12 w-32 h-32 rounded-full bg-purple-500/5" />
          </div>
        </div>

        {/* Page Content */}
        <div className="px-6 pb-8">
          {PageComponent ? (
            <PageComponent brand={brand} season={season} />
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h2 className="text-xl font-semibold text-slate-400">준비 중</h2>
                <p className="text-slate-400 mt-2">이 페이지는 현재 개발 중입니다.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
