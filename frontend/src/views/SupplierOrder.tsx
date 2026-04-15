"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, ScheduleRow } from "@/lib/api";

interface Props {
  brand: string;
  season: string;
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

// CSV 카테고리 기준
const RTW_CATS = ["down", "outer", "top", "bottom"];
const ACC_CATS = ["acc"];

function fmtGrowth(c: number, p: number): string {
  if (p === 0) return c > 0 ? "+999%" : "+0%";
  const v = ((c - p) / Math.abs(p)) * 100;
  return v >= 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`;
}
function fmtDelta(c: number, p: number): string {
  const d = c - p;
  return d >= 0 ? `+${d}` : `${d}`;
}
function fmtRate(n: number, d: number): string {
  if (d === 0) return "0%";
  return `${((n / d) * 100).toFixed(0)}%`;
}
function fmtAmt(v: number): string {
  return (v / 1e8).toFixed(1);
}
function colorVal(c: number, p: number): string {
  return c > p ? "#10b981" : c < p ? "#ef4444" : "#64748b";
}

// stylemaster CSV를 fetch해서 매핑
interface StyleInfo {
  gender: string;
  category: string;
}

export default function SupplierOrder({ brand, season }: Props) {
  const [currData, setCurrData] = useState<OrderInbound[]>([]);
  const [prevData, setPrevData] = useState<OrderInbound[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [styleMap, setStyleMap] = useState<Record<string, StyleInfo>>({});
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [selSuppliers, setSelSuppliers] = useState<Set<string>>(new Set());
  const [selStaff, setSelStaff] = useState<Set<string>>(new Set());
  const [staffSupplierMap, setStaffSupplierMap] = useState<Record<string, string[]>>({});

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);

    // stylemaster + staff-supplier map
    const loadStyleMap = fetch("/data/stylemaster.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, StyleInfo>) => setStyleMap(map))
      .catch(() => {});

    fetch("/data/staff_supplier_map.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, string[]>) => setStaffSupplierMap(map))
      .catch(() => {});

    Promise.all([
      api.getOrderInbound(brand, season),
      api.getOrderInbound(brand, prevSeason),
      api.getSchedule(brand),
      loadStyleMap,
    ]).then(([curr, prev, sched]) => {
      setCurrData(curr.data);
      setPrevData(prev.data);
      setSchedule(sched.data.filter((r) => r.season === season));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  // 스케줄에서 담당자 맵: PART_CD → staff
  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    schedule.forEach((r) => {
      if (r.staff && /[가-힣]/.test(r.staff) && !map.has(r.style_no)) {
        map.set(r.style_no, r.staff);
      }
    });
    return map;
  }, [schedule]);

  // 필터 옵션
  const filterOptions = useMemo(() => {
    const suppliers = [...new Set(currData.map((r) => r.MFAC_COMPY_NM).filter(Boolean))].sort();
    const staffList = [...new Set([...staffMap.values()])].sort();
    return { suppliers, staffList };
  }, [currData, staffMap]);

  // PART_CD 추출 헬퍼
  const getPartCd = (r: OrderInbound): string => {
    if (r.PART_CD) return String(r.PART_CD);
    const prdt = r.PRDT_CD || "";
    return prdt.length > 4 ? prdt.slice(4) : prdt;
  };

  // 카테고리 분류 헬퍼
  const getCategory = (r: OrderInbound): { gender: string; category: string } => {
    const part = getPartCd(r);
    const info = styleMap[part];
    if (info) return info;
    // fallback: ITEM_GROUP
    const ig = (r.ITEM_GROUP as string) || "";
    let cat = "etc";
    if (ig === "다운") cat = "down";
    else if (ig === "아우터") cat = "outer";
    else if (ig === "티셔츠" || ig === "맨투맨") cat = "top";
    else if (ig === "팬츠") cat = "bottom";
    else if (["가방", "볼캡/햇/비니", "기타용품", "시즌모자"].includes(ig)) cat = "acc";
    return { gender: "women", category: cat };
  };

  // 필터링된 데이터
  const filteredCurr = useMemo(() => {
    return currData.filter((r) => {
      if (selSuppliers.size > 0 && !selSuppliers.has(r.MFAC_COMPY_NM)) return false;
      if (selStaff.size > 0) {
        const part = getPartCd(r);
        const staff = staffMap.get(part);
        if (!staff || !selStaff.has(staff)) return false;
      }
      return true;
    });
  }, [currData, selSuppliers, selStaff, staffMap, styleMap]);

  const filteredPrev = useMemo(() => {
    return prevData.filter((r) => {
      if (selSuppliers.size > 0 && !selSuppliers.has(r.MFAC_COMPY_NM)) return false;
      // 담당자 필터는 26S 스케줄 기반이므로 25S에는 적용하지 않음 (같은 스타일이면 적용)
      if (selStaff.size > 0) {
        const part = getPartCd(r);
        const staff = staffMap.get(part);
        if (!staff || !selStaff.has(staff)) return false;
      }
      return true;
    });
  }, [prevData, selSuppliers, selStaff, staffMap, styleMap]);

  // 집계 함수
  const displayRows = useMemo((): DisplayRow[] => {
    const agg = (data: OrderInbound[], gender?: string, cats?: string[]): Metrics => {
      const f = data.filter((r) => {
        const info = getCategory(r);
        if (gender && info.gender !== gender) return false;
        if (cats && !cats.includes(info.category)) return false;
        return true;
      });
      const styleSet = new Set<string>();
      const storStyleSet = new Set<string>();
      let skus = 0, storSkus = 0, ordQty = 0, storQty = 0, ordAmt = 0, storAmt = 0;
      f.forEach((r) => {
        styleSet.add(r.PRDT_CD);
        if ((r.STOR_QTY || 0) > 0) { storStyleSet.add(r.PRDT_CD); storSkus++; }
        skus++;
        ordQty += r.ORD_QTY || 0;
        storQty += r.STOR_QTY || 0;
        ordAmt += r.ORD_TAG_AMT || 0;
        storAmt += r.STOR_TAG_AMT || 0;
      });
      return { styles: styleSet.size, storStyles: storStyleSet.size, skus, storSkus, ordQty, storQty, ordAmt, storAmt };
    };

    const mkRow = (label: string, indent: number, bold: boolean, color: string | undefined, cats?: string[], gender?: string): DisplayRow => ({
      label, indent, bold, color,
      prev: agg(filteredPrev, gender, cats),
      curr: agg(filteredCurr, gender, cats),
    });

    const addGender = (rows: DisplayRow[], label: string, gender: string) => {
      rows.push(mkRow(label, 1, true, undefined, RTW_CATS, gender));
      for (const cat of RTW_CATS) {
        const p = agg(filteredPrev, gender, [cat]);
        const c = agg(filteredCurr, gender, [cat]);
        if (p.styles > 0 || c.styles > 0) {
          rows.push({ label: cat.charAt(0).toUpperCase() + cat.slice(1), indent: 2, bold: false, prev: p, curr: c });
        }
      }
    };

    const rows: DisplayRow[] = [];
    rows.push(mkRow("Total", 0, true, undefined));
    rows.push(mkRow("RTW (의류)", 0, true, "#ef4444", RTW_CATS));
    addGender(rows, "Women", "women");
    addGender(rows, "Men", "men");
    rows.push(mkRow("Acc", 0, true, undefined, ACC_CATS));
    return rows;
  }, [filteredCurr, filteredPrev, styleMap]);

  const toggleSet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
  };

  // 담당자 토글 시 해당 협력사 자동 선택/해제
  const toggleStaff = (staff: string) => {
    const nextStaff = new Set(selStaff);
    const nextSuppliers = new Set(selSuppliers);
    const linkedSuppliers = staffSupplierMap[staff] || [];

    if (nextStaff.has(staff)) {
      // 해제: 해당 담당자의 협력사 제거 (다른 선택된 담당자의 협력사는 유지)
      nextStaff.delete(staff);
      linkedSuppliers.forEach((s) => {
        const stillNeeded = [...nextStaff].some((otherStaff) =>
          (staffSupplierMap[otherStaff] || []).includes(s)
        );
        if (!stillNeeded) nextSuppliers.delete(s);
      });
    } else {
      // 선택: 해당 담당자의 협력사 추가
      nextStaff.add(staff);
      linkedSuppliers.forEach((s) => nextSuppliers.add(s));
    }

    setSelStaff(nextStaff);
    setSelSuppliers(nextSuppliers);
  };

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

  const numCell = "px-2 py-2 text-right font-mono tabular-nums text-[11px]";
  const borderR = " border-r border-slate-200";

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">카테고리별 상세</h2>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">필터 설정</div>

        {/* 협력사 */}
        <div className="flex items-start gap-3">
          <span className="text-[10px] font-bold text-slate-400 w-14 pt-1 shrink-0">협력사</span>
          <div className="flex flex-wrap gap-1">
            {filterOptions.suppliers.map((s) => (
              <button
                key={s}
                onClick={() => toggleSet(selSuppliers, s, setSelSuppliers)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  selSuppliers.has(s)
                    ? "bg-blue-500 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {s.replace(/\(주\)|㈜|주식회사 |주식회사/g, "").trim()}
              </button>
            ))}
            {selSuppliers.size > 0 && (
              <button onClick={() => setSelSuppliers(new Set())} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-600 font-medium">
                전체 ×
              </button>
            )}
          </div>
        </div>

        {/* 담당자 */}
        <div className="flex items-start gap-3">
          <span className="text-[10px] font-bold text-slate-400 w-14 pt-1 shrink-0">담당자</span>
          <div className="flex flex-wrap gap-1">
            {filterOptions.staffList.map((s) => (
              <button
                key={s}
                onClick={() => toggleStaff(s)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                  selStaff.has(s)
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {s}
              </button>
            ))}
            {selStaff.size > 0 && (
              <button onClick={() => { setSelStaff(new Set()); setSelSuppliers(new Set()); }} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-600 font-medium">
                전체 ×
              </button>
            )}
          </div>
        </div>

        {/* 활성 필터 표시 */}
        {(selSuppliers.size > 0 || selStaff.size > 0) && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">적용 중:</span>
            {[...selSuppliers].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                {s.replace(/\(주\)|㈜|주식회사 |주식회사/g, "").trim()}
                <button onClick={() => toggleSet(selSuppliers, s, setSelSuppliers)} className="hover:text-blue-800">×</button>
              </span>
            ))}
            {[...selStaff].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-medium">
                {s}
                <button onClick={() => toggleSet(selStaff, s, setSelStaff)} className="hover:text-emerald-800">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th rowSpan={2} className="px-4 py-2.5 text-left font-bold text-slate-600 text-[10px] border-r border-slate-200 min-w-[110px] sticky left-0 bg-slate-100 z-20">카테고리</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-blue-700 border-r border-slate-200 bg-blue-50/50">스타일수</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-violet-700 border-r border-slate-200 bg-violet-50/50">SKU수</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-emerald-700 border-r border-slate-200 bg-emerald-50/50">수량 (PCS)</th>
                <th colSpan={5} className="px-1 py-2 text-center font-bold text-[10px] text-amber-700 bg-amber-50/50">금액 (억원)</th>
              </tr>
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
                    <td
                      className={`px-4 py-2 border-r border-slate-200 sticky left-0 z-10 ${bgClass || "bg-white"} ${row.bold ? "font-bold" : ""}`}
                      style={{ paddingLeft: `${16 + row.indent * 16}px`, color: row.color || (row.bold ? "#1e293b" : "#475569") }}
                    >
                      {row.label}
                    </td>
                    {/* 스타일수 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.styles}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storStyles}</td>
                    <td className={`${numCell} text-slate-500`}>{p.styles}</td>
                    <td className={numCell} style={{ color: colorVal(c.styles, p.styles) }}>{fmtDelta(c.styles, p.styles)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storStyles < c.styles ? "#ef4444" : "#10b981" }}>{fmtRate(c.storStyles, c.styles)}</td>
                    {/* SKU수 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.skus.toLocaleString()}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storSkus.toLocaleString()}</td>
                    <td className={`${numCell} text-slate-500`}>{p.skus.toLocaleString()}</td>
                    <td className={numCell} style={{ color: colorVal(c.skus, p.skus) }}>{fmtDelta(c.skus, p.skus)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storSkus < c.skus ? "#ef4444" : "#10b981" }}>{fmtRate(c.storSkus, c.skus)}</td>
                    {/* 수량 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{c.ordQty.toLocaleString()}</td>
                    <td className={`${numCell} text-emerald-600`}>{c.storQty.toLocaleString()}</td>
                    <td className={`${numCell} text-slate-500`}>{p.ordQty.toLocaleString()}</td>
                    <td className={numCell} style={{ color: colorVal(c.ordQty, p.ordQty) }}>{fmtGrowth(c.ordQty, p.ordQty)}</td>
                    <td className={`${numCell}${borderR}`} style={{ color: c.storQty < c.ordQty * 0.95 ? "#ef4444" : "#10b981" }}>{fmtRate(c.storQty, c.ordQty)}</td>
                    {/* 금액 */}
                    <td className={`${numCell} font-bold text-slate-800`}>{fmtAmt(c.ordAmt)}</td>
                    <td className={`${numCell} text-emerald-600`}>{fmtAmt(c.storAmt)}</td>
                    <td className={`${numCell} text-slate-500`}>{fmtAmt(p.ordAmt)}</td>
                    <td className={numCell} style={{ color: colorVal(c.ordAmt, p.ordAmt) }}>{fmtGrowth(c.ordAmt, p.ordAmt)}</td>
                    <td className={numCell} style={{ color: c.storAmt < c.ordAmt * 0.95 ? "#ef4444" : "#10b981" }}>{fmtRate(c.storAmt, c.ordAmt)}</td>
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
