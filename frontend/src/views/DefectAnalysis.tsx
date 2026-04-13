"use client";

import { useEffect, useState, useMemo } from "react";
import { api, Claim } from "@/lib/api";
import { calcYoY } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props { brand: string; season: string; }

const HEATMAP_SCALE = ["#f1f5f9", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af", "#1e3a8a"];

function heatColor(value: number, max: number): string {
  if (max === 0) return HEATMAP_SCALE[0];
  const ratio = value / max;
  const idx = Math.min(Math.floor(ratio * (HEATMAP_SCALE.length - 1)), HEATMAP_SCALE.length - 1);
  return HEATMAP_SCALE[idx];
}

export default function DefectAnalysis({ brand, season }: Props) {
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

  /* ── KPI ── */
  const kpis = useMemo(() => {
    const currQty = currClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const prevQty = prevClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const defectTypes = new Set(currClaims.map((c) => c.CLAIM_ERR_CLS_NM)).size;
    const suppliers = new Set(currClaims.map((c) => c.MFAC_COMPY_NM)).size;
    const styles = new Set(currClaims.map((c) => c.PRDT_CD)).size;
    const prevStyles = new Set(prevClaims.map((c) => c.PRDT_CD)).size;

    return [
      {
        label: "불량 총수량",
        value: currQty.toLocaleString(),
        unit: "PCS",
        icon: "🔴",
        delta: calcYoY(currQty, prevQty),
        prevValue: `전년 ${prevQty.toLocaleString()} PCS`,
        accent: currQty <= prevQty ? "#059669" : "#ef4444",
      },
      {
        label: "불량유형 수",
        value: String(defectTypes),
        unit: "종",
        icon: "🏷️",
        delta: 0,
        prevValue: "봉제/원단/부자재 등",
        accent: "#7c3aed",
      },
      {
        label: "관련 협력사",
        value: String(suppliers),
        unit: "개",
        icon: "🏭",
        delta: 0,
        prevValue: "불량 발생 협력사",
        accent: "#0891b2",
      },
      {
        label: "불량 스타일수",
        value: styles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: calcYoY(styles, prevStyles),
        prevValue: `전년 ${prevStyles} STY`,
        accent: "#2563eb",
      },
    ];
  }, [currClaims, prevClaims]);

  /* ── Heatmap: supplier x defect type ── */
  const heatmapData = useMemo(() => {
    const supplierMap = new Map<string, Map<string, number>>();
    currClaims.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      const defect = c.CLAIM_ERR_CLS_NM || "기타";
      if (!supplierMap.has(sup)) supplierMap.set(sup, new Map());
      const dm = supplierMap.get(sup)!;
      dm.set(defect, (dm.get(defect) || 0) + (c.CLAIM_QTY || 0));
    });

    // Top 12 suppliers by total qty
    const supplierTotals = [...supplierMap.entries()]
      .map(([name, dm]) => ({ name, total: [...dm.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const defectTypes = [...new Set(currClaims.map((c) => c.CLAIM_ERR_CLS_NM || "기타"))];
    const maxVal = Math.max(1, ...supplierTotals.flatMap(({ name }) => {
      const dm = supplierMap.get(name)!;
      return [...dm.values()];
    }));

    return { supplierTotals, defectTypes, supplierMap, maxVal };
  }, [currClaims]);

  /* ── Top 10 styles by defect count ── */
  const topStyles = useMemo(() => {
    const map = new Map<string, { prdt_nm: string; item_group: string; supplier: string; qty: number; defects: Set<string> }>();
    currClaims.forEach((c) => {
      const key = c.PRDT_CD;
      const cur = map.get(key) || {
        prdt_nm: c.PRDT_NM || "-",
        item_group: c.ITEM_GROUP || "-",
        supplier: c.MFAC_COMPY_NM || "-",
        qty: 0,
        defects: new Set<string>(),
      };
      cur.qty += c.CLAIM_QTY || 0;
      if (c.CLAIM_ERR_CLS_NM) cur.defects.add(c.CLAIM_ERR_CLS_NM);
      map.set(key, cur);
    });
    return [...map.entries()]
      .map(([code, v]) => ({
        prdt_cd: code,
        prdt_nm: v.prdt_nm,
        item_group: v.item_group,
        supplier: v.supplier,
        qty: v.qty,
        defects: [...v.defects].join(", "),
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [currClaims]);

  /* ── Top 10 styles bar chart ── */
  const topStylesBar = useMemo(() =>
    topStyles.map((s) => ({
      name: s.prdt_cd.length > 12 ? s.prdt_cd.slice(0, 12) + "…" : s.prdt_cd,
      수량: s.qty,
    })),
  [topStyles]);

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

  const { supplierTotals, defectTypes, supplierMap, maxVal } = heatmapData;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-red-500" />
        <h2 className="text-lg font-bold text-slate-800">불량 분석</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Heatmap: supplier x defect type */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🔥 협력사 x 불량유형 히트맵</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-slate-500 font-semibold">협력사</th>
                {defectTypes.map((dt) => (
                  <th key={dt} className="text-center px-2 py-1.5 text-slate-500 font-semibold whitespace-nowrap">
                    {dt.length > 6 ? dt.slice(0, 6) + "…" : dt}
                  </th>
                ))}
                <th className="text-right px-2 py-1.5 text-slate-500 font-semibold">합계</th>
              </tr>
            </thead>
            <tbody>
              {supplierTotals.map(({ name, total }) => {
                const dm = supplierMap.get(name)!;
                return (
                  <tr key={name} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap">
                      {name.length > 14 ? name.slice(0, 14) + "…" : name}
                    </td>
                    {defectTypes.map((dt) => {
                      const val = dm.get(dt) || 0;
                      return (
                        <td
                          key={dt}
                          className="text-center px-2 py-1.5 font-mono tabular-nums"
                          style={{ backgroundColor: val > 0 ? heatColor(val, maxVal) : undefined, color: val > maxVal * 0.5 ? "#fff" : "#334155" }}
                        >
                          {val > 0 ? val.toLocaleString() : ""}
                        </td>
                      );
                    })}
                    <td className="text-right px-2 py-1.5 font-bold text-slate-800 tabular-nums">{total.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-400">
          <span>적음</span>
          {HEATMAP_SCALE.map((c, i) => (
            <div key={i} className="w-5 h-3 rounded-sm" style={{ background: c }} />
          ))}
          <span>많음</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top 10 bar */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">📊 불량 TOP 10 스타일</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topStylesBar} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              <Bar dataKey="수량" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 table */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">📋 불량 TOP 10 스타일 상세</h3>
          <DataTable
            columns={[
              { key: "prdt_cd", label: "스타일코드", align: "left" as const },
              { key: "prdt_nm", label: "스타일명", align: "left" as const },
              { key: "item_group", label: "복종", align: "left" as const },
              { key: "supplier", label: "협력사", align: "left" as const },
              { key: "qty", label: "불량수량", align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
              { key: "defects", label: "불량유형", align: "left" as const },
            ]}
            data={topStyles}
            compact
          />
        </div>
      </div>
    </div>
  );
}
