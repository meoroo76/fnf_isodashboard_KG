"use client";

import { useEffect, useState, useMemo } from "react";
import { api, Claim } from "@/lib/api";
import { formatDelta } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

interface Props { brand: string; season: string; }

const DEFECT_COLORS: Record<string, string> = {
  "업체과실": "#7cb9a8", "제품특성": "#a8b4e0", "유통과실": "#d4b896",
  "부자재불량": "#c9a8d4", "봉제불량": "#e8b4b4", "원단불량": "#8ec5d6",
  "재단불량": "#b8c9a0", "기타불량": "#c4bfb6", "기타": "#c4bfb6",
};

export default function ClaimDashboard({ brand, season }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    api.getClaims(brand).then((res) => {
      setClaims(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand]);

  const currClaims = useMemo(() => claims.filter((c) => c.SESN === season), [claims, season]);
  const prevClaims = useMemo(() => claims.filter((c) => c.SESN === prevSeason), [claims, prevSeason]);

  const kpis = useMemo(() => {
    const currCount = currClaims.length;
    const prevCount = prevClaims.length;
    const currQty = currClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const prevQty = prevClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const currStyles = new Set(currClaims.map((c) => c.PRDT_CD)).size;
    const prevStyles = new Set(prevClaims.map((c) => c.PRDT_CD)).size;
    const currSuppliers = new Set(currClaims.map((c) => c.MFAC_COMPY_NM)).size;
    const prevAvg = prevCount > 0 ? prevQty / prevCount : 0;
    const currAvg = currCount > 0 ? currQty / currCount : 0;

    // 전대년비율: (1 - 금년/전년) * 100 → 양수=감소(좋음), 음수=증가(나쁨)
    const yoy = (curr: number, prev: number) => prev === 0 ? 0 : (1 - curr / prev) * 100;

    return [
      {
        label: "클레임 건수",
        value: currCount.toLocaleString(),
        unit: "건",
        icon: "🔔",
        delta: yoy(currCount, prevCount),
        prevValue: `전년 ${prevCount} 건`,
        accent: currCount <= prevCount ? "#059669" : "#ef4444",
      },
      {
        label: "클레임 수량",
        value: currQty.toLocaleString(),
        unit: "PCS",
        icon: "📉",
        delta: yoy(currQty, prevQty),
        prevValue: `전년 ${prevQty.toLocaleString()} PCS`,
        accent: currQty <= prevQty ? "#059669" : "#ef4444",
      },
      {
        label: "클레임 스타일",
        value: currStyles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: yoy(currStyles, prevStyles),
        prevValue: `전년 ${prevStyles} STY`,
        accent: "#7c3aed",
      },
      {
        label: "관련 협력사",
        value: currSuppliers.toLocaleString(),
        unit: "개",
        icon: "🏭",
        delta: 0,
        prevValue: `클레임 발생 협력사`,
        accent: "#0891b2",
      },
      {
        label: "건당 평균수량",
        value: currCount > 0 ? currAvg.toFixed(1) : "0",
        unit: "PCS",
        icon: "📊",
        delta: yoy(currAvg, prevAvg),
        prevValue: prevCount > 0 ? `전년 ${prevAvg.toFixed(1)} PCS` : "",
        accent: "#d97706",
      },
    ];
  }, [currClaims, prevClaims]);

  // 불량유형별 분포 (파이차트)
  const defectDist = useMemo(() => {
    const map = new Map<string, number>();
    currClaims.forEach((c) => {
      const type = c.CLAIM_ERR_CLS_NM || "기타";
      map.set(type, (map.get(type) || 0) + (c.CLAIM_QTY || 0));
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [currClaims]);

  // 협력사별 클레임 (바차트)
  const supplierClaims = useMemo(() => {
    const map = new Map<string, number>();
    currClaims.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      map.set(sup, (map.get(sup) || 0) + (c.CLAIM_QTY || 0));
    });
    return [...map.entries()]
      .map(([name, qty]) => ({ name, 수량: qty }))
      .sort((a, b) => b.수량 - a.수량)
      .slice(0, 10);
  }, [currClaims]);

  // 스타일별 클레임 테이블
  const [showAll, setShowAll] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [styleSearch, setStyleSearch] = useState("");

  const styleTable = useMemo(() => {
    const map = new Map<string, { prdt_nm: string; item_group: string; qty: number; count: number; supplier: string; types: Set<string> }>();
    currClaims.forEach((c) => {
      const key = c.PRDT_CD;
      const cur = map.get(key) || { prdt_nm: c.PRDT_NM || "-", item_group: c.ITEM_GROUP || "-", qty: 0, count: 0, supplier: c.MFAC_COMPY_NM || "-", types: new Set<string>() };
      cur.qty += c.CLAIM_QTY || 0;
      cur.count += 1;
      if (c.CLAIM_ERR_CLS_NM) cur.types.add(c.CLAIM_ERR_CLS_NM);
      map.set(key, cur);
    });
    return [...map.entries()]
      .map(([code, v]) => ({
        prdt_cd: code.replace(/^[A-Z]\d{2}[A-Z]/, ""),
        prdt_nm: v.prdt_nm,
        item_group: v.item_group,
        supplier: v.supplier,
        qty: v.qty,
        count: v.count,
        types: [...v.types].join(", "),
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [currClaims]);

  const supplierList = useMemo(() => {
    const set = new Set(styleTable.map((r) => r.supplier));
    return [...set].sort();
  }, [styleTable]);

  const filteredTable = useMemo(() => {
    let rows = styleTable;
    if (supplierFilter) rows = rows.filter((r) => r.supplier === supplierFilter);
    if (styleSearch) {
      const q = styleSearch.toLowerCase();
      rows = rows.filter((r) => r.prdt_cd.toLowerCase().includes(q) || r.prdt_nm.toLowerCase().includes(q));
    }
    return rows;
  }, [styleTable, supplierFilter, styleSearch]);

  const displayTable = showAll ? filteredTable : filteredTable.slice(0, 15);

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
        <div className="w-1.5 h-7 rounded-full bg-red-500" />
        <h2 className="text-lg font-bold text-slate-800">클레임 현황</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 불량유형 분포 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🔍 불량유형별 분포</h3>
          <div className="flex items-center gap-6">
            <div className="w-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={defectDist} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                    {defectDist.map((e, i) => <Cell key={i} fill={DEFECT_COLORS[e.name] || `hsl(${i * 60}, 50%, 55%)`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {defectDist.slice(0, 6).map((item) => {
                const total = defectDist.reduce((s, i) => s + i.value, 0);
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: DEFECT_COLORS[item.name] || "#c4bfb6" }} />
                    <span className="text-xs text-slate-600 w-28 truncate">{item.name} ({item.value.toLocaleString()}PCS)</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEFECT_COLORS[item.name] || "#c4bfb6" }} />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 협력사별 클레임 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🏭 협력사별 클레임 TOP 10</h3>
          <ResponsiveContainer width="100%" height={Math.max(280, supplierClaims.length * 36)}>
            <BarChart data={supplierClaims} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              <Bar dataKey="수량" radius={[0, 6, 6, 0]}>
                {supplierClaims.map((_, i) => {
                  const colors = Object.values(DEFECT_COLORS);
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 스타일별 클레임 테이블 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">📋 스타일별 클레임 현황</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="스타일 검색..."
              value={styleSearch}
              onChange={(e) => setStyleSearch(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 w-40"
            />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="">전체 협력사</option>
              {supplierList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {!showAll && filteredTable.length > 15 && (
              <button
                onClick={() => setShowAll(true)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                전체 보기 ({filteredTable.length})
              </button>
            )}
            {showAll && (
              <button
                onClick={() => setShowAll(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                TOP 15
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={[
            { key: "prdt_cd", label: "스타일코드", align: "left" as const, width: "120px" },
            { key: "prdt_nm", label: "스타일명", align: "left" as const },
            { key: "item_group", label: "복종", align: "left" as const, width: "70px" },
            { key: "supplier", label: "협력사", align: "left" as const, width: "120px" },
            { key: "qty", label: "클레임수량", align: "right" as const, width: "80px", format: (v: unknown) => Number(v).toLocaleString() },
            { key: "count", label: "건수", align: "right" as const, width: "60px" },
            { key: "types", label: "불량유형", align: "left" as const, width: "200px" },
          ]}
          data={displayTable}
          compact
        />
      </div>
    </div>
  );
}
