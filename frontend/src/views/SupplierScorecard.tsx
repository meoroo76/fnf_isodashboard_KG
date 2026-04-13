"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, CostMaster, Claim } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props { brand: string; season: string; }

interface SupplierScore {
  name: string;
  fulfillmentRate: number;   // 납기준수율 (0~100)
  onTimeCount: number;
  totalOrders: number;
  avgCost: number;           // 평균원가
  claimQty: number;          // 클레임수량
  claimRate: number;         // 클레임율 (0~100)
  compositeScore: number;    // 종합점수 (0~100)
}

function calcComposite(fulfillment: number, claimRate: number): number {
  // 납기준수율 60% + 클레임 역점수 40%
  const claimScore = Math.max(0, 100 - claimRate * 10);
  return fulfillment * 0.6 + claimScore * 0.4;
}

export default function SupplierScorecard({ brand, season }: Props) {
  const [orders, setOrders] = useState<OrderInbound[]>([]);
  const [costs, setCosts] = useState<CostMaster[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrderInbound(brand, season),
      api.getCostMaster(brand, season),
      api.getClaims(brand),
    ]).then(([ord, cost, clm]) => {
      setOrders(ord.data);
      setCosts(cost.data);
      setClaims(clm.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season]);

  const currClaims = useMemo(() => claims.filter((c) => c.SESN === season), [claims, season]);

  /* ── Supplier scores ── */
  const supplierScores = useMemo((): SupplierScore[] => {
    // Order fulfillment by supplier
    const orderMap = new Map<string, { onTime: number; total: number; storQty: number }>();
    orders.forEach((o) => {
      const sup = o.MFAC_COMPY_NM || "미상";
      const cur = orderMap.get(sup) || { onTime: 0, total: 0, storQty: 0 };
      cur.total += 1;
      cur.storQty += o.STOR_QTY || 0;
      if (o.STOR_DT && o.STOR_SCHD_DT && o.STOR_DT <= o.STOR_SCHD_DT) {
        cur.onTime += 1;
      }
      orderMap.set(sup, cur);
    });

    // Average cost by supplier
    const costMap = new Map<string, { sum: number; count: number }>();
    costs.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      const cur = costMap.get(sup) || { sum: 0, count: 0 };
      cur.sum += c.MFAC_COST_MFAC_COST_AMT || 0;
      cur.count += 1;
      costMap.set(sup, cur);
    });

    // Claims by supplier
    const claimMap = new Map<string, number>();
    currClaims.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      claimMap.set(sup, (claimMap.get(sup) || 0) + (c.CLAIM_QTY || 0));
    });

    const allSuppliers = new Set([...orderMap.keys(), ...costMap.keys(), ...claimMap.keys()]);

    return [...allSuppliers].map((name) => {
      const ord = orderMap.get(name) || { onTime: 0, total: 0, storQty: 0 };
      const cst = costMap.get(name) || { sum: 0, count: 0 };
      const clmQty = claimMap.get(name) || 0;

      const fulfillmentRate = ord.total > 0 ? (ord.onTime / ord.total) * 100 : 0;
      const avgCost = cst.count > 0 ? cst.sum / cst.count : 0;
      const claimRate = ord.storQty > 0 ? (clmQty / ord.storQty) * 100 : 0;
      const compositeScore = calcComposite(fulfillmentRate, claimRate);

      return {
        name,
        fulfillmentRate,
        onTimeCount: ord.onTime,
        totalOrders: ord.total,
        avgCost,
        claimQty: clmQty,
        claimRate,
        compositeScore,
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [orders, costs, currClaims]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total = supplierScores.length;
    const avgScore = total > 0 ? supplierScores.reduce((s, r) => s + r.compositeScore, 0) / total : 0;
    const avgFulfillment = total > 0 ? supplierScores.reduce((s, r) => s + r.fulfillmentRate, 0) / total : 0;
    const topSupplier = supplierScores[0];
    const lowPerformers = supplierScores.filter((s) => s.compositeScore < 50).length;

    return [
      {
        label: "평가 협력사 수",
        value: String(total),
        unit: "개",
        icon: "🏭",
        delta: 0,
        prevValue: "종합 평가 대상",
        accent: "#4f46e5",
      },
      {
        label: "평균 종합점수",
        value: avgScore.toFixed(1),
        unit: "점",
        icon: "⭐",
        delta: 0,
        prevValue: "100점 만점",
        accent: avgScore >= 70 ? "#059669" : "#ef4444",
      },
      {
        label: "평균 납기준수율",
        value: avgFulfillment.toFixed(1),
        unit: "%",
        icon: "📦",
        delta: 0,
        prevValue: "전체 협력사 평균",
        accent: "#2563eb",
      },
      {
        label: "TOP 협력사",
        value: topSupplier ? (topSupplier.name.length > 10 ? topSupplier.name.slice(0, 10) + "…" : topSupplier.name) : "-",
        unit: topSupplier ? `${topSupplier.compositeScore.toFixed(0)}점` : "",
        icon: "🏆",
        delta: 0,
        prevValue: "종합점수 1위",
        accent: "#d97706",
      },
    ];
  }, [supplierScores]);

  /* ── Bar chart data (top 15) ── */
  const barData = useMemo(() =>
    supplierScores.slice(0, 15).map((s) => ({
      name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
      종합점수: Math.round(s.compositeScore),
    })),
  [supplierScores]);

  /* ── Table data ── */
  const tableData = useMemo(() =>
    supplierScores.slice(0, 30).map((s, idx) => ({
      rank: idx + 1,
      name: s.name,
      compositeScore: s.compositeScore.toFixed(1),
      fulfillmentRate: `${s.fulfillmentRate.toFixed(1)}%`,
      orders: `${s.onTimeCount}/${s.totalOrders}`,
      avgCost: s.avgCost > 0 ? `$${s.avgCost.toFixed(1)}` : "-",
      claimQty: s.claimQty.toLocaleString(),
      claimRate: `${s.claimRate.toFixed(2)}%`,
    })),
  [supplierScores]);

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
        <h2 className="text-lg font-bold text-slate-800">협력사 성적표</h2>
        <span className="text-sm text-slate-400">{season} | 납기 60% + 품질 40%</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Horizontal bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">🏆 협력사 종합점수 랭킹 (TOP 15)</h3>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={barData} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }}
              formatter={(v) => [`${v}점`, "종합점수"]}
            />
            <Bar
              dataKey="종합점수"
              radius={[0, 6, 6, 0]}
              fill="#f59e0b"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 협력사 상세 평가 (TOP 30)</h3>
        <DataTable
          columns={[
            { key: "rank", label: "#", align: "center" as const, width: "40px" },
            { key: "name", label: "협력사", align: "left" as const },
            { key: "compositeScore", label: "종합점수", align: "right" as const,
              colorCode: (v: unknown) => {
                const n = parseFloat(String(v));
                if (n >= 80) return "#dcfce7";
                if (n >= 60) return "#fef9c3";
                if (n >= 40) return "#fed7aa";
                return "#fecaca";
              },
            },
            { key: "fulfillmentRate", label: "납기준수율", align: "right" as const },
            { key: "orders", label: "납기(정시/전체)", align: "right" as const },
            { key: "avgCost", label: "평균원가(USD)", align: "right" as const },
            { key: "claimQty", label: "클레임수량", align: "right" as const },
            { key: "claimRate", label: "클레임율", align: "right" as const },
          ]}
          data={tableData}
          compact
        />
      </div>
    </div>
  );
}
