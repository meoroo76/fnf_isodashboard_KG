"use client";

import { useEffect, useState, useMemo } from "react";
import { api, CostMaster } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props { brand: string; season: string; }

const SEASON_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

function buildSeasonList(current: string): string[] {
  const y = parseInt(current.slice(0, 2));
  const half = current.slice(2);
  const seasons: string[] = [];
  // Go back to generate 4 seasons: e.g. 24F, 25S, 25F, 26S
  for (let i = 2; i >= 0; i--) {
    const yr = y - (half === "S" ? i : i > 0 ? i : 0);
    const prevHalf = i === 0 ? half : (half === "S" ? "F" : "S");
    if (i > 0) {
      seasons.push(`${(half === "S" ? y - i : y - i).toString().padStart(2, "0")}${half === "S" ? "F" : "S"}`);
    }
  }
  // Simpler approach: just produce 4 sequential seasons
  const result: string[] = [];
  let cy = y;
  let ch = half;
  for (let i = 0; i < 4; i++) {
    result.unshift(`${cy.toString().padStart(2, "0")}${ch}`);
    if (ch === "S") { ch = "F"; cy -= 1; }
    else { ch = "S"; }
  }
  return result;
}

export default function SeasonCompare({ brand, season }: Props) {
  const [seasonDataMap, setSeasonDataMap] = useState<Record<string, CostMaster[]>>({});
  const [loading, setLoading] = useState(true);

  const seasons = useMemo(() => buildSeasonList(season), [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all(
      seasons.map((s) => api.getCostMaster(brand, s).then((res) => ({ season: s, data: res.data as CostMaster[] })))
    ).then((results) => {
      const map: Record<string, CostMaster[]> = {};
      results.forEach((r) => { map[r.season] = r.data; });
      setSeasonDataMap(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, seasons]);

  // Per-season stats
  const seasonStats = useMemo(() =>
    seasons.map((s) => {
      const data = seasonDataMap[s] || [];
      const avgCost = data.length > 0 ? data.reduce((sum, r) => sum + (r.MFAC_COST_MFAC_COST_AMT || 0), 0) / data.length : 0;
      const avgMu = data.length > 0 ? data.reduce((sum, r) => sum + (r.MFAC_COST_MARKUP || 0), 0) / data.length : 0;
      const avgTag = data.length > 0 ? data.reduce((sum, r) => sum + (r.MFAC_COST_TAG_AMT || 0), 0) / data.length : 0;
      return { season: s, count: data.length, avgCost, avgMu, avgTag };
    }),
  [seasons, seasonDataMap]);

  const currStats = seasonStats.find((s) => s.season === season);
  const prevStats = seasonStats.length > 1 ? seasonStats[seasonStats.length - 2] : undefined;

  const kpis = useMemo(() => {
    const c = currStats || { avgCost: 0, avgMu: 0, count: 0 };
    const p = prevStats || { avgCost: 0, avgMu: 0 };
    const muTrend = seasonStats.length >= 2
      ? seasonStats[seasonStats.length - 1].avgMu - seasonStats[0].avgMu
      : 0;

    return [
      { label: `${season} 평균원가`, value: `$${c.avgCost.toFixed(1)}`, unit: "", icon: "💵", delta: p.avgCost > 0 ? ((c.avgCost / p.avgCost) - 1) * 100 : 0, prevValue: `전시즌 $${p.avgCost.toFixed(1)}`, accent: "#6366f1" },
      { label: `${season} 평균 M/U`, value: c.avgMu.toFixed(2), unit: "x", icon: "📐", delta: c.avgMu - p.avgMu, prevValue: `전시즌 ${p.avgMu.toFixed(2)}x`, accent: "#7c3aed" },
      { label: "M/U 추이", value: muTrend >= 0 ? `+${muTrend.toFixed(2)}` : muTrend.toFixed(2), unit: "x", icon: "📈", delta: 0, prevValue: `${seasons[0]} → ${seasons[seasons.length - 1]}`, accent: muTrend >= 0 ? "#059669" : "#ef4444" },
      { label: "비교 시즌 수", value: String(seasons.length), unit: "시즌", icon: "📅", delta: 0, prevValue: seasons.join(", "), accent: "#0891b2" },
    ];
  }, [currStats, prevStats, seasonStats, season, seasons]);

  // Grouped bar chart
  const chartData = useMemo(() => [
    {
      metric: "평균원가(USD)",
      ...Object.fromEntries(seasonStats.map((s) => [s.season, parseFloat(s.avgCost.toFixed(1))])),
    },
    {
      metric: "평균 M/U",
      ...Object.fromEntries(seasonStats.map((s) => [s.season, parseFloat(s.avgMu.toFixed(2))])),
    },
  ], [seasonStats]);

  // Dedicated chart for cost comparison
  const costChartData = useMemo(() =>
    seasonStats.map((s) => ({
      season: s.season,
      avgCost: parseFloat(s.avgCost.toFixed(1)),
      avgMu: parseFloat(s.avgMu.toFixed(2)),
      avgTag: Math.round(s.avgTag),
      styles: s.count,
    })),
  [seasonStats]);

  // Table
  const tableData = useMemo(() =>
    seasonStats.map((s) => ({
      season: s.season,
      styles: s.count.toLocaleString(),
      avgCost: `$${s.avgCost.toFixed(1)}`,
      avgMu: `${s.avgMu.toFixed(2)}x`,
      avgTag: `${Math.round(s.avgTag).toLocaleString()}원`,
    })),
  [seasonStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-bold text-slate-800">시즌 비교 분석</h2>
        <span className="text-sm text-slate-400">{seasons.join(" / ")}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">📊 시즌별 평균원가 / M/U 비교</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={costChartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="season" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} label={{ value: "USD", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
            <YAxis yAxisId="mu" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} label={{ value: "M/U", angle: 90, position: "insideRight", fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="cost" dataKey="avgCost" name="평균원가(USD)" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
            <Bar yAxisId="mu" dataKey="avgMu" name="평균 M/U" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 시즌 비교 매트릭스</h3>
        <DataTable
          columns={[
            { key: "season", label: "시즌", align: "center" as const },
            { key: "styles", label: "스타일수", align: "right" as const },
            { key: "avgCost", label: "평균원가(USD)", align: "right" as const },
            { key: "avgMu", label: "평균 M/U", align: "right" as const },
            { key: "avgTag", label: "평균TAG(KRW)", align: "right" as const },
          ]}
          data={tableData}
          compact
        />
      </div>
    </div>
  );
}
