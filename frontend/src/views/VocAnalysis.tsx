"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface Props { brand: string; season: string; }

interface VocRow {
  BRD_CD?: string;
  SESN?: string;
  VOC_TYPE_NM?: string;
  VOC_CONTS?: string;
  SHOP_NM?: string;
  PRDT_CD?: string;
  PRDT_NM?: string;
  REG_DT?: string;
  [key: string]: unknown;
}

const VOC_COLORS: Record<string, string> = {
  "품질": "#ef4444", "배송": "#3b82f6", "교환/반품": "#f59e0b",
  "사이즈": "#8b5cf6", "기타": "#6b7280", "서비스": "#10b981",
  "가격": "#d97706",
};
const PALETTE = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#0891b2", "#d97706", "#6b7280"];

// Simple Korean keyword extraction: split by common delimiters, filter noise
const STOP_WORDS = new Set([
  "이", "그", "저", "것", "수", "등", "및", "를", "을", "에", "의", "가", "는", "은",
  "로", "으로", "에서", "와", "과", "도", "만", "좀", "잘", "더", "또", "너무", "매우",
  "하다", "있다", "없다", "되다", "하고", "해서", "했는데", "합니다", "했습니다", "입니다",
  "다", "요", "네", "데", "거", "게", "듯", "때문", "대한", "위해", "통해", "때",
  "the", "a", "an", "is", "are", "was", "were", "and", "or", "but", "in", "on", "at", "to", "for",
]);

function extractKeywords(texts: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  texts.forEach((text) => {
    const words = text
      .replace(/[^\w가-힣\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  });
  return freq;
}

export default function VocAnalysis({ brand, season }: Props) {
  const [vocData, setVocData] = useState<VocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getVoc(brand).then((res) => {
      setVocData(res.data as VocRow[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand]);

  const currVoc = useMemo(() => vocData.filter((v) => v.SESN === season), [vocData, season]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalCount = currVoc.length;
    const types = new Set(currVoc.map((v) => v.VOC_TYPE_NM)).size;
    const shops = new Set(currVoc.map((v) => v.SHOP_NM).filter(Boolean)).size;
    const styles = new Set(currVoc.map((v) => v.PRDT_CD).filter(Boolean)).size;

    return [
      {
        label: "VOC 총건수",
        value: totalCount.toLocaleString(),
        unit: "건",
        icon: "📝",
        delta: 0,
        prevValue: `${season} 시즌`,
        accent: "#4f46e5",
      },
      {
        label: "VOC 유형수",
        value: String(types),
        unit: "종",
        icon: "🏷️",
        delta: 0,
        prevValue: "품질/배송/교환 등",
        accent: "#7c3aed",
      },
      {
        label: "관련 매장",
        value: shops.toLocaleString(),
        unit: "개",
        icon: "🏪",
        delta: 0,
        prevValue: "VOC 접수 매장",
        accent: "#2563eb",
      },
      {
        label: "관련 스타일",
        value: styles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: 0,
        prevValue: "VOC 언급 스타일",
        accent: "#059669",
      },
    ];
  }, [currVoc, season]);

  /* ── VOC type distribution (pie) ── */
  const typeDist = useMemo(() => {
    const map = new Map<string, number>();
    currVoc.forEach((v) => {
      const type = String(v.VOC_TYPE_NM || "기타");
      map.set(type, (map.get(type) || 0) + 1);
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [currVoc]);

  /* ── Keyword extraction ── */
  const keywordData = useMemo(() => {
    const texts = currVoc
      .map((v) => String(v.VOC_CONTS || ""))
      .filter((t) => t.length > 0);
    const freq = extractKeywords(texts);
    return [...freq.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [currVoc]);

  /* ── Shop-level VOC table ── */
  const shopTable = useMemo(() => {
    const map = new Map<string, { count: number; types: Set<string> }>();
    currVoc.forEach((v) => {
      const shop = String(v.SHOP_NM || "미상");
      const cur = map.get(shop) || { count: 0, types: new Set<string>() };
      cur.count += 1;
      if (v.VOC_TYPE_NM) cur.types.add(String(v.VOC_TYPE_NM));
      map.set(shop, cur);
    });
    return [...map.entries()]
      .map(([shop, v]) => ({
        shop,
        count: v.count,
        types: [...v.types].join(", "),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [currVoc]);

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
        <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-bold text-slate-800">VOC 분석</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* VOC type pie chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🏷️ VOC 유형별 분포</h3>
          <div className="flex items-center gap-6">
            <div className="w-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeDist} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                    {typeDist.map((e, i) => <Cell key={i} fill={VOC_COLORS[e.name] || PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {typeDist.slice(0, 7).map((item, i) => {
                const total = typeDist.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: VOC_COLORS[item.name] || PALETTE[i % PALETTE.length] }} />
                    <span className="text-xs text-slate-600 w-20 truncate">{item.name}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: VOC_COLORS[item.name] || PALETTE[i % PALETTE.length] }} />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-12 text-right">{item.value}건</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Keyword frequency bar chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">🔑 VOC 키워드 빈도 (TOP 20)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={keywordData} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="word" width={80} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} name="빈도" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shop-level VOC table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 매장별 VOC 현황 (TOP 20)</h3>
        <DataTable
          columns={[
            { key: "shop", label: "매장", align: "left" as const },
            { key: "count", label: "VOC 건수", align: "right" as const, format: (v: unknown) => Number(v).toLocaleString() },
            { key: "types", label: "VOC 유형", align: "left" as const },
          ]}
          data={shopTable}
          compact
        />
      </div>
    </div>
  );
}
