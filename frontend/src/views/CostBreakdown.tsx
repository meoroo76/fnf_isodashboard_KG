"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { calcYoY } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Treemap,
} from "recharts";

interface Props { brand: string; season: string; }

const ACCOUNT_COLORS: Record<string, string> = {
  "원부자재": "#3b82f6",
  "아트웍": "#8b5cf6",
  "공임": "#f59e0b",
  "경비": "#6b7280",
  "부자재": "#10b981",
  "기타": "#94a3b8",
};
const PALETTE = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6b7280", "#0891b2", "#d97706"];

interface AccountRow {
  MFAC_COST_ACCOUNT_TYPE1_NM?: string;
  MFAC_COST_ACCOUNT_TYPE2_NM?: string;
  MFAC_COST_COST_AMT?: number;
  PRDT_CD?: string;
  PRDT_NM?: string;
  ITEM_GROUP?: string;
  [key: string]: unknown;
}

export default function CostBreakdown({ brand, season }: Props) {
  const [currAccount, setCurrAccount] = useState<AccountRow[]>([]);
  const [prevAccount, setPrevAccount] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getCostAccount(brand, season),
      api.getCostAccount(brand, prevSeason),
    ]).then(([curr, prev]) => {
      setCurrAccount(curr.data as AccountRow[]);
      setPrevAccount(prev.data as AccountRow[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  /* ── KPI ── */
  const kpis = useMemo(() => {
    if (!currAccount.length) return [];

    const totalAmt = (d: AccountRow[]) => d.reduce((s, r) => s + (r.MFAC_COST_COST_AMT || 0), 0);
    const uniqueTypes = (d: AccountRow[]) => new Set(d.map((r) => r.MFAC_COST_ACCOUNT_TYPE1_NM)).size;
    const uniqueStyles = (d: AccountRow[]) => new Set(d.map((r) => r.PRDT_CD)).size;

    const cTotal = totalAmt(currAccount);
    const pTotal = totalAmt(prevAccount);
    const cTypes = uniqueTypes(currAccount);
    const cStyles = uniqueStyles(currAccount);
    const pStyles = uniqueStyles(prevAccount);
    const avgPerStyle = cStyles > 0 ? cTotal / cStyles : 0;
    const pAvgPerStyle = pStyles > 0 ? pTotal / pStyles : 0;

    return [
      {
        label: "총 원가금액(USD)",
        value: `$${Math.round(cTotal).toLocaleString()}`,
        unit: "",
        icon: "💰",
        delta: calcYoY(cTotal, pTotal),
        prevValue: `전년 $${Math.round(pTotal).toLocaleString()}`,
        accent: "#4f46e5",
      },
      {
        label: "계정유형 수",
        value: String(cTypes),
        unit: "종",
        icon: "📂",
        delta: 0,
        prevValue: "원부자재/아트웍/공임 등",
        accent: "#7c3aed",
      },
      {
        label: "대상 스타일수",
        value: cStyles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: calcYoY(cStyles, pStyles),
        prevValue: `전년 ${pStyles} STY`,
        accent: "#2563eb",
      },
      {
        label: "스타일당 평균원가",
        value: `$${avgPerStyle.toFixed(1)}`,
        unit: "",
        icon: "📐",
        delta: calcYoY(avgPerStyle, pAvgPerStyle),
        prevValue: `전년 $${pAvgPerStyle.toFixed(1)}`,
        accent: "#059669",
      },
    ];
  }, [currAccount, prevAccount]);

  /* ── Treemap data: TYPE1 > TYPE2 ── */
  const treemapData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    currAccount.forEach((r) => {
      const t1 = String(r.MFAC_COST_ACCOUNT_TYPE1_NM || "기타");
      const t2 = String(r.MFAC_COST_ACCOUNT_TYPE2_NM || "기타");
      if (!map.has(t1)) map.set(t1, new Map());
      const sub = map.get(t1)!;
      sub.set(t2, (sub.get(t2) || 0) + (r.MFAC_COST_COST_AMT || 0));
    });

    return [...map.entries()].map(([name, subMap], idx) => ({
      name,
      children: [...subMap.entries()].map(([subName, value]) => ({
        name: subName,
        size: Math.round(value),
      })),
      fill: ACCOUNT_COLORS[name] || PALETTE[idx % PALETTE.length],
    }));
  }, [currAccount]);

  /* ── Bar chart: TYPE1 당해 vs 전년 ── */
  const barData = useMemo(() => {
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    currAccount.forEach((r) => {
      const t = String(r.MFAC_COST_ACCOUNT_TYPE1_NM || "기타");
      currMap.set(t, (currMap.get(t) || 0) + (r.MFAC_COST_COST_AMT || 0));
    });
    prevAccount.forEach((r) => {
      const t = String(r.MFAC_COST_ACCOUNT_TYPE1_NM || "기타");
      prevMap.set(t, (prevMap.get(t) || 0) + (r.MFAC_COST_COST_AMT || 0));
    });
    const allKeys = new Set([...currMap.keys(), ...prevMap.keys()]);
    return [...allKeys].map((name) => ({
      name,
      당해: Math.round(currMap.get(name) || 0),
      전년: Math.round(prevMap.get(name) || 0),
    })).sort((a, b) => b.당해 - a.당해);
  }, [currAccount, prevAccount]);

  /* ── Style-level detail table ── */
  const styleTable = useMemo(() => {
    const map = new Map<string, { prdt_nm: string; item_group: string; totalAmt: number; types: Map<string, number> }>();
    currAccount.forEach((r) => {
      const key = String(r.PRDT_CD || "");
      if (!key) return;
      const cur = map.get(key) || {
        prdt_nm: String(r.PRDT_NM || "-"),
        item_group: String(r.ITEM_GROUP || "-"),
        totalAmt: 0,
        types: new Map<string, number>(),
      };
      const amt = r.MFAC_COST_COST_AMT || 0;
      cur.totalAmt += amt;
      const t1 = String(r.MFAC_COST_ACCOUNT_TYPE1_NM || "기타");
      cur.types.set(t1, (cur.types.get(t1) || 0) + amt);
      map.set(key, cur);
    });
    return [...map.entries()]
      .map(([code, v]) => ({
        prdt_cd: code,
        prdt_nm: v.prdt_nm,
        item_group: v.item_group,
        totalAmt: `$${v.totalAmt.toFixed(1)}`,
        topType: [...v.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
        typeBreakdown: [...v.types.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, a]) => `${t}:$${a.toFixed(1)}`)
          .join(" / "),
      }))
      .sort((a, b) => parseFloat(b.totalAmt.slice(1)) - parseFloat(a.totalAmt.slice(1)))
      .slice(0, 30);
  }, [currAccount]);

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
        <div className="w-1.5 h-7 rounded-full bg-blue-500" />
        <h2 className="text-lg font-bold text-slate-800">원가 계정 분석</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Treemap */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🗂️ 계정유형별 원가 구성 (Treemap)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              content={(props: Record<string, unknown>) => {
                const { x, y, width, height, name, fill } = props as { x: number; y: number; width: number; height: number; name?: string; fill?: string };
                if (width < 40 || height < 20) return <g />;
                return (
                  <g>
                    <rect x={x} y={y} width={width} height={height} fill={fill || "#94a3b8"} rx={4} opacity={0.85} />
                    <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={600}>
                      {String(name || "").length > 8 ? String(name || "").slice(0, 8) + "…" : name}
                    </text>
                  </g>
                );
              }}
            />
          </ResponsiveContainer>
        </div>

        {/* Bar: 당해 vs 전년 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">📊 계정유형별 당해 vs 전년</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
              <Bar dataKey="당해" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="전년" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Style-level table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 스타일별 원가 상세 (TOP 30)</h3>
        <DataTable
          columns={[
            { key: "prdt_cd", label: "스타일코드", align: "left" as const },
            { key: "prdt_nm", label: "스타일명", align: "left" as const },
            { key: "item_group", label: "복종", align: "left" as const },
            { key: "totalAmt", label: "총원가(USD)", align: "right" as const },
            { key: "topType", label: "최대 계정", align: "left" as const },
            { key: "typeBreakdown", label: "계정별 내역", align: "left" as const },
          ]}
          data={styleTable}
          compact
        />
      </div>
    </div>
  );
}
