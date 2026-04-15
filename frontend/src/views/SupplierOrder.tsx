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
  AC_STOR_AMT: number;
  AC_STOR_QTY: number;
  AC_SALE_AMT: number;
  WEEK_SALE_AMT: number;
  AC_ORD_AMT: number;
  START_DT: string;
  END_DT: string;
}

/** 표시용 행 */
interface DisplayRow {
  label: string;
  indent: number;
  bold: boolean;
  color?: string; // 강조색
  prev: { styles: number; storAmt: number; saleAmt: number; saleRate: number; weekSale: number };
  curr: { styles: number; storAmt: number; saleAmt: number; saleRate: number; weekSale: number };
}

// 카테고리 매핑: DB PRDT_KIND_NM → 표시명
const CAT_LABEL: Record<string, string> = {
  Outer: "Outer",
  Inner: "Top",
  Bottom: "Bottom",
  Bag: "Bag",
  Headwear: "Hat",
  Wear_etc: "Etc",
};

const RTW_CATS = ["Outer", "Inner", "Bottom", "Wear_etc"];
const ACC_CATS = ["Bag", "Headwear"];

function pct(a: number, b: number): string {
  if (b === 0) return "+0%";
  const v = ((a - b) / Math.abs(b)) * 100;
  return v >= 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`;
}

function delta(a: number, b: number): string {
  const d = a - b;
  return d >= 0 ? `+${d}` : `${d}`;
}

function pDelta(a: number, b: number): string {
  const d = a - b;
  const s = d >= 0 ? `+${d.toFixed(1)}p` : `${d.toFixed(1)}p`;
  return s;
}

function fmtAmt(v: number): string {
  return Math.round(v / 10000).toLocaleString(); // 백만원 단위
}

function growthColor(val: number, base: number): string {
  if (base === 0) return "#10b981";
  const g = ((val - base) / Math.abs(base)) * 100;
  if (g > 0) return "#10b981";
  if (g < 0) return "#ef4444";
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
      .then((r) => r.ok ? r.json() : [])
      .then((data: CategoryRow[]) => {
        setRawData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brand]);

  // 데이터 집계
  const displayRows = useMemo((): DisplayRow[] => {
    if (!rawData.length) return [];

    const aggregate = (sesn: string, genderFilter?: string, cats?: string[]) => {
      const filtered = rawData.filter((r) => {
        if (r.SESN !== sesn) return false;
        if (genderFilter && r.GENDER !== genderFilter) return false;
        if (cats && !cats.includes(r.CATEGORY)) return false;
        return true;
      });
      return {
        styles: filtered.reduce((s, r) => s + r.STOR_STYLE_CNT, 0),
        storAmt: filtered.reduce((s, r) => s + Number(r.AC_STOR_AMT || 0), 0),
        saleAmt: filtered.reduce((s, r) => s + Number(r.AC_SALE_AMT || 0), 0),
        weekSale: filtered.reduce((s, r) => s + Number(r.WEEK_SALE_AMT || 0), 0),
        saleRate: 0,
      };
    };

    const withRate = (d: ReturnType<typeof aggregate>) => {
      d.saleRate = d.storAmt > 0 ? (d.saleAmt / d.storAmt) * 100 : 0;
      return d;
    };

    const row = (label: string, indent: number, bold: boolean, color: string | undefined, cats?: string[], gender?: string): DisplayRow => ({
      label,
      indent,
      bold,
      color,
      prev: withRate(aggregate(prevSeason, gender, cats)),
      curr: withRate(aggregate(season, gender, cats)),
    });

    const rows: DisplayRow[] = [];

    // Total
    rows.push(row("Total", 0, true, undefined));

    // RTW (의류)
    rows.push(row("RTW (의류)", 0, true, "#ef4444", RTW_CATS));

    // Women
    rows.push(row("Women", 1, true, undefined, RTW_CATS, "여성"));
    for (const cat of RTW_CATS) {
      const label = CAT_LABEL[cat] || cat;
      const prevD = withRate(aggregate(prevSeason, "여성", [cat]));
      const currD = withRate(aggregate(season, "여성", [cat]));
      if (prevD.styles > 0 || currD.styles > 0) {
        rows.push({ label, indent: 2, bold: false, prev: prevD, curr: currD });
      }
    }

    // Men
    rows.push(row("Men", 1, true, undefined, RTW_CATS, "남성"));
    for (const cat of RTW_CATS) {
      const label = CAT_LABEL[cat] || cat;
      const prevD = withRate(aggregate(prevSeason, "남성", [cat]));
      const currD = withRate(aggregate(season, "남성", [cat]));
      if (prevD.styles > 0 || currD.styles > 0) {
        rows.push({ label, indent: 2, bold: false, prev: prevD, curr: currD });
      }
    }

    // Acc
    rows.push(row("Acc", 0, true, undefined, ACC_CATS));

    return rows;
  }, [rawData, season, prevSeason]);

  const weekLabel = rawData.find((r) => r.SESN === season)?.START_DT?.slice(5) || "";

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
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">카테고리별 발입출 분석</h2>
        <span className="text-xs text-slate-400">(매출/입고/발주금액: 백만원, 판매율: %)</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              {/* 그룹 헤더 */}
              <tr className="bg-slate-800 text-white">
                <th rowSpan={2} className="px-4 py-2.5 text-left font-semibold text-[11px] border-r border-slate-700 min-w-[120px]">카테고리</th>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[11px] border-r border-slate-700">입고스타일수</th>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[11px] border-r border-slate-700">입고금액</th>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[11px] border-r border-slate-700">누계매출</th>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[11px]">판매율(금액)</th>
              </tr>
              {/* 서브 헤더 */}
              <tr className="bg-slate-700 text-slate-300">
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{season}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium border-r border-slate-600">증감</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{season}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium border-r border-slate-600">성장률</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{season}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium border-r border-slate-600">성장률</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{prevSeason}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">{season}</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium">변화</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => {
                const styleDelta = row.curr.styles - row.prev.styles;
                const storGrowth = pct(row.curr.storAmt, row.prev.storAmt);
                const saleGrowth = pct(row.curr.saleAmt, row.prev.saleAmt);
                const rateDelta = pDelta(row.curr.saleRate, row.prev.saleRate);

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 ${row.bold ? "bg-slate-50/80" : ""}`}
                  >
                    {/* 카테고리 */}
                    <td className={`px-4 py-2 border-r border-slate-100 ${row.bold ? "font-bold" : ""}`}
                      style={{ paddingLeft: `${16 + row.indent * 16}px`, color: row.color || (row.bold ? "#1e293b" : "#475569") }}
                    >
                      {row.label}
                    </td>

                    {/* 입고스타일수 */}
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-600">{row.prev.styles}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums font-bold text-slate-800">{row.curr.styles}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums border-r border-slate-100"
                      style={{ color: styleDelta > 0 ? "#10b981" : styleDelta < 0 ? "#ef4444" : "#64748b" }}
                    >
                      {delta(row.curr.styles, row.prev.styles)}
                    </td>

                    {/* 입고금액 */}
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtAmt(row.prev.storAmt)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums font-bold text-slate-800">{fmtAmt(row.curr.storAmt)}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums border-r border-slate-100"
                      style={{ color: growthColor(row.curr.storAmt, row.prev.storAmt) }}
                    >
                      {storGrowth}
                    </td>

                    {/* 누계매출 */}
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">{fmtAmt(row.prev.saleAmt)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums font-bold text-slate-800">{fmtAmt(row.curr.saleAmt)}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums border-r border-slate-100"
                      style={{ color: growthColor(row.curr.saleAmt, row.prev.saleAmt) }}
                    >
                      {saleGrowth}
                    </td>

                    {/* 판매율 */}
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-600">{row.prev.saleRate.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums font-bold text-slate-800">{row.curr.saleRate.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums"
                      style={{ color: row.curr.saleRate - row.prev.saleRate >= 0 ? "#10b981" : "#ef4444" }}
                    >
                      {rateDelta}
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
