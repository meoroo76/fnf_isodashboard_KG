"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, SeasonSale } from "@/lib/api";
import { formatNumber, calcYoY, formatDelta } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";

interface Props {
  brand: string;
  season: string;
}

interface KpiData {
  label: string;
  value: string;
  unit: string;
  icon: string;
  delta: number;
  prevValue: string;
  accent: string;
  sparkData?: number[];
}

export default function OrderDashboard({ brand, season }: Props) {
  const [currData, setCurrData] = useState<OrderInbound[]>([]);
  const [prevData, setPrevData] = useState<OrderInbound[]>([]);
  const [seasonSale, setSeasonSale] = useState<SeasonSale>({});
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const year = parseInt(season.slice(0, 2));
    const suffix = season.slice(2);
    return `${(year - 1).toString().padStart(2, "0")}${suffix}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrderInbound(brand, season),
      api.getOrderInbound(brand, prevSeason),
      api.getSeasonSale(brand),
    ]).then(([curr, prev, sale]) => {
      setCurrData(curr.data);
      setPrevData(prev.data);
      setSeasonSale(sale.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  // KPI 계산
  const kpis: KpiData[] = useMemo(() => {
    if (!currData.length) return [];

    const currOrdAmt = currData.reduce((s, r) => s + (r.ORD_TAG_AMT || 0), 0);
    const prevOrdAmt = prevData.reduce((s, r) => s + (r.ORD_TAG_AMT || 0), 0);
    const currStyles = new Set(currData.map((r) => r.PRDT_CD)).size;
    const prevStyles = new Set(prevData.map((r) => r.PRDT_CD)).size;
    const currOrdQty = currData.reduce((s, r) => s + (r.ORD_QTY || 0), 0);
    const prevOrdQty = prevData.reduce((s, r) => s + (r.ORD_QTY || 0), 0);
    const currStorQty = currData.reduce((s, r) => s + (r.STOR_QTY || 0), 0);
    const prevStorQty = prevData.reduce((s, r) => s + (r.STOR_QTY || 0), 0);
    const storRate = currOrdQty > 0 ? (currStorQty / currOrdQty) * 100 : 0;
    const prevStorRate = prevOrdQty > 0 ? (prevStorQty / prevOrdQty) * 100 : 0;
    const currStorAmt = currData.reduce((s, r) => s + (r.STOR_TAG_AMT || 0), 0);
    const prevStorAmt = prevData.reduce((s, r) => s + (r.STOR_TAG_AMT || 0), 0);

    return [
      {
        label: "발주액",
        value: formatNumber(currOrdAmt, "백만"),
        unit: "백만",
        icon: "📦",
        delta: calcYoY(currOrdAmt, prevOrdAmt),
        prevValue: `전년 ${formatNumber(prevOrdAmt, "백만")}`,
        accent: "#4f46e5",
      },
      {
        label: "발주수량",
        value: currOrdQty.toLocaleString(),
        unit: "수량",
        icon: "📊",
        delta: calcYoY(currOrdQty, prevOrdQty),
        prevValue: `전년 ${prevOrdQty.toLocaleString()}`,
        accent: "#7c3aed",
      },
      {
        label: "스타일수",
        value: currStyles.toLocaleString(),
        unit: "건",
        icon: "👗",
        delta: calcYoY(currStyles, prevStyles),
        prevValue: `전년 ${prevStyles}`,
        accent: "#2563eb",
      },
      {
        label: "입고율",
        value: storRate.toFixed(1),
        unit: "%",
        icon: "🚢",
        delta: storRate - prevStorRate,
        prevValue: `전년 ${prevStorRate.toFixed(1)}%`,
        accent: "#059669",
      },
      {
        label: "입고액",
        value: formatNumber(currStorAmt, "백만"),
        unit: "백만",
        icon: "📥",
        delta: calcYoY(currStorAmt, prevStorAmt),
        prevValue: `전년 ${formatNumber(prevStorAmt, "백만")}`,
        accent: "#0891b2",
      },
    ];
  }, [currData, prevData]);

  // 카테고리별 집계 (테이블용)
  const categoryData = useMemo(() => {
    if (!currData.length) return [];

    const aggregate = (data: OrderInbound[]) => {
      const map = new Map<string, { ordQty: number; ordAmt: number; storQty: number; storAmt: number; styles: Set<string> }>();
      data.forEach((r) => {
        const cat = r.ITEM_GROUP || "기타";
        const cur = map.get(cat) || { ordQty: 0, ordAmt: 0, storQty: 0, storAmt: 0, styles: new Set<string>() };
        cur.ordQty += r.ORD_QTY || 0;
        cur.ordAmt += r.ORD_TAG_AMT || 0;
        cur.storQty += r.STOR_QTY || 0;
        cur.storAmt += r.STOR_TAG_AMT || 0;
        cur.styles.add(r.PRDT_CD);
        map.set(cat, cur);
      });
      return map;
    };

    const currAgg = aggregate(currData);
    const prevAgg = aggregate(prevData);
    const allCats = new Set([...currAgg.keys(), ...prevAgg.keys()]);

    const totalCurr = { ordQty: 0, ordAmt: 0, storQty: 0, storAmt: 0, styles: 0 };
    const totalPrev = { ordQty: 0, ordAmt: 0, storQty: 0, storAmt: 0, styles: 0 };

    const rows: Record<string, unknown>[] = [];

    [...allCats].sort().forEach((cat) => {
      const c = currAgg.get(cat);
      const p = prevAgg.get(cat);
      const cOrdQty = c?.ordQty || 0;
      const pOrdQty = p?.ordQty || 0;
      const cOrdAmt = c?.ordAmt || 0;
      const pOrdAmt = p?.ordAmt || 0;
      const cStorQty = c?.storQty || 0;
      const pStorQty = p?.storQty || 0;
      const cStyles = c?.styles.size || 0;
      const pStyles = p?.styles.size || 0;

      totalCurr.ordQty += cOrdQty;
      totalCurr.ordAmt += cOrdAmt;
      totalCurr.storQty += cStorQty;
      totalCurr.styles += cStyles;
      totalPrev.ordQty += pOrdQty;
      totalPrev.ordAmt += pOrdAmt;
      totalPrev.storQty += pStorQty;
      totalPrev.styles += pStyles;

      rows.push({
        category: cat,
        currStyles: cStyles,
        prevStyles: pStyles,
        stylesDelta: cStyles - pStyles,
        currOrdAmt: cOrdAmt,
        prevOrdAmt: pOrdAmt,
        ordAmtGrowth: calcYoY(cOrdAmt, pOrdAmt),
        currStorQty: cStorQty,
        prevStorQty: pStorQty,
        storQtyGrowth: calcYoY(cStorQty, pStorQty),
        storRate: cOrdQty > 0 ? (cStorQty / cOrdQty) * 100 : 0,
      });
    });

    // Total row at top
    rows.unshift({
      category: "Total",
      currStyles: totalCurr.styles,
      prevStyles: totalPrev.styles,
      stylesDelta: totalCurr.styles - totalPrev.styles,
      currOrdAmt: totalCurr.ordAmt,
      prevOrdAmt: totalPrev.ordAmt,
      ordAmtGrowth: calcYoY(totalCurr.ordAmt, totalPrev.ordAmt),
      currStorQty: totalCurr.storQty,
      prevStorQty: totalPrev.storQty,
      storQtyGrowth: calcYoY(totalCurr.storQty, totalPrev.storQty),
      storRate: totalCurr.ordQty > 0 ? (totalCurr.storQty / totalCurr.ordQty) * 100 : 0,
      _isTotal: true,
    });

    return rows;
  }, [currData, prevData]);

  // 입고 추이 차트 (주차별)
  const weeklyTrend = useMemo(() => {
    if (!currData.length) return [];

    const weekMap = new Map<string, { curr: number; prev: number }>();

    const addToWeek = (data: OrderInbound[], key: "curr" | "prev") => {
      data.forEach((r) => {
        const dt = r.STOR_DT;
        if (!dt) return;
        const d = new Date(dt);
        const weekNum = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
        const wk = `${weekNum}w`;
        const cur = weekMap.get(wk) || { curr: 0, prev: 0 };
        cur[key] += r.STOR_QTY || 0;
        weekMap.set(wk, cur);
      });
    };

    addToWeek(currData, "curr");
    addToWeek(prevData, "prev");

    return [...weekMap.entries()]
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([week, vals]) => ({
        week,
        당해: vals.curr,
        전년: vals.prev,
      }));
  }, [currData, prevData]);

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

  const growthColor = (val: unknown) => {
    const n = Number(val);
    if (n > 10) return "#f0fdf4";
    if (n > 0) return "#fefce8";
    if (n < -10) return "#fef2f2";
    if (n < 0) return "#fff7ed";
    return undefined;
  };

  const tableColumns = [
    { key: "category", label: "카테고리", align: "left" as const },
    { key: "currStyles", label: season, align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
    { key: "prevStyles", label: prevSeason, align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
    {
      key: "stylesDelta",
      label: "증감",
      align: "right" as const,
      format: (v: unknown) => { const n = Number(v); return n > 0 ? `+${n}` : String(n); },
      colorCode: (v: unknown) => growthColor(v),
    },
    { key: "currOrdAmt", label: season, align: "right" as const, format: (v: unknown) => formatNumber(Number(v), "백만") },
    { key: "prevOrdAmt", label: prevSeason, align: "right" as const, format: (v: unknown) => formatNumber(Number(v), "백만") },
    {
      key: "ordAmtGrowth",
      label: "성장률",
      align: "right" as const,
      format: (v: unknown) => formatDelta(Number(v)),
      colorCode: (v: unknown) => growthColor(v),
    },
    { key: "currStorQty", label: season, align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
    { key: "prevStorQty", label: prevSeason, align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
    {
      key: "storQtyGrowth",
      label: "성장률",
      align: "right" as const,
      format: (v: unknown) => formatDelta(Number(v)),
      colorCode: (v: unknown) => growthColor(v),
    },
    {
      key: "storRate",
      label: "입고율",
      align: "right" as const,
      format: (v: unknown) => `${Number(v).toFixed(1)}%`,
      colorCode: (v: unknown) => {
        const n = Number(v);
        if (n >= 90) return "#f0fdf4";
        if (n >= 70) return "#fefce8";
        return "#fef2f2";
      },
    },
  ];

  const columnGroups = [
    { label: "카테고리", colSpan: 1 },
    { label: "스타일수", colSpan: 3, color: "#f0f9ff" },
    { label: "발주금액 (백만)", colSpan: 3, color: "#faf5ff" },
    { label: "입고수량", colSpan: 3, color: "#f0fdf4" },
    { label: "", colSpan: 1, color: "#fffbeb" },
  ];

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">오더 현황</h2>
        <span className="text-sm text-slate-400">
          {season} vs {prevSeason} 비교
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            icon={kpi.icon}
            delta={kpi.delta}
            prevValue={kpi.prevValue}
            accent={kpi.accent}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* 입고 추이 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">📈 주차별 입고 추이</h3>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-indigo-500 rounded" /> {season}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-slate-300 rounded" /> {prevSeason}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyTrend}>
              <defs>
                <linearGradient id="gradCurr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
              />
              <Area type="monotone" dataKey="전년" stroke="#cbd5e1" strokeWidth={2} fill="transparent" strokeDasharray="4 4" dot={false} />
              <Area type="monotone" dataKey="당해" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gradCurr)" dot={{ fill: "#4f46e5", r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 카테고리별 발주 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">📊 카테고리별 발주 비교</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData.filter((r) => !r._isTotal)} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={60}
                tickFormatter={(v: number) => formatNumber(v, "백만")} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#e2e8f0",
                }}
                formatter={(value) => [formatNumber(Number(value), "백만") + " 백만", ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="prevOrdAmt" name={prevSeason} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="currOrdAmt" name={season} fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 카테고리별 상세</h3>
        <DataTable
          columns={tableColumns}
          data={categoryData}
          columnGroups={columnGroups}
          compact
          rowClassFn={(row) => (row._isTotal ? "font-bold bg-slate-50/80" : "")}
        />
      </div>
    </div>
  );
}
