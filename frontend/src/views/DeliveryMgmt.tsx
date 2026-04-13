"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound } from "@/lib/api";
import { formatNumber, calcYoY, formatDelta } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  brand: string;
  season: string;
}

export default function DeliveryMgmt({ brand, season }: Props) {
  const [data, setData] = useState<OrderInbound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getOrderInbound(brand, season).then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season]);

  // 납기 KPI 계산
  const kpis = useMemo(() => {
    if (!data.length) return [];

    const today = new Date();
    const total = data.length;

    // 입고 완료 건
    const delivered = data.filter((r) => (r.STOR_QTY || 0) > 0);
    const deliveredCount = delivered.length;
    const otdRate = total > 0 ? (deliveredCount / total) * 100 : 0;

    // 미입고 건
    const pending = data.filter((r) => (r.STOR_QTY || 0) === 0);
    const pendingCount = pending.length;

    // D-7 긴급 (납기일 7일 이내)
    const urgent = pending.filter((r) => {
      if (!r.STOR_SCHD_DT) return false;
      const schd = new Date(r.STOR_SCHD_DT);
      const diff = (schd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });

    // 납기 지연 (납기일 경과)
    const delayed = pending.filter((r) => {
      if (!r.STOR_SCHD_DT) return false;
      const schd = new Date(r.STOR_SCHD_DT);
      return schd < today;
    });

    // 협력사별 집계
    const supplierMap = new Map<string, { total: number; delivered: number }>();
    data.forEach((r) => {
      const sup = r.MFAC_COMPY_NM || "미상";
      const cur = supplierMap.get(sup) || { total: 0, delivered: 0 };
      cur.total += 1;
      if ((r.STOR_QTY || 0) > 0) cur.delivered += 1;
      supplierMap.set(sup, cur);
    });
    const supplierCount = supplierMap.size;

    return [
      {
        label: "납기준수율",
        value: otdRate.toFixed(1),
        unit: "%",
        icon: "⏱️",
        delta: 0,
        prevValue: `${deliveredCount.toLocaleString()} / ${total.toLocaleString()} SKU`,
        accent: otdRate >= 90 ? "#059669" : otdRate >= 70 ? "#d97706" : "#ef4444",
        sub: { label: "입고완료", value: otdRate.toFixed(1), detail: `${deliveredCount} / ${total} SKU 입고 완료` },
      },
      {
        label: "미입고",
        value: pendingCount.toLocaleString(),
        unit: "SKU",
        icon: "📋",
        delta: 0,
        prevValue: `전체 ${total.toLocaleString()} SKU 중`,
        accent: "#6366f1",
      },
      {
        label: "D-7 긴급",
        value: urgent.length.toLocaleString(),
        unit: "건",
        icon: "🔥",
        delta: 0,
        prevValue: "7일 이내 납기 도래",
        accent: "#f59e0b",
      },
      {
        label: "납기 지연",
        value: delayed.length.toLocaleString(),
        unit: "건",
        icon: "🚨",
        delta: 0,
        prevValue: "납기일 경과 미입고",
        accent: "#ef4444",
      },
      {
        label: "협력사수",
        value: supplierCount.toLocaleString(),
        unit: "개",
        icon: "🏭",
        delta: 0,
        prevValue: `활성 협력사`,
        accent: "#0891b2",
      },
    ];
  }, [data]);

  // 협력사별 이행률 (차트용)
  const supplierChart = useMemo(() => {
    if (!data.length) return [];
    const map = new Map<string, { total: number; delivered: number }>();
    data.forEach((r) => {
      const sup = r.MFAC_COMPY_NM || "미상";
      const cur = map.get(sup) || { total: 0, delivered: 0 };
      cur.total += 1;
      if ((r.STOR_QTY || 0) > 0) cur.delivered += 1;
      map.set(sup, cur);
    });

    return [...map.entries()]
      .map(([name, v]) => ({
        name: name.length > 10 ? name.slice(0, 10) + "…" : name,
        이행률: v.total > 0 ? Math.round((v.delivered / v.total) * 100) : 0,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [data]);

  // 미입고 테이블
  const pendingTable = useMemo(() => {
    if (!data.length) return [];
    const today = new Date();
    return data
      .filter((r) => (r.STOR_QTY || 0) === 0)
      .map((r) => {
        const schd = r.STOR_SCHD_DT ? new Date(r.STOR_SCHD_DT) : null;
        const dDay = schd ? Math.ceil((schd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          prdt_cd: r.PRDT_CD,
          prdt_nm: r.PRDT_NM || "-",
          item_group: r.ITEM_GROUP || "-",
          supplier: r.MFAC_COMPY_NM || "-",
          country: r.PO_CNTRY_NM || "-",
          schd_dt: r.STOR_SCHD_DT || "-",
          ord_qty: r.ORD_QTY || 0,
          d_day: dDay,
          _urgent: dDay !== null && dDay <= 7,
          _delayed: dDay !== null && dDay < 0,
        };
      })
      .sort((a, b) => (a.d_day ?? 999) - (b.d_day ?? 999))
      .slice(0, 50);
  }, [data]);

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

  const tableColumns = [
    { key: "prdt_cd", label: "스타일코드", align: "left" as const },
    { key: "prdt_nm", label: "스타일명", align: "left" as const },
    { key: "item_group", label: "복종", align: "left" as const },
    { key: "supplier", label: "협력사", align: "left" as const },
    { key: "country", label: "생산국", align: "left" as const },
    { key: "schd_dt", label: "납기일", align: "center" as const },
    { key: "ord_qty", label: "발주수량", align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
    {
      key: "d_day",
      label: "D-Day",
      align: "center" as const,
      format: (v: unknown) => {
        const n = Number(v);
        if (isNaN(n)) return "-";
        return n < 0 ? `D${n}` : n === 0 ? "D-Day" : `D-${n}`;
      },
      colorCode: (v: unknown) => {
        const n = Number(v);
        if (isNaN(n)) return undefined;
        if (n < 0) return "#fef2f2";
        if (n <= 7) return "#fffbeb";
        return undefined;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">납기 관리</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* 협력사별 이행률 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-5">🏭 협력사별 납기이행률</h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={supplierChart} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" domain={[0, 105]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }}
              formatter={(value) => [`${value}%`, "이행률"]}
            />
            <Bar dataKey="이행률" radius={[0, 6, 6, 0]}>
              {supplierChart.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.이행률 >= 90 ? "#10b981" : entry.이행률 >= 70 ? "#f59e0b" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 미입고 테이블 */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 미입고 현황 (TOP 50)</h3>
        <DataTable columns={tableColumns} data={pendingTable} compact />
      </div>
    </div>
  );
}
