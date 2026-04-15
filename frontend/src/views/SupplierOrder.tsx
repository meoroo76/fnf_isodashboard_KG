"use client";

import { useEffect, useState, useMemo } from "react";

interface Props {
  brand: string;
  season: string;
}

interface CategoryRow {
  SESN: string;
  GENDER: string;
  CATEGORY: string;
  STYLE_CNT: number;
  STOR_STYLE_CNT: number;
  SKU_CNT: number;
  STOR_SKU_CNT: number;
  ORD_QTY: number;
  STOR_QTY: number;
  ORD_AMT: number;
  STOR_AMT: number;
}

interface Metrics {
  styles: number;
  storStyles: number;
  skus: number;
  storSkus: number;
  ordQty: number;
  storQty: number;
  ordAmt: number;
  storAmt: number;
}

interface DisplayRow {
  label: string;
  indent: number;
  bold: boolean;
  color?: string;
  prev: Metrics;
  curr: Metrics;
}

// stylemaster CSV 기준 카테고리
const RTW_CATS = ["down", "outer", "top", "bottom"];
const ACC_CATS = ["acc"];
const ETC_CATS = ["etc"];

function fmtGrowth(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "+999%" : "+0%";
  const v = ((curr - prev) / Math.abs(prev)) * 100;
  return v >= 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`;
}

function fmtDelta(curr: number, prev: number): string {
  const d = curr - prev;
  return d >= 0 ? `+${d}` : `${d}`;
}

function fmtRate(num: number, den: number): string {
  if (den === 0) return "0%";
  return `${((num / den) * 100).toFixed(0)}%`;
}

function fmtAmt(v: number): string {
  return (v / 1e8).toFixed(1);
}

function colorVal(curr: number, prev: number): string {
  if (curr > prev) return "#10b981";
  if (curr < prev) return "#ef4444";
  return "#64748b";
}

export default function SupplierOrder({ brand, season }: Props) {
  const [rawData, setRawData] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    const brandName = brand === "V" ? "duvetica" : "sergio";
    fetch(`/data/${brandName}_category_summary.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CategoryRow[]) => {
        setRawData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brand]);

  const displayRows = useMemo((): DisplayRow[] => {
    if (!rawData.length) return [];

    const agg = (sesn: string, gender?: string, cats?: string[]): Metrics => {
      const f = rawData.filter((r) => {
        if (r.SESN !== sesn) return false;
        if (gender && r.GENDER !== gender) return false;
        if (cats && !cats.includes(r.CATEGORY)) return false;
        return true;
      });
      return {
        styles: f.reduce((s, r) => s + r.STYLE_CNT, 0),
        storStyles: f.reduce((s, r) => s + r.STOR_STYLE_CNT, 0),
        skus: f.reduce((s, r) => s + r.SKU_CNT, 0),
        storSkus: f.reduce((s, r) => s + r.STOR_SKU_CNT, 0),
        ordQty: f.reduce((s, r) => s + r.ORD_QTY, 0),
        storQty: f.reduce((s, r) => s + r.STOR_QTY, 0),
        ordAmt: f.reduce((s, r) => s + Number(r.ORD_AMT || 0), 0),
        storAmt: f.reduce((s, r) => s + Number(r.STOR_AMT || 0), 0),
      };
    };

    const mkRow = (label: string, indent: number, bold: boolean, color: string | undefined, cats?: string[], gender?: string): DisplayRow => ({
      label,
      indent,
      bold,
      color,
      prev: agg(prevSeason, gender, cats),
      curr: agg(season, gender, cats),
    });

    const addGenderBlock = (rows: DisplayRow[], label: string, gender: string) => {
      rows.push(mkRow(label, 1, true, undefined, RTW_CATS, gender));
      for (const cat of RTW_CATS) {
        const p = agg(prevSeason, gender, [cat]);
        const c = agg(season, gender, [cat]);
        if (p.styles > 0 || c.styles > 0) {
          const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
          rows.push({ label: catLabel, indent: 2, bold: false, prev: p, curr: c });
        }
      }
    };

    const rows: DisplayRow[] = [];
    rows.push(mkRow("Total", 0, true, undefined));
    rows.push(mkRow("RTW (의류)", 0, true, "#ef4444", RTW_CATS));

    addGenderBlock(rows, "Women", "women");
    addGenderBlock(rows, "Men", "men");

    rows.push(mkRow("Acc", 0, true, undefined, ACC_CATS));

    return rows;
  }, [rawData, season, prevSeason]);

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

  // 셀 스타일
  const numCell = "px-2 py-2 text-right font-mono tabular-nums text-[11px]";
  const borderR = " border-r border-slate-200";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">카테고리별 상세</h2>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse whitespace-nowrap">
            <thead>
              {/* 그룹 헤더 */}
              <tr className="bg-slate-100 border-b border-slate-200">
                <th rowSpan={2} className="px-4 py-2.5 text-left font-bold text-slate-600 text-[10px] border-r border-slate-200 min-w-[110px] sticky left-0 bg-slate-100 z-20">카테고리</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-blue-700 border-r border-slate-200 bg-blue-50/50">스타일수</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-violet-700 border-r border-slate-200 bg-violet-50/50">SKU수</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-emerald-700 border-r border-slate-200 bg-emerald-50/50">수량 (PCS)</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-amber-700 bg-amber-50/50">금액 (억원)</th>
              </tr>
              {/* 서브 헤더 */}
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500">
                <th className="px-2 py-1.5 text-center font-semibold bg-blue-50/30">{season}발주</th>
                <th className="px-2 py-1.5 text-center font-semibold">{season}입고</th>
                <th className="px-2 py-1.5 text-center font-semibold">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center font-semibold">증감</th>
                <th className={`px-2 py-1.5 text-center font-semibold${borderR}`}>입고율</th>

                <th className="px-2 py-1.5 text-center font-semibold bg-violet-50/30">{season}발주</th>
                <th className="px-2 py-1.5 text-center font-semibold">{season}입고</th>
                <th className="px-2 py-1.5 text-center font-semibold">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center font-semibold">증감</th>
                <th className={`px-2 py-1.5 text-center font-semibold${borderR}`}>입고율</th>

                <th className="px-2 py-1.5 text-center font-semibold bg-emerald-50/30">{season}발주</th>
                <th className="px-2 py-1.5 text-center font-semibold">{season}입고</th>
                <th className="px-2 py-1.5 text-center font-semibold">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center font-semibold">성장률</th>
                <th className={`px-2 py-1.5 text-center font-semibold${borderR}`}>입고율</th>

                <th className="px-2 py-1.5 text-center font-semibold bg-amber-50/30">{season}발주</th>
                <th className="px-2 py-1.5 text-center font-semibold">{season}입고</th>
                <th className="px-2 py-1.5 text-center font-semibold">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center font-semibold">성장률</th>
                <th className="px-2 py-1.5 text-center font-semibold">입고율</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const c = row.curr;
                const p = row.prev;
                const bgClass = row.bold ? "bg-slate-50/80" : "";

                return (
                  <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50/50 ${bgClass}`}>
                    {/* 카테고리 */}
                    <td
                      className={`px-4 py-2 border-r border-slate-200 sticky left-0 z-10 ${bgClass || "bg-white"} ${row.bold ? "font-bold" : ""}`}
                      style={{ paddingLeft: `${16 + row.indent * 16}px`, color: row.color || (row.bold ? "#1e293b" : "#475569") }}
                    >
                      {row.label}
                    </td>

                    {/* 스타일수: 26S발주 | 26S입고 | 25S | 증감 | 입고율 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.styles}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storStyles}</td>
                    <td className={`${numCell} text-slate-500`}>{p.styles}</td>
                    <td className={numCell} style={{ color: colorVal(c.styles, p.styles) }}>{fmtDelta(c.styles, p.styles)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storStyles < c.styles ? "#ef4444" : "#10b981" }}>
                      {fmtRate(c.storStyles, c.styles)}
                    </td>

                    {/* SKU수: 26S발주 | 26S입고 | 25S | 증감 | 입고율 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.skus.toLocaleString()}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storSkus.toLocaleString()}</td>
                    <td className={`${numCell} text-slate-500`}>{p.skus.toLocaleString()}</td>
                    <td className={numCell} style={{ color: colorVal(c.skus, p.skus) }}>{fmtDelta(c.skus, p.skus)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storSkus < c.skus ? "#ef4444" : "#10b981" }}>
                      {fmtRate(c.storSkus, c.skus)}
                    </td>

                    {/* 수량(PCS): 26S발주 | 26S입고 | 25S | 성장률 | 입고율 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.ordQty.toLocaleString()}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storQty.toLocaleString()}</td>
                    <td className={`${numCell} text-slate-500`}>{p.ordQty.toLocaleString()}</td>
                    <td className={numCell} style={{ color: colorVal(c.ordQty, p.ordQty) }}>{fmtGrowth(c.ordQty, p.ordQty)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storQty < c.ordQty * 0.95 ? "#ef4444" : "#10b981" }}>
                      {fmtRate(c.storQty, c.ordQty)}
                    </td>

                    {/* 금액(억원): 26S발주 | 26S입고 | 25S | 성장률 | 입고율 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{fmtAmt(c.ordAmt)}</td>
                    <td className={`${numCell} text-emerald-600`}>{fmtAmt(c.storAmt)}</td>
                    <td className={`${numCell} text-slate-500`}>{fmtAmt(p.ordAmt)}</td>
                    <td className={numCell} style={{ color: colorVal(c.ordAmt, p.ordAmt) }}>{fmtGrowth(c.ordAmt, p.ordAmt)}</td>
                    <td className={numCell} style={{ color: c.storAmt < c.ordAmt * 0.95 ? "#ef4444" : "#10b981" }}>
                      {fmtRate(c.storAmt, c.ordAmt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
