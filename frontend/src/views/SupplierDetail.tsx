"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, Claim } from "@/lib/api";
import { calcYoY } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface Props { brand: string; season: string; }

const CAT_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0891b2", "#d97706", "#64748b"];

export default function SupplierDetail({ brand, season }: Props) {
  const [orders, setOrders] = useState<OrderInbound[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");

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

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => { if (o.MFAC_COMPY_NM) set.add(o.MFAC_COMPY_NM); });
    return [...set].sort();
  }, [orders]);

  // Auto-select first supplier
  useEffect(() => {
    if (suppliers.length > 0 && !selected) setSelected(suppliers[0]);
  }, [suppliers, selected]);

  const currClaims = useMemo(() => claims.filter((c) => c.SESN === season), [claims, season]);

  const supOrders = useMemo(() => orders.filter((o) => o.MFAC_COMPY_NM === selected), [orders, selected]);
  const supClaims = useMemo(() => currClaims.filter((c) => c.MFAC_COMPY_NM === selected), [currClaims, selected]);

  const kpis = useMemo(() => {
    const ordQty = supOrders.reduce((s, o) => s + (o.ORD_QTY || 0), 0);
    const storQty = supOrders.reduce((s, o) => s + (o.STOR_QTY || 0), 0);
    const onTime = supOrders.filter((o) => o.STOR_DT && o.STOR_SCHD_DT && o.STOR_DT <= o.STOR_SCHD_DT).length;
    const deliveryRate = supOrders.length > 0 ? (onTime / supOrders.length) * 100 : 0;
    const claimQty = supClaims.reduce((s, c) => s + (c.CLAIM_QTY || 0), 0);
    const claimRate = storQty > 0 ? (claimQty / storQty) * 100 : 0;

    return [
      { label: "발주수량", value: ordQty.toLocaleString(), unit: "PCS", icon: "📦", delta: 0, prevValue: `${supOrders.length}건`, accent: "#6366f1" },
      { label: "납기준수율", value: deliveryRate.toFixed(1), unit: "%", icon: "🚚", delta: 0, prevValue: `${onTime}/${supOrders.length} 정시`, accent: deliveryRate >= 80 ? "#059669" : "#ef4444" },
      { label: "클레임수량", value: claimQty.toLocaleString(), unit: "PCS", icon: "⚠️", delta: 0, prevValue: `${supClaims.length}건`, accent: "#f59e0b" },
      { label: "클레임율", value: claimRate.toFixed(2), unit: "%", icon: "📉", delta: 0, prevValue: `입고 대비`, accent: claimRate <= 1 ? "#059669" : "#ef4444" },
    ];
  }, [supOrders, supClaims]);

  // Category breakdown pie
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    supOrders.forEach((o) => {
      const cat = o.ITEM_GROUP || "기타";
      map.set(cat, (map.get(cat) || 0) + (o.ORD_QTY || 0));
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [supOrders]);

  // Delivery trend by month
  const deliveryTrend = useMemo(() => {
    const map = new Map<string, { onTime: number; total: number }>();
    supOrders.forEach((o) => {
      const dt = String(o.STOR_DT || o.INDC_DT_CNFM || "");
      if (!dt) return;
      const month = dt.slice(0, 7);
      const cur = map.get(month) || { onTime: 0, total: 0 };
      cur.total += 1;
      if ((o.STOR_QTY || 0) > 0) cur.onTime += 1;
      map.set(month, cur);
    });
    return [...map.entries()]
      .map(([month, v]) => ({ month, rate: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [supOrders]);

  // Style-level table
  const tableData = useMemo(() =>
    supOrders.slice(0, 50).map((o) => ({
      prdt_cd: o.PRDT_CD.replace(/^[A-Z]\d{2}[A-Z]/, ""),
      prdt_nm: o.PRDT_NM,
      item_group: o.ITEM_GROUP,
      ord_qty: (o.ORD_QTY || 0).toLocaleString(),
      stor_qty: (o.STOR_QTY || 0).toLocaleString(),
      stor_schd: o.STOR_SCHD_DT || "-",
      stor_dt: o.STOR_DT || "-",
    })),
  [supOrders]);

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
        <div className="w-1.5 h-7 rounded-full bg-violet-500" />
        <h2 className="text-lg font-bold text-slate-800">협력사 상세 분석</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      {/* Supplier selector */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-3">협력사 선택</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="ml-3 text-xs text-slate-400">총 {suppliers.length}개 협력사</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Delivery trend */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🚚 월별 납기준수율</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deliveryTrend} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} formatter={(v) => [`${v}%`, "납기준수율"]} />
              <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">📊 카테고리별 발주 비중</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" stroke="none">
                  {catBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {catBreakdown.slice(0, 6).map((item, idx) => {
                const total = catBreakdown.reduce((s, i) => s + i.value, 0);
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
                return (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CAT_COLORS[idx % CAT_COLORS.length] }} />
                    <span className="text-slate-600 flex-1">{item.name}</span>
                    <span className="font-mono text-slate-700">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 스타일별 상세 (최대 50건)</h3>
        <DataTable
          columns={[
            { key: "prdt_cd", label: "스타일코드", align: "left" as const },
            { key: "prdt_nm", label: "스타일명", align: "left" as const },
            { key: "item_group", label: "카테고리", align: "left" as const },
            { key: "ord_qty", label: "발주수량", align: "right" as const },
            { key: "stor_qty", label: "입고수량", align: "right" as const },
            { key: "stor_schd", label: "입고예정일", align: "center" as const },
            { key: "stor_dt", label: "실입고일", align: "center" as const },
          ]}
          data={tableData}
          compact
        />
      </div>
    </div>
  );
}
