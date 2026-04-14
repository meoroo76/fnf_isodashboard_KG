"use client";

import { useEffect, useState, useMemo } from "react";
import { api, CostMaster } from "@/lib/api";
import { calcYoY } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import { useProductImages } from "@/hooks/useProductImages";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props { brand: string; season: string; }

const MU_COLORS = { curr: "#6366f1", prev: "#c7d2fe" };

export default function MarkupAnalysis({ brand, season }: Props) {
  const [currData, setCurrData] = useState<CostMaster[]>([]);
  const [prevData, setPrevData] = useState<CostMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const imgMap = useProductImages();

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getCostMaster(brand, season),
      api.getCostMaster(brand, prevSeason),
    ]).then(([curr, prev]) => {
      setCurrData(curr.data as CostMaster[]);
      setPrevData(prev.data as CostMaster[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  const kpis = useMemo(() => {
    if (!currData.length) return [];

    const avg = (d: CostMaster[], key: keyof CostMaster) => {
      const vals = d.filter((r) => typeof r[key] === "number" && (r[key] as number) > 0);
      return vals.length > 0 ? vals.reduce((s, r) => s + (r[key] as number), 0) / vals.length : 0;
    };

    const cMu = avg(currData, "MFAC_COST_MARKUP");
    const pMu = avg(prevData, "MFAC_COST_MARKUP");
    const cCost = avg(currData, "MFAC_COST_MFAC_COST_AMT");
    const pCost = avg(prevData, "MFAC_COST_MFAC_COST_AMT");
    const cTag = avg(currData, "MFAC_COST_TAG_AMT");
    const pTag = avg(prevData, "MFAC_COST_TAG_AMT");

    // Best / worst markup category
    const catMap = new Map<string, { sum: number; count: number }>();
    currData.forEach((r) => {
      const cat = r.ITEM_GROUP || "기타";
      const cur = catMap.get(cat) || { sum: 0, count: 0 };
      cur.sum += r.MFAC_COST_MARKUP || 0;
      cur.count += 1;
      catMap.set(cat, cur);
    });
    const catAvgs = [...catMap.entries()].map(([cat, v]) => ({
      cat, avg: v.count > 0 ? v.sum / v.count : 0,
    })).sort((a, b) => b.avg - a.avg);
    const bestCat = catAvgs[0];
    const worstCat = catAvgs[catAvgs.length - 1];

    return [
      { label: "평균 M/U", value: cMu.toFixed(2), unit: "x", icon: "📐", delta: cMu - pMu, prevValue: `전년 ${pMu.toFixed(2)}x`, accent: "#6366f1" },
      { label: "평균원가(USD)", value: `$${cCost.toFixed(1)}`, unit: "", icon: "💵", delta: calcYoY(cCost, pCost), prevValue: `전년 $${pCost.toFixed(1)}`, accent: "#7c3aed" },
      { label: "평균TAG(KRW)", value: Math.round(cTag).toLocaleString(), unit: "원", icon: "🏷️", delta: calcYoY(cTag, pTag), prevValue: `전년 ${Math.round(pTag).toLocaleString()}원`, accent: "#2563eb" },
      { label: "스타일수", value: currData.length.toLocaleString(), unit: "STY", icon: "👗", delta: calcYoY(currData.length, prevData.length), prevValue: `전년 ${prevData.length} STY`, accent: "#0891b2" },
      { label: "최고 M/U 카테고리", value: bestCat?.cat || "-", unit: bestCat ? `${bestCat.avg.toFixed(2)}x` : "", icon: "🏆", delta: 0, prevValue: "M/U 최고", accent: "#059669" },
      { label: "최저 M/U 카테고리", value: worstCat?.cat || "-", unit: worstCat ? `${worstCat.avg.toFixed(2)}x` : "", icon: "⚠️", delta: 0, prevValue: "M/U 최저", accent: "#ef4444" },
    ];
  }, [currData, prevData]);

  // Chart: markup by ITEM_GROUP (curr vs prev)
  const chartData = useMemo(() => {
    const buildMap = (d: CostMaster[]) => {
      const m = new Map<string, { sum: number; count: number }>();
      d.forEach((r) => {
        const cat = r.ITEM_GROUP || "기타";
        const cur = m.get(cat) || { sum: 0, count: 0 };
        cur.sum += r.MFAC_COST_MARKUP || 0;
        cur.count += 1;
        m.set(cat, cur);
      });
      return m;
    };
    const currMap = buildMap(currData);
    const prevMap = buildMap(prevData);
    const allCats = new Set([...currMap.keys(), ...prevMap.keys()]);

    return [...allCats].map((cat) => {
      const c = currMap.get(cat);
      const p = prevMap.get(cat);
      return {
        category: cat,
        [season]: c ? parseFloat((c.sum / c.count).toFixed(2)) : 0,
        [prevSeason]: p ? parseFloat((p.sum / p.count).toFixed(2)) : 0,
      };
    }).sort((a, b) => (b[season] as number) - (a[season] as number));
  }, [currData, prevData, season, prevSeason]);

  // Table: style-level detail
  const tableData = useMemo(() =>
    currData.slice(0, 100).map((r) => ({
      prdt_cd_full: r.PRDT_CD,
      prdt_cd: r.PRDT_CD.replace(/^[A-Z]\d{2}[A-Z]/, ""),
      prdt_nm: r.PRDT_NM,
      item_group: r.ITEM_GROUP,
      tag_price: r.TAG_PRICE ? `${Math.round(r.TAG_PRICE).toLocaleString()}원` : "-",
      cost_usd: r.MFAC_COST_MFAC_COST_AMT ? `$${r.MFAC_COST_MFAC_COST_AMT.toFixed(1)}` : "-",
      markup: r.MFAC_COST_MARKUP ? `${r.MFAC_COST_MARKUP.toFixed(2)}x` : "-",
    })),
  [currData]);

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
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">마크업(M/U) 분석</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">📊 카테고리별 평균 M/U 비교</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={season} fill={MU_COLORS.curr} radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey={prevSeason} fill={MU_COLORS.prev} radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 스타일별 마크업 상세</h3>
        <DataTable
          columns={[
            { key: "prdt_cd", label: "스타일코드", align: "left" as const, render: (_v: unknown, row: Record<string, unknown>) => { const cd = String(row.prdt_cd_full || row.prdt_cd || ""); const img = imgMap[cd]; return (<span className="inline-flex items-center gap-1.5">{img ? <img src={img} alt="" className="w-7 h-7 object-cover rounded border border-slate-200 flex-shrink-0" /> : <span className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 flex-shrink-0">IMG</span>}{String(row.prdt_cd || "")}</span>); } },
            { key: "prdt_nm", label: "스타일명", align: "left" as const },
            { key: "item_group", label: "카테고리", align: "left" as const },
            { key: "tag_price", label: "TAG가격", align: "right" as const },
            { key: "cost_usd", label: "원가(USD)", align: "right" as const },
            { key: "markup", label: "M/U", align: "right" as const },
          ]}
          data={tableData}
          compact
        />
      </div>
    </div>
  );
}
