"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, Claim } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props { brand: string; season: string; }

interface SupplierScore {
  name: string;
  deliveryRate: number;
  claimRate: number;
  compositeScore: number;
  grade: string;
  orderCount: number;
  claimQty: number;
}

function calcGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#eab308", C: "#f97316", D: "#ef4444",
};

export default function SupplierRanking({ brand, season }: Props) {
  const [orders, setOrders] = useState<OrderInbound[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrderInbound(brand, season),
      api.getClaims(brand),
    ]).then(([ord, clm]) => {
      setOrders(ord.data);
      setClaims(clm.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season]);

  const currClaims = useMemo(() => claims.filter((c) => c.SESN === season), [claims, season]);

  const scores = useMemo((): SupplierScore[] => {
    const orderMap = new Map<string, { onTime: number; total: number; storQty: number }>();
    orders.forEach((o) => {
      const sup = o.MFAC_COMPY_NM || "미상";
      const cur = orderMap.get(sup) || { onTime: 0, total: 0, storQty: 0 };
      cur.total += 1;
      cur.storQty += o.STOR_QTY || 0;
      if (o.STOR_DT && o.STOR_SCHD_DT && o.STOR_DT <= o.STOR_SCHD_DT) cur.onTime += 1;
      orderMap.set(sup, cur);
    });

    const claimMap = new Map<string, number>();
    currClaims.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      claimMap.set(sup, (claimMap.get(sup) || 0) + (c.CLAIM_QTY || 0));
    });

    const allSuppliers = new Set([...orderMap.keys(), ...claimMap.keys()]);

    return [...allSuppliers].map((name) => {
      const ord = orderMap.get(name) || { onTime: 0, total: 0, storQty: 0 };
      const clmQty = claimMap.get(name) || 0;
      const deliveryRate = ord.total > 0 ? (ord.onTime / ord.total) * 100 : 0;
      const claimRate = ord.storQty > 0 ? (clmQty / ord.storQty) * 100 : 0;
      const claimScore = Math.max(0, 100 - claimRate * 10);
      const compositeScore = deliveryRate * 0.6 + claimScore * 0.4;
      const grade = calcGrade(compositeScore);

      return { name, deliveryRate, claimRate, compositeScore, grade, orderCount: ord.total, claimQty: clmQty };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [orders, currClaims]);

  const kpis = useMemo(() => {
    const total = scores.length;
    const avgScore = total > 0 ? scores.reduce((s, r) => s + r.compositeScore, 0) / total : 0;
    const gradeA = scores.filter((s) => s.grade === "A").length;
    const gradeD = scores.filter((s) => s.grade === "D").length;

    return [
      { label: "전체 협력사", value: String(total), unit: "개", icon: "🏭", delta: 0, prevValue: "평가 대상", accent: "#4f46e5" },
      { label: "평균 종합점수", value: avgScore.toFixed(1), unit: "점", icon: "⭐", delta: 0, prevValue: "100점 만점", accent: avgScore >= 70 ? "#059669" : "#ef4444" },
      { label: "A등급 협력사", value: String(gradeA), unit: "개", icon: "🏆", delta: 0, prevValue: "80점 이상", accent: "#22c55e" },
      { label: "D등급 협력사", value: String(gradeD), unit: "개", icon: "⚠️", delta: 0, prevValue: "40점 미만", accent: "#ef4444" },
    ];
  }, [scores]);

  // Horizontal bar chart — all suppliers
  const barData = useMemo(() =>
    scores.map((s) => ({
      name: s.name.length > 14 ? s.name.slice(0, 14) + "..." : s.name,
      score: Math.round(s.compositeScore),
      grade: s.grade,
    })),
  [scores]);

  const tableData = useMemo(() =>
    scores.map((s, idx) => ({
      rank: idx + 1,
      name: s.name,
      grade: s.grade,
      compositeScore: s.compositeScore.toFixed(1),
      deliveryRate: `${s.deliveryRate.toFixed(1)}%`,
      claimRate: `${s.claimRate.toFixed(2)}%`,
      orderCount: s.orderCount.toLocaleString(),
      claimQty: s.claimQty.toLocaleString(),
    })),
  [scores]);

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
        <div className="w-1.5 h-7 rounded-full bg-amber-500" />
        <h2 className="text-lg font-bold text-slate-800">협력사 랭킹</h2>
        <span className="text-sm text-slate-400">{season} | 납기 60% + 품질 40%</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Horizontal bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🏆 협력사 종합점수 랭킹</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 28)}>
          <BarChart data={barData} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} formatter={(v) => [`${v}점`, "종합점수"]} />
            <Bar dataKey="score" radius={[0, 6, 6, 0]}>
              {barData.map((entry, idx) => (
                <Cell key={idx} fill={GRADE_COLORS[entry.grade] || "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 justify-center">
          {Object.entries(GRADE_COLORS).map(([grade, color]) => (
            <div key={grade} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              {grade}등급
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 협력사 전체 목록</h3>
        <DataTable
          columns={[
            { key: "rank", label: "#", align: "center" as const, width: "40px" },
            { key: "name", label: "협력사", align: "left" as const },
            { key: "grade", label: "등급", align: "center" as const,
              colorCode: (v: unknown) => GRADE_COLORS[String(v)] ? `${GRADE_COLORS[String(v)]}22` : undefined },
            { key: "compositeScore", label: "종합점수", align: "right" as const },
            { key: "deliveryRate", label: "납기준수율", align: "right" as const },
            { key: "claimRate", label: "클레임율", align: "right" as const },
            { key: "orderCount", label: "오더건수", align: "right" as const },
            { key: "claimQty", label: "클레임수량", align: "right" as const },
          ]}
          data={tableData}
          compact
        />
      </div>
    </div>
  );
}
