"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { api, Claim, OrderInbound } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

interface Props { brand: string; season: string; }

const DEFECT_COLORS: Record<string, string> = {
  "업체과실": "#7cb9a8", "제품특성": "#a8b4e0", "유통과실": "#d4b896",
  "부자재불량": "#c9a8d4", "봉제불량": "#e8b4b4", "원단불량": "#8ec5d6",
  "재단불량": "#b8c9a0", "기타불량": "#c4bfb6", "기타": "#c4bfb6",
};

// ── 스타일 상세 모달 ──
interface StyleDetail {
  prdt_cd: string;
  prdt_cd_full: string;
  prdt_nm: string;
  item_group: string;
  supplier: string;
  totalQty: number;
  totalCount: number;
  claims: Claim[];
  colorSummary: { color: string; ordQty: number; storQty: number; claimQty: number }[];
  defectBreakdown: { type: string; qty: number }[];
  channelBreakdown: { channel: string; qty: number }[];
  imageUrl: string | null;
}

function ClaimDetailModal({
  detail,
  onClose,
}: {
  detail: StyleDetail;
  onClose: () => void;
}) {
  const downloadCsv = useCallback(() => {
    const headers = ["접수일","스타일코드","스타일명","복종","협력사","PO","채널","매장","과실구분","불량유형","처리결과","수량"];
    const rows = detail.claims.map((c) => [
      c.CLAIM_RCPT_DT || c.CLAIM_DT || "",
      detail.prdt_cd,
      detail.prdt_nm,
      c.ITEM_GROUP || "",
      c.MFAC_COMPY_NM || "",
      (c as Record<string, unknown>).PO_NO as string || "",
      (c as Record<string, unknown>).CHANNEL_TYPE as string || "",
      (c as Record<string, unknown>).SHOP_NM as string || "",
      c.CLAIM_ERR_CLS_NM || "",
      c.CLAIM_CONTS_ANAL_GROUP_NM || "",
      (c as Record<string, unknown>).CLAIM_RSLT_ANAL_NM as string || "",
      String(c.CLAIM_QTY || 0),
    ]);
    const bom = "\uFEFF";
    const csv = bom + [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claim_${detail.prdt_cd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [detail]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[960px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-4">
            {detail.imageUrl ? (
              <img src={detail.imageUrl} alt={detail.prdt_nm} className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
            ) : (
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">No IMG</div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-800">{detail.prdt_cd}</h3>
              <p className="text-sm text-slate-500">{detail.prdt_nm} · {detail.item_group} · {detail.supplier}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCsv} className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
              CSV 다운로드
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 text-lg">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* 요약 KPI */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">총 클레임 수량</div>
              <div className="text-2xl font-bold text-slate-800">{detail.totalQty.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400">{detail.totalCount}건</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">불량유형</div>
              <div className="text-2xl font-bold text-slate-800">{detail.defectBreakdown.length}</div>
              <div className="text-[11px] text-slate-400">유형</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">채널</div>
              <div className="text-2xl font-bold text-slate-800">{detail.channelBreakdown.length}</div>
              <div className="text-[11px] text-slate-400">채널</div>
            </div>
          </div>

          {/* 칼라별 발주/입고/클레임 요약 */}
          {detail.colorSummary.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">칼라별 수량 요약</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">칼라</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">발주수량</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">입고수량</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">클레임수량</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">불량률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.colorSummary.map((c) => (
                      <tr key={c.color} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{c.color}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{c.ordQty.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{c.storQty.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-red-600 font-medium">{c.claimQty.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {c.storQty > 0 ? ((c.claimQty / c.storQty) * 100).toFixed(1) + "%" : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 과실구분별 / 불량유형별 내역 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">과실구분별 내역</h4>
              <div className="space-y-1.5">
                {detail.defectBreakdown.map((d) => {
                  const pct = detail.totalQty > 0 ? (d.qty / detail.totalQty) * 100 : 0;
                  return (
                    <div key={d.type} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: DEFECT_COLORS[d.type] || "#c4bfb6" }} />
                      <span className="text-xs text-slate-600 w-20 truncate">{d.type}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEFECT_COLORS[d.type] || "#c4bfb6" }} />
                      </div>
                      <span className="text-xs font-mono text-slate-500 w-16 text-right">{d.qty}PCS ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">채널별 내역</h4>
              <div className="space-y-1.5">
                {detail.channelBreakdown.map((ch, i) => {
                  const pct = detail.totalQty > 0 ? (ch.qty / detail.totalQty) * 100 : 0;
                  const colors = Object.values(DEFECT_COLORS);
                  return (
                    <div key={ch.channel} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                      <span className="text-xs text-slate-600 w-24 truncate">{ch.channel}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                      </div>
                      <span className="text-xs font-mono text-slate-500 w-16 text-right">{ch.qty}PCS ({pct.toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 클레임 건별 상세 */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">건별 클레임 상세</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">접수일</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">PO</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">채널</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">매장</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">과실구분</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">불량유형</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">처리결과</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.claims.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{c.CLAIM_RCPT_DT || c.CLAIM_DT || "-"}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600">{(c as Record<string, unknown>).PO_NO as string || "-"}</td>
                      <td className="px-3 py-1.5 text-slate-600">{(c as Record<string, unknown>).CHANNEL_TYPE as string || "-"}</td>
                      <td className="px-3 py-1.5 text-slate-600">{(c as Record<string, unknown>).SHOP_NM as string || "-"}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: DEFECT_COLORS[c.CLAIM_ERR_CLS_NM] || "#c4bfb6" }} />
                          {c.CLAIM_ERR_CLS_NM || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-600">{c.CLAIM_CONTS_ANAL_GROUP_NM || "-"}</td>
                      <td className="px-3 py-1.5 text-slate-600">{(c as Record<string, unknown>).CLAIM_RSLT_ANAL_NM as string || "-"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-red-600">{c.CLAIM_QTY}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 리사이즈 가능 테이블 ──
interface TableRow {
  prdt_cd: string;
  prdt_cd_full: string;
  prdt_nm: string;
  item_group: string;
  supplier: string;
  qty: number;
  count: number;
  types: string;
  imageUrl: string | null;
}

const COL_DEFS = [
  { key: "img", label: "", align: "left" as const, minW: 44, initW: 50 },
  { key: "prdt_cd", label: "스타일코드", align: "left" as const, minW: 80, initW: 110 },
  { key: "prdt_nm", label: "스타일명", align: "left" as const, minW: 80, initW: 160 },
  { key: "item_group", label: "복종", align: "left" as const, minW: 50, initW: 70 },
  { key: "supplier", label: "협력사", align: "left" as const, minW: 80, initW: 150 },
  { key: "qty", label: "클레임수량", align: "right" as const, minW: 60, initW: 80 },
  { key: "count", label: "건수", align: "right" as const, minW: 40, initW: 50 },
  { key: "types", label: "불량유형", align: "left" as const, minW: 100, initW: 220 },
];

function ResizableClaimTable({ rows, onDoubleClick }: { rows: TableRow[]; onDoubleClick: (fullCode: string) => void }) {
  const [colWidths, setColWidths] = useState(() => COL_DEFS.map((c) => c.initW));
  const dragRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      const newW = Math.max(COL_DEFS[dragRef.current.colIdx].minW, dragRef.current.startW + diff);
      setColWidths((prev) => {
        const next = [...prev];
        next[dragRef.current!.colIdx] = newW;
        return next;
      });
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table style={{ width: colWidths.reduce((a, b) => a + b, 0), tableLayout: "fixed", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {COL_DEFS.map((col, ci) => (
              <th
                key={col.key}
                className="relative px-2.5 py-2 text-[11px] font-semibold text-slate-500 bg-slate-50 border-b-2 border-slate-200 select-none"
                style={{ width: colWidths[ci], textAlign: col.align }}
              >
                {col.label}
                {ci < COL_DEFS.length - 1 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-300/40 z-10"
                    onMouseDown={(e) => onMouseDown(ci, e)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors cursor-pointer"
              onDoubleClick={() => onDoubleClick(row.prdt_cd_full)}
              title="더블클릭하여 상세 보기"
            >
              <td className="px-2.5 py-1.5 overflow-hidden" style={{ width: colWidths[0] }}>
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt="" className="w-9 h-9 object-cover rounded-lg border border-slate-200" />
                ) : (
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] text-slate-400">IMG</div>
                )}
              </td>
              <td className="px-2.5 py-1.5 text-[12px] font-mono font-medium text-slate-800 truncate overflow-hidden" style={{ width: colWidths[1] }}>{row.prdt_cd}</td>
              <td className="px-2.5 py-1.5 text-[12px] font-medium text-slate-800 truncate overflow-hidden" style={{ width: colWidths[2] }}>{row.prdt_nm}</td>
              <td className="px-2.5 py-1.5 text-[12px] text-slate-600 truncate overflow-hidden" style={{ width: colWidths[3] }}>{row.item_group}</td>
              <td className="px-2.5 py-1.5 text-[12px] text-slate-600 truncate overflow-hidden" style={{ width: colWidths[4] }}>{row.supplier}</td>
              <td className="px-2.5 py-1.5 text-[12px] text-right font-mono tabular-nums font-medium text-red-600" style={{ width: colWidths[5] }}>{row.qty.toLocaleString()}</td>
              <td className="px-2.5 py-1.5 text-[12px] text-right font-mono tabular-nums" style={{ width: colWidths[6] }}>{row.count}</td>
              <td className="px-2.5 py-1.5 text-[12px] text-slate-600 truncate overflow-hidden" style={{ width: colWidths[7] }}>{row.types}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function ClaimDashboard({ brand, season }: Props) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [orderData, setOrderData] = useState<OrderInbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [styleImages, setStyleImages] = useState<Record<string, string | null>>({});
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const prevSeason = useMemo(() => {
    const y = parseInt(season.slice(0, 2));
    return `${(y - 1).toString().padStart(2, "0")}${season.slice(2)}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getClaims(brand),
      api.getOrderInbound(brand, season),
    ]).then(([claimRes, orderRes]) => {
      setClaims(claimRes.data);
      setOrderData(orderRes.data);
      setLoading(false);

      // 이미지 로드 (현재 시즌 클레임 스타일)
      const currPrdtCds = [...new Set(
        claimRes.data.filter((c) => c.SESN === season).map((c) => c.PRDT_CD)
      )];
      if (currPrdtCds.length > 0) {
        api.getStyleImages(currPrdtCds).then((res) => setStyleImages(res.data)).catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, [brand, season]);

  const currClaims = useMemo(() => claims.filter((c) => c.SESN === season), [claims, season]);
  const prevClaims = useMemo(() => claims.filter((c) => c.SESN === prevSeason), [claims, prevSeason]);

  const kpis = useMemo(() => {
    const currCount = currClaims.length;
    const prevCount = prevClaims.length;
    const currQty = currClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const prevQty = prevClaims.reduce((s, r) => s + (r.CLAIM_QTY || 0), 0);
    const currStyles = new Set(currClaims.map((c) => c.PRDT_CD)).size;
    const prevStyles = new Set(prevClaims.map((c) => c.PRDT_CD)).size;
    const currSuppliers = new Set(currClaims.map((c) => c.MFAC_COMPY_NM)).size;
    const prevAvg = prevCount > 0 ? prevQty / prevCount : 0;
    const currAvg = currCount > 0 ? currQty / currCount : 0;

    // 전대년비율: (금년/전년 - 1) × 100 → 양수=증가, 음수=감소
    const yoy = (curr: number, prev: number) => prev === 0 ? 0 : (curr / prev - 1) * 100;
    // 증감 표기: 금년 - 전년
    const diff = (curr: number, prev: number, unit: string) => {
      const d = curr - prev;
      if (d === 0) return "";
      const sign = d > 0 ? "+" : "";
      return ` (${sign}${d.toLocaleString()}${unit})`;
    };

    return [
      { label: "클레임 건수", value: currCount.toLocaleString(), unit: "건", icon: "🔔", delta: yoy(currCount, prevCount), prevValue: `전년 ${prevCount}건${diff(currCount, prevCount, "건")}`, accent: currCount <= prevCount ? "#059669" : "#ef4444" },
      { label: "클레임 수량", value: currQty.toLocaleString(), unit: "PCS", icon: "📉", delta: yoy(currQty, prevQty), prevValue: `전년 ${prevQty.toLocaleString()}PCS${diff(currQty, prevQty, "PCS")}`, accent: currQty <= prevQty ? "#059669" : "#ef4444" },
      { label: "클레임 스타일", value: currStyles.toLocaleString(), unit: "STY", icon: "👗", delta: yoy(currStyles, prevStyles), prevValue: `전년 ${prevStyles}STY${diff(currStyles, prevStyles, "STY")}`, accent: "#7c3aed" },
      { label: "관련 협력사", value: currSuppliers.toLocaleString(), unit: "개", icon: "🏭", delta: 0, prevValue: `클레임 발생 협력사`, accent: "#0891b2" },
      { label: "건당 평균수량", value: currCount > 0 ? currAvg.toFixed(1) : "0", unit: "PCS", icon: "📊", delta: yoy(currAvg, prevAvg), prevValue: prevCount > 0 ? `전년 ${prevAvg.toFixed(1)}PCS${diff(Math.round(currAvg * 10) / 10, Math.round(prevAvg * 10) / 10, "")}` : "", accent: "#d97706" },
    ];
  }, [currClaims, prevClaims]);

  // 불량유형별 분포
  const defectDist = useMemo(() => {
    const map = new Map<string, number>();
    currClaims.forEach((c) => {
      const type = c.CLAIM_ERR_CLS_NM || "기타";
      map.set(type, (map.get(type) || 0) + (c.CLAIM_QTY || 0));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [currClaims]);

  // 협력사별 클레임
  const supplierClaims = useMemo(() => {
    const map = new Map<string, number>();
    currClaims.forEach((c) => {
      const sup = c.MFAC_COMPY_NM || "미상";
      map.set(sup, (map.get(sup) || 0) + (c.CLAIM_QTY || 0));
    });
    return [...map.entries()].map(([name, qty]) => ({ name, 수량: qty })).sort((a, b) => b.수량 - a.수량).slice(0, 10);
  }, [currClaims]);

  // 테이블 필터 state
  const [showAll, setShowAll] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState("");
  const [styleSearch, setStyleSearch] = useState("");

  const styleTable = useMemo(() => {
    const map = new Map<string, { prdt_cd_full: string; prdt_nm: string; item_group: string; qty: number; count: number; supplier: string; types: Set<string> }>();
    currClaims.forEach((c) => {
      const key = c.PRDT_CD;
      const cur = map.get(key) || { prdt_cd_full: key, prdt_nm: c.PRDT_NM || "-", item_group: c.ITEM_GROUP || "-", qty: 0, count: 0, supplier: c.MFAC_COMPY_NM || "-", types: new Set<string>() };
      cur.qty += c.CLAIM_QTY || 0;
      cur.count += 1;
      if (c.CLAIM_ERR_CLS_NM) cur.types.add(c.CLAIM_ERR_CLS_NM);
      map.set(key, cur);
    });
    return [...map.entries()]
      .map(([code, v]) => ({
        prdt_cd: code.replace(/^[A-Z]\d{2}[A-Z]/, ""),
        prdt_cd_full: v.prdt_cd_full,
        prdt_nm: v.prdt_nm,
        item_group: v.item_group,
        supplier: v.supplier,
        qty: v.qty,
        count: v.count,
        types: [...v.types].join(", "),
        imageUrl: styleImages[code] || null,
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [currClaims, styleImages]);

  const supplierList = useMemo(() => [...new Set(styleTable.map((r) => r.supplier))].sort(), [styleTable]);
  const itemGroupList = useMemo(() => [...new Set(styleTable.map((r) => r.item_group))].sort(), [styleTable]);

  const filteredTable = useMemo(() => {
    let rows = styleTable;
    if (supplierFilter) rows = rows.filter((r) => r.supplier === supplierFilter);
    if (itemGroupFilter) rows = rows.filter((r) => r.item_group === itemGroupFilter);
    if (styleSearch) {
      const q = styleSearch.toLowerCase();
      rows = rows.filter((r) => r.prdt_cd.toLowerCase().includes(q) || r.prdt_nm.toLowerCase().includes(q));
    }
    return rows;
  }, [styleTable, supplierFilter, itemGroupFilter, styleSearch]);

  const displayTable = showAll ? filteredTable : filteredTable.slice(0, 15);

  // 상세 모달 데이터
  const detailData = useMemo((): StyleDetail | null => {
    if (!selectedStyle) return null;
    const row = styleTable.find((r) => r.prdt_cd_full === selectedStyle);
    if (!row) return null;

    const styleClaims = currClaims.filter((c) => c.PRDT_CD === selectedStyle);

    // 칼라별 발주/입고 from orderData
    const styleOrders = orderData.filter((o) => o.PRDT_CD === selectedStyle);
    const colorMap = new Map<string, { ordQty: number; storQty: number; claimQty: number }>();
    styleOrders.forEach((o) => {
      const color = o.COLOR_CD as string || "UNKNOWN";
      const cur = colorMap.get(color) || { ordQty: 0, storQty: 0, claimQty: 0 };
      cur.ordQty += o.ORD_QTY || 0;
      cur.storQty += o.STOR_QTY || 0;
      colorMap.set(color, cur);
    });
    // 클레임은 PO에서 컬러 추출 (PO_NO 패턴에서)
    styleClaims.forEach((c) => {
      const po = (c as Record<string, unknown>).PO_NO as string || "";
      // PO에서 컬러코드 매칭 시도
      const matchedColor = [...colorMap.keys()].find((clr) => po.includes(clr));
      if (matchedColor) {
        const cur = colorMap.get(matchedColor)!;
        cur.claimQty += c.CLAIM_QTY || 0;
      } else {
        const cur = colorMap.get("기타") || { ordQty: 0, storQty: 0, claimQty: 0 };
        cur.claimQty += c.CLAIM_QTY || 0;
        colorMap.set("기타", cur);
      }
    });
    const colorSummary = [...colorMap.entries()]
      .map(([color, v]) => ({ color, ...v }))
      .filter((c) => c.ordQty > 0 || c.claimQty > 0)
      .sort((a, b) => b.claimQty - a.claimQty);

    // 과실구분별
    const defectMap = new Map<string, number>();
    styleClaims.forEach((c) => {
      const t = c.CLAIM_ERR_CLS_NM || "기타";
      defectMap.set(t, (defectMap.get(t) || 0) + (c.CLAIM_QTY || 0));
    });
    const defectBreakdown = [...defectMap.entries()].map(([type, qty]) => ({ type, qty })).sort((a, b) => b.qty - a.qty);

    // 채널별
    const chMap = new Map<string, number>();
    styleClaims.forEach((c) => {
      const ch = (c as Record<string, unknown>).CHANNEL_TYPE as string || "기타";
      chMap.set(ch, (chMap.get(ch) || 0) + (c.CLAIM_QTY || 0));
    });
    const channelBreakdown = [...chMap.entries()].map(([channel, qty]) => ({ channel, qty })).sort((a, b) => b.qty - a.qty);

    return {
      prdt_cd: row.prdt_cd,
      prdt_cd_full: row.prdt_cd_full,
      prdt_nm: row.prdt_nm,
      item_group: row.item_group,
      supplier: row.supplier,
      totalQty: row.qty,
      totalCount: row.count,
      claims: styleClaims,
      colorSummary,
      defectBreakdown,
      channelBreakdown,
      imageUrl: row.imageUrl,
    };
  }, [selectedStyle, styleTable, currClaims, orderData]);

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
        <div className="w-1.5 h-7 rounded-full bg-red-500" />
        <h2 className="text-lg font-bold text-slate-800">클레임 현황</h2>
        <span className="text-sm text-slate-400">{season} vs {prevSeason}</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 불량유형 분포 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">불량유형별 분포</h3>
          <div className="flex items-center gap-6">
            <div className="w-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={defectDist} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                    {defectDist.map((e, i) => <Cell key={i} fill={DEFECT_COLORS[e.name] || `hsl(${i * 60}, 50%, 55%)`} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {defectDist.slice(0, 6).map((item) => {
                const total = defectDist.reduce((s, i) => s + i.value, 0);
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: DEFECT_COLORS[item.name] || "#c4bfb6" }} />
                    <span className="text-xs text-slate-600 w-28 truncate">{item.name} ({item.value.toLocaleString()}PCS)</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEFECT_COLORS[item.name] || "#c4bfb6" }} />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 협력사별 클레임 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">협력사별 클레임 TOP 10</h3>
          <ResponsiveContainer width="100%" height={Math.max(280, supplierClaims.length * 36)}>
            <BarChart data={supplierClaims} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }} />
              <Bar dataKey="수량" radius={[0, 6, 6, 0]}>
                {supplierClaims.map((_, i) => {
                  const colors = Object.values(DEFECT_COLORS);
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 스타일별 클레임 테이블 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700">스타일별 클레임 현황</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="스타일 검색..."
              value={styleSearch}
              onChange={(e) => setStyleSearch(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 w-36"
            />
            <select
              value={itemGroupFilter}
              onChange={(e) => setItemGroupFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="">전체 복종</option>
              {itemGroupList.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="">전체 협력사</option>
              {supplierList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {!showAll && filteredTable.length > 15 ? (
              <button onClick={() => setShowAll(true)} className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                전체 보기 ({filteredTable.length})
              </button>
            ) : showAll ? (
              <button onClick={() => setShowAll(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                TOP 15
              </button>
            ) : null}
          </div>
        </div>

        {/* 커스텀 테이블 (이미지 + 더블클릭 + 리사이즈) */}
        <ResizableClaimTable rows={displayTable} onDoubleClick={(fullCode) => setSelectedStyle(fullCode)} />
        {!showAll && filteredTable.length > 15 && (
          <div className="text-center mt-2">
            <span className="text-[11px] text-slate-400">
              {filteredTable.length}개 중 15개 표시 · 더블클릭하여 상세 보기
            </span>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {detailData && (
        <ClaimDetailModal detail={detailData} onClose={() => setSelectedStyle(null)} />
      )}
    </div>
  );
}
