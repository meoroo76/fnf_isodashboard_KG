"use client";

import { useEffect, useState, useMemo } from "react";
import { api, OrderInbound, ScheduleRow } from "@/lib/api";

interface Props {
  brand: string;
  season: string;
}

/** PO 단위 집계 행 */
interface PoRow {
  po_no: string;
  style_count: number;
  styles: string[];
  colors: string[];
  ord_qty: number;
  stor_qty: number;
  supplier: string;
  item_group: string;
  eta: string | null; // 엑셀 입고예정일
  remark: string; // 엑셀 비고
  staff: string;
  spot: string;
}

export default function SupplierOrder({ brand, season }: Props) {
  const [orderData, setOrderData] = useState<OrderInbound[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [inboundFilter, setInboundFilter] = useState<"all" | "inbound" | "pending">("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrderInbound(brand, season),
      api.getSchedule(brand),
    ]).then(([order, sched]) => {
      setOrderData(order.data);
      setSchedule(sched.data.filter((r) => r.season === season.replace("S", "S").replace("F", "F")));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season]);

  // 엑셀 스케줄 맵: STYLE_NO → { eta, remark, staff, supplier, spot, item_code }
  const scheduleMap = useMemo(() => {
    const map = new Map<string, { eta: string | null; remark: string; staff: string; supplier: string; spot: string; item_code: string }>();
    schedule.forEach((r) => {
      // 스타일별로 첫 번째 레코드의 정보 사용 (ETA, 비고 등)
      if (!map.has(r.style_no)) {
        map.set(r.style_no, {
          eta: r.eta,
          remark: r.remark,
          staff: r.staff,
          supplier: r.supplier,
          spot: r.spot,
          item_code: r.item_code,
        });
      }
    });
    return map;
  }, [schedule]);

  // PO 단위 집계
  const poRows = useMemo((): PoRow[] => {
    if (!orderData.length) return [];

    const map = new Map<string, {
      styles: Set<string>;
      colors: Set<string>;
      ord_qty: number;
      stor_qty: number;
      supplier: string;
      item_group: string;
    }>();

    orderData.forEach((r) => {
      const po = r.PO_NO;
      if (!po) return;
      const cur = map.get(po) || {
        styles: new Set<string>(),
        colors: new Set<string>(),
        ord_qty: 0,
        stor_qty: 0,
        supplier: r.MFAC_COMPY_NM || "-",
        item_group: r.ITEM_GROUP || "-",
      };
      cur.styles.add(r.PRDT_CD);
      if (r.COLOR_CD) cur.colors.add(String(r.COLOR_CD));
      cur.ord_qty += r.ORD_QTY || 0;
      cur.stor_qty += r.STOR_QTY || 0;
      map.set(po, cur);
    });

    return [...map.entries()].map(([po, v]) => {
      const styleList = [...v.styles];
      // 품번에서 PART_CD 추출 (앞 4자 제거)
      const partCd = styleList[0]?.replace(/^[A-Z]\d{2}[A-Z]/, "") || "";
      const schedInfo = scheduleMap.get(partCd);

      // 입고수량 없을 때 엑셀 ETA 사용
      const eta = v.stor_qty === 0 && schedInfo ? schedInfo.eta : null;
      const remark = schedInfo?.remark || "";
      const staff = schedInfo?.staff || "";
      const spot = schedInfo?.spot || "";

      return {
        po_no: po,
        style_count: v.styles.size,
        styles: styleList,
        colors: [...v.colors].sort(),
        ord_qty: v.ord_qty,
        stor_qty: v.stor_qty,
        supplier: v.supplier,
        item_group: v.item_group,
        eta,
        remark,
        staff,
        spot,
      };
    }).sort((a, b) => a.supplier.localeCompare(b.supplier) || a.po_no.localeCompare(b.po_no));
  }, [orderData, scheduleMap]);

  // 필터 옵션 추출
  const filterOptions = useMemo(() => {
    const suppliers = [...new Set(poRows.map((r) => r.supplier))].sort();
    const staffList = [...new Set(schedule.map((r) => r.staff).filter((s) => /[가-힣]/.test(s)))].sort();
    const items = [...new Set(poRows.map((r) => r.item_group))].sort();
    return { suppliers, staffList, items };
  }, [poRows, schedule]);

  // 필터 적용
  const filteredRows = useMemo(() => {
    return poRows.filter((r) => {
      if (selectedSuppliers.size > 0 && !selectedSuppliers.has(r.supplier)) return false;
      if (selectedStaff.size > 0 && !selectedStaff.has(r.staff)) return false;
      if (selectedItems.size > 0 && !selectedItems.has(r.item_group)) return false;
      if (inboundFilter === "inbound" && r.stor_qty === 0) return false;
      if (inboundFilter === "pending" && r.stor_qty > 0) return false;
      return true;
    });
  }, [poRows, selectedSuppliers, selectedStaff, selectedItems, inboundFilter]);

  // 토글 헬퍼
  const toggleSet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
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

  const totals = filteredRows.reduce(
    (acc, r) => ({ ord: acc.ord + r.ord_qty, stor: acc.stor + r.stor_qty, styles: acc.styles + r.style_count }),
    { ord: 0, stor: 0, styles: 0 },
  );

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        {/* 입고/미입고 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 w-16">상태</span>
          {(["all", "inbound", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setInboundFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                inboundFilter === f
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "전체" : f === "inbound" ? "입고 완료" : "미입고"}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">
            {filteredRows.length}건 / {poRows.length}건
          </span>
        </div>

        {/* 협력사 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-slate-500 w-16 pt-1">협력사</span>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.suppliers.map((s) => (
              <button
                key={s}
                onClick={() => toggleSet(selectedSuppliers, s, setSelectedSuppliers)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  selectedSuppliers.has(s)
                    ? "bg-blue-500 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
            {selectedSuppliers.size > 0 && (
              <button onClick={() => setSelectedSuppliers(new Set())} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-600">초기화</button>
            )}
          </div>
        </div>

        {/* 담당자 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-slate-500 w-16 pt-1">담당자</span>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.staffList.map((s) => (
              <button
                key={s}
                onClick={() => toggleSet(selectedStaff, s, setSelectedStaff)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  selectedStaff.has(s)
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
            {selectedStaff.size > 0 && (
              <button onClick={() => setSelectedStaff(new Set())} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-600">초기화</button>
            )}
          </div>
        </div>

        {/* 복종 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-slate-500 w-16 pt-1">복종</span>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.items.map((s) => (
              <button
                key={s}
                onClick={() => toggleSet(selectedItems, s, setSelectedItems)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  selectedItems.has(s)
                    ? "bg-amber-500 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
            {selectedItems.size > 0 && (
              <button onClick={() => setSelectedItems(new Set())} className="px-2 py-1 text-[10px] text-red-400 hover:text-red-600">초기화</button>
            )}
          </div>
        </div>
      </div>

      {/* 합계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 text-center">
          <div className="text-[10px] text-slate-400 uppercase">PO 건수</div>
          <div className="text-xl font-bold text-slate-800">{filteredRows.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 text-center">
          <div className="text-[10px] text-slate-400 uppercase">스타일수</div>
          <div className="text-xl font-bold text-slate-800">{totals.styles}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 text-center">
          <div className="text-[10px] text-slate-400 uppercase">발주수량</div>
          <div className="text-xl font-bold text-slate-800">{totals.ord.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 text-center">
          <div className="text-[10px] text-slate-400 uppercase">입고수량</div>
          <div className="text-xl font-bold text-emerald-600">{totals.stor.toLocaleString()}</div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase">PO</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase">STY</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase">칼라</th>
                <th className="text-right px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase">발주수량</th>
                <th className="text-right px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase">입고수량</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase">입고예정일</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-[10px] uppercase max-w-[200px]">비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">해당 조건의 데이터 없음</td></tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isComplete = row.stor_qty > 0 && row.stor_qty >= row.ord_qty;
                  const isPartial = row.stor_qty > 0 && row.stor_qty < row.ord_qty;
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-slate-50 hover:bg-indigo-50/30 transition-colors ${isComplete ? "bg-emerald-50/20" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-[11px] font-medium text-slate-800">{row.po_no}</div>
                        <div className="text-[10px] text-slate-400">{row.supplier}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-700">{row.style_count}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-0.5">
                          {row.colors.map((c) => (
                            <span key={c} className="inline-block px-1 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-600">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{row.ord_qty.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {row.stor_qty > 0 ? (
                          <span className={isComplete ? "text-emerald-600 font-bold" : isPartial ? "text-amber-600 font-bold" : "text-slate-700"}>
                            {row.stor_qty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[11px] font-mono">
                        {row.eta ? (
                          <span className="text-blue-600 font-medium">{row.eta.slice(5)}</span>
                        ) : row.stor_qty > 0 ? (
                          <span className="text-emerald-500">완료</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 max-w-[200px] truncate" title={row.remark}>
                        {row.remark ? row.remark.split("\n")[0].slice(0, 40) : ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
