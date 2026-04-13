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
  "봉제불량": "#ef4444", "원단불량": "#3b82f6", "부자재불량": "#f59e0b",
  "재단불량": "#8b5cf6", "기타불량": "#6b7280",
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

    return [
      {
        label: "클레임 건수",
        value: currCount.toLocaleString(),
        unit: "건",
        icon: "🔔",
        delta: currCount - prevCount,
        prevValue: `전년 ${prevCount} 건`,
        accent: currCount <= prevCount ? "#059669" : "#ef4444",
      },
      {
        label: "클레임 수량",
        value: currQty.toLocaleString(),
        unit: "PCS",
        icon: "📉",
        delta: currQty - prevQty,
        prevValue: `전년 ${prevQty.toLocaleString()} PCS`,
        accent: currQty <= prevQty ? "#059669" : "#ef4444",
      },
      {
        label: "클레임 스타일",
        value: currStyles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: currStyles - prevStyles,
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
        value: currCount > 0 ? (currQty / currCount).toFixed(1) : "0",
        unit: "PCS",
        icon: "📊",
        delta: 0,
        prevValue: prevCount > 0 ? `전년 ${(prevQty / prevCount).toFixed(1)} PCS` : "",
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
      .map(([name, qty]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, 수량: qty }))
      .sort((a, b) => b.수량 - a.수량)
      .slice(0, 10);
  }, [currClaims]);

  // 스타일별 클레임 테이블
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
        prdt_cd: code,
        prdt_nm: v.prdt_nm,
        item_group: v.item_group,
        supplier: v.supplier,
        qty: v.qty,
        count: v.count,
        types: [...v.types].join(", "),
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 30);
  }, [currClaims]);

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
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: DEFECT_COLORS[item.name] || "#94a3b8" }} />
                    <span className="text-xs text-slate-600 w-16 truncate">{item.name}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEFECT_COLORS[item.name] || "#94a3b8" }} />
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={supplierClaims} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              <Bar dataKey="수량" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 스타일별 클레임 테이블 */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 스타일별 클레임 현황 (TOP 30)</h3>
        <DataTable
          columns={[
            { key: "prdt_cd", label: "스타일코드", align: "left" as const },
            { key: "prdt_nm", label: "스타일명", align: "left" as const },
            { key: "item_group", label: "복종", align: "left" as const },
            { key: "supplier", label: "협력사", align: "left" as const },
            { key: "qty", label: "클레임수량", align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
            { key: "count", label: "건수", align: "right" as const },
            { key: "types", label: "불량유형", align: "left" as const },
          ]}
          data={styleTable}
          compact
        />
      </div>
    </div>
  );
}
