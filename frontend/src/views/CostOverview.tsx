"use client";

import { useEffect, useState, useMemo } from "react";
import { api, CostMaster } from "@/lib/api";
import { formatNumber, calcYoY, formatDelta } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

interface Props { brand: string; season: string; }

const COST_COLORS: Record<string, string> = {
  "원부자재": "#3b82f6", "아트웍": "#8b5cf6", "공임": "#f59e0b",
  "정상마진": "#10b981", "경비": "#6b7280",
};

export default function CostOverview({ brand, season }: Props) {
  const [currData, setCurrData] = useState<CostMaster[]>([]);
  const [prevData, setPrevData] = useState<CostMaster[]>([]);
  const [currAccount, setCurrAccount] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getCostMaster(brand, season),
      api.getCostMaster(brand, prevSeason),
      api.getCostAccount(brand, season),
    ]).then(([curr, prev, acc]) => {
      setCurrData(curr.data as CostMaster[]);
      setPrevData(prev.data as CostMaster[]);
      setCurrAccount(acc.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  const kpis = useMemo(() => {
    if (!currData.length) return [];

    const avgCost = (d: CostMaster[]) => d.length > 0 ? d.reduce((s, r) => s + (r.MFAC_COST_MFAC_COST_AMT || 0), 0) / d.length : 0;
    const avgMarkup = (d: CostMaster[]) => d.length > 0 ? d.reduce((s, r) => s + (r.MFAC_COST_MARKUP || 0), 0) / d.length : 0;
    const avgTag = (d: CostMaster[]) => d.length > 0 ? d.reduce((s, r) => s + (r.MFAC_COST_TAG_AMT || 0), 0) / d.length : 0;
    const avgExch = (d: CostMaster[]) => {
      const rates = d.filter((r) => (r.MFAC_COST_EXCHAGE_RATE || 0) > 0);
      return rates.length > 0 ? rates.reduce((s, r) => s + r.MFAC_COST_EXCHAGE_RATE, 0) / rates.length : 0;
    };

    const cCost = avgCost(currData);
    const pCost = avgCost(prevData);
    const cMu = avgMarkup(currData);
    const pMu = avgMarkup(prevData);
    const cTag = avgTag(currData);
    const pTag = avgTag(prevData);
    const cExch = avgExch(currData);

    // 원가율 계산
    const costRate = cTag > 0 && cExch > 0 ? (cCost / (cTag / 1.1 / cExch)) * 100 : 0;
    const pExch = avgExch(prevData);
    const prevCostRate = pTag > 0 && pExch > 0 ? (pCost / (pTag / 1.1 / pExch)) * 100 : 0;

    return [
      {
        label: "원가율(USD)",
        value: costRate.toFixed(1),
        unit: "%",
        icon: "📈",
        delta: costRate - prevCostRate,
        prevValue: `전년 ${prevCostRate.toFixed(1)}%`,
        accent: "#4f46e5",
      },
      {
        label: "평균원가(USD)",
        value: `$${cCost.toFixed(1)}`,
        unit: "",
        icon: "💵",
        delta: calcYoY(cCost, pCost),
        prevValue: `전년 $${pCost.toFixed(1)}`,
        accent: "#7c3aed",
      },
      {
        label: "평균TAG(KRW)",
        value: Math.round(cTag).toLocaleString(),
        unit: "원",
        icon: "🏷️",
        delta: calcYoY(cTag, pTag),
        prevValue: `전년 ${Math.round(pTag).toLocaleString()}원`,
        accent: "#2563eb",
      },
      {
        label: "M/U",
        value: cMu.toFixed(2),
        unit: "x",
        icon: "📐",
        delta: cMu - pMu,
        prevValue: `전년 ${pMu.toFixed(2)}x`,
        accent: cMu >= pMu ? "#059669" : "#ef4444",
      },
      {
        label: "스타일수",
        value: currData.length.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: calcYoY(currData.length, prevData.length),
        prevValue: `전년 ${prevData.length} STY`,
        accent: "#0891b2",
      },
    ];
  }, [currData, prevData]);

  // 원가 구성 파이 차트
  const costBreakdown = useMemo(() => {
    if (!currAccount.length) return [];
    const map = new Map<string, number>();
    currAccount.forEach((r) => {
      const type1 = String(r.MFAC_COST_ACCOUNT_TYPE1_NM || "기타");
      const amt = Number(r.MFAC_COST_COST_AMT || 0);
      map.set(type1, (map.get(type1) || 0) + amt);
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [currAccount]);

  // 카테고리별 원가 테이블
  const categoryTable = useMemo(() => {
    if (!currData.length) return [];
    const map = new Map<string, { count: number; costSum: number; tagSum: number; muSum: number }>();
    currData.forEach((r) => {
      const cat = r.ITEM_GROUP || "기타";
      const cur = map.get(cat) || { count: 0, costSum: 0, tagSum: 0, muSum: 0 };
      cur.count += 1;
      cur.costSum += r.MFAC_COST_MFAC_COST_AMT || 0;
      cur.tagSum += r.MFAC_COST_TAG_AMT || 0;
      cur.muSum += r.MFAC_COST_MARKUP || 0;
      map.set(cat, cur);
    });
    return [...map.entries()].map(([cat, v]) => ({
      category: cat,
      count: v.count,
      avgCost: v.count > 0 ? (v.costSum / v.count).toFixed(1) : "0",
      avgTag: v.count > 0 ? Math.round(v.tagSum / v.count).toLocaleString() : "0",
      avgMu: v.count > 0 ? (v.muSum / v.count).toFixed(2) : "0",
    })).sort((a, b) => b.count - a.count);
  }, [currData]);

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
        <div className="w-1.5 h-7 rounded-full bg-purple-500" />
        <h2 className="text-lg font-bold text-slate-800">원가 총괄</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* 원가 구성 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-5">💰 원가 구성</h3>
        <div className="flex items-center gap-8">
          <div className="w-[280px]">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  stroke="none"
                >
                  {costBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={COST_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {costBreakdown.map((item) => {
              const total = costBreakdown.reduce((s, i) => s + i.value, 0);
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm" style={{ background: COST_COLORS[item.name] || "#94a3b8" }} />
                  <span className="text-sm text-slate-600 w-20">{item.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COST_COLORS[item.name] || "#94a3b8" }} />
                  </div>
                  <span className="text-sm font-mono text-slate-700 w-14 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 카테고리별 원가 */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 카테고리별 원가 현황</h3>
        <DataTable
          columns={[
            { key: "category", label: "카테고리", align: "left" as const },
            { key: "count", label: "스타일수", align: "right" as const },
            { key: "avgCost", label: "평균원가(USD)", align: "right" as const, format: (v: unknown) => `$${v}` },
            { key: "avgTag", label: "평균TAG(KRW)", align: "right" as const },
            { key: "avgMu", label: "M/U", align: "right" as const, format: (v: unknown) => `${v}x` },
          ]}
          data={categoryTable}
          compact
        />
      </div>
    </div>
  );
}
