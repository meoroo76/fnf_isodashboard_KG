"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";

// ── 타입 ──
interface ColDef {
  col: number;
  key: string;
  label: string;
  group: string;
  editable: boolean;
  type: string;
}

interface RowData {
  _row: number;
  [key: string]: unknown;
}

interface OrderListPayload {
  meta: { synced_at: string; row_count: number; last_edited?: string };
  columns: ColDef[];
  data: RowData[];
}

// ── 그룹 정의 ──
const GROUP_META: Record<string, { label: string; color: string; bgHeader: string }> = {
  basic:    { label: "기본정보",    color: "#334155", bgHeader: "bg-slate-100" },
  info:     { label: "생산처/담당", color: "#4338ca", bgHeader: "bg-indigo-50" },
  progress: { label: "생산진행",    color: "#0369a1", bgHeader: "bg-sky-50" },
  remark:   { label: "비고/납기",   color: "#b45309", bgHeader: "bg-amber-50" },
  md:       { label: "MD정보",      color: "#7c3aed", bgHeader: "bg-violet-50" },
};

// 생산진행 서브그룹 (상위 헤더)
const PROGRESS_STAGES = [
  { prefix: "fabric",  label: "원단완료", color: "#8b5cf6", cols: ["fabric_plan", "fabric_done"] },
  { prefix: "trim",    label: "부자재",   color: "#6366f1", cols: ["trim_plan", "trim_done"] },
  { prefix: "qc",      label: "QC",       color: "#3b82f6", cols: ["qc_plan", "qc_done"] },
  { prefix: "pp",      label: "PP",       color: "#0ea5e9", cols: ["pp_plan", "pp_done"] },
  { prefix: "cutting", label: "재단/편직",color: "#14b8a6", cols: ["cutting_plan", "cutting_done"] },
  { prefix: "putin",   label: "투입",     color: "#10b981", cols: ["putin_plan", "putin_done"] },
  { prefix: "finish",  label: "생산완료", color: "#22c55e", cols: ["finish_plan", "finish_done"] },
  { prefix: "ship",    label: "선적",     color: "#f59e0b", cols: ["ship_handover", "ship_plan", "ship_done"] },
  { prefix: "arrival", label: "입고",     color: "#ef4444", cols: ["arrival_plan", "arrival_done"] },
];

// ── 유틸 ──
function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (s.length === 10 && s[4] === "-") return s.slice(5); // MM-DD
  return s;
}

function isOverdue(planVal: unknown, doneVal: unknown): boolean {
  if (!planVal || doneVal) return false;
  const plan = String(planVal);
  if (plan.length !== 10) return false;
  return new Date(plan) < new Date();
}

function getStageStatus(row: RowData, stage: typeof PROGRESS_STAGES[number]): "done" | "overdue" | "planned" | "empty" {
  const planKey = stage.cols[0];
  const doneKey = stage.cols[stage.cols.length - 1];
  if (row[doneKey]) return "done";
  if (row[planKey] && isOverdue(row[planKey], row[doneKey])) return "overdue";
  if (row[planKey]) return "planned";
  return "empty";
}

// ── 컴포넌트 ──
export default function FwOrderDetail() {
  const [payload, setPayload] = useState<OrderListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, { _row: number; field: string; value: unknown }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 필터
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStyleNo, setFilterStyleNo] = useState("");
  const [showOnlyM, setShowOnlyM] = useState(false);

  // 컬럼 그룹 토글
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(["basic", "info", "progress", "remark"])
  );

  useEffect(() => {
    fetch("/data/duvetica_fw_orderlist.json")
      .then((r) => r.json())
      .then((d: OrderListPayload) => {
        setPayload(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 필터 옵션
  const filterOptions = useMemo(() => {
    if (!payload) return { suppliers: [], staffList: [], categories: [] };
    const suppliers = [...new Set(payload.data.map((r) => r.supplier as string).filter(Boolean))].sort();
    const staffList = [...new Set(payload.data.map((r) => r.staff as string).filter(Boolean))].sort();
    const categories = [...new Set(payload.data.map((r) => r.category as string).filter(Boolean))].sort();
    return { suppliers, staffList, categories };
  }, [payload]);

  // 필터링
  const filteredData = useMemo(() => {
    if (!payload) return [];
    return payload.data.filter((r) => {
      if (filterSupplier && r.supplier !== filterSupplier) return false;
      if (filterStaff && r.staff !== filterStaff) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      if (filterStyleNo && !(r.style_no as string || "").toLowerCase().includes(filterStyleNo.toLowerCase())) return false;
      if (showOnlyM && r.is_m !== 1) return false;
      return true;
    });
  }, [payload, filterSupplier, filterStaff, filterCategory, filterStyleNo, showOnlyM]);

  const visibleColumns = useMemo(() => {
    if (!payload) return [];
    return payload.columns.filter((c) => visibleGroups.has(c.group));
  }, [payload, visibleGroups]);

  // 편집
  const startEdit = useCallback((row: number, key: string, currentVal: unknown) => {
    setEditingCell({ row, key });
    setEditValue(currentVal != null ? String(currentVal) : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell || !payload) return;
    const { row, key } = editingCell;
    const colDef = payload.columns.find((c) => c.key === key);
    let finalValue: unknown = editValue.trim() || null;
    if (colDef?.type === "number" && finalValue) {
      finalValue = Number(finalValue);
      if (isNaN(finalValue as number)) finalValue = editValue.trim();
    }

    // 로컬 데이터 업데이트
    const dataIdx = payload.data.findIndex((r) => r._row === row);
    if (dataIdx >= 0) {
      const updated = { ...payload };
      updated.data = [...updated.data];
      updated.data[dataIdx] = { ...updated.data[dataIdx], [key]: finalValue };
      setPayload(updated);
    }

    // pending changes에 추가
    const changeKey = `${row}:${key}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(changeKey, { _row: row, field: key, value: finalValue });
      return next;
    });

    setEditingCell(null);
  }, [editingCell, editValue, payload]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    else if (e.key === "Escape") cancelEdit();
  }, [commitEdit, cancelEdit]);

  // 저장
  const saveChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const updates = [...pendingChanges.values()];
      const res = await fetch("/api/fw-orderlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      if (result.ok) {
        setPendingChanges(new Map());
        setSaveMsg(`${result.changed}건 저장 완료`);
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg(`저장 실패: ${result.error}`);
      }
    } catch (e) {
      setSaveMsg(`저장 실패: ${e instanceof Error ? e.message : "Unknown"}`);
    }
    setSaving(false);
  }, [pendingChanges]);

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

  if (!payload || !payload.data.length) {
    return <div className="text-center text-slate-400 py-16">데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-7 rounded-full bg-sky-500" />
          <h2 className="text-lg font-bold text-slate-800">26FW 스타일/칼라별 진행현황</h2>
          <span className="text-xs text-slate-400">
            {filteredData.length} / {payload.data.length}건
            {payload.meta.synced_at && ` | 동기화: ${payload.meta.synced_at}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              {saving ? "저장 중..." : `저장 (${pendingChanges.size}건)`}
            </button>
          )}
          {saveMsg && (
            <span className={`text-xs font-medium ${saveMsg.includes("실패") ? "text-red-500" : "text-emerald-500"}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* 그룹 토글 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 mr-2">표시 항목</span>
        {Object.entries(GROUP_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setVisibleGroups((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            })}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
              visibleGroups.has(key)
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">전체 생산처</option>
            {filterOptions.suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">전체 담당자</option>
            {filterOptions.staffList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">전체 분류</option>
            {filterOptions.categories.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="STYLE NO. 검색"
            value={filterStyleNo}
            onChange={(e) => setFilterStyleNo(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white w-40 focus:outline-none focus:border-blue-400"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyM}
              onChange={(e) => setShowOnlyM(e.target.checked)}
              className="rounded border-slate-300"
            />
            M=1만
          </label>
          {(filterSupplier || filterStaff || filterCategory || filterStyleNo || showOnlyM) && (
            <button
              onClick={() => { setFilterSupplier(""); setFilterStaff(""); setFilterCategory(""); setFilterStyleNo(""); setShowOnlyM(false); }}
              className="text-[10px] text-red-400 hover:text-red-600 font-medium"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-[11px] border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-30">
              {/* 상위 헤더 (생산진행 그룹) */}
              <tr className="bg-slate-50 border-b border-slate-200">
                {/* basic 그룹 */}
                {visibleGroups.has("basic") && (
                  <th
                    colSpan={visibleColumns.filter((c) => c.group === "basic").length}
                    className="px-2 py-2 text-center text-[10px] font-bold text-slate-600 bg-slate-100 border-r border-slate-200"
                  >
                    기본정보
                  </th>
                )}
                {/* info 그룹 */}
                {visibleGroups.has("info") && (
                  <th
                    colSpan={visibleColumns.filter((c) => c.group === "info").length}
                    className="px-2 py-2 text-center text-[10px] font-bold text-indigo-600 bg-indigo-50 border-r border-slate-200"
                  >
                    생산처/담당
                  </th>
                )}
                {/* progress 그룹 — 스테이지별 서브 헤더 */}
                {visibleGroups.has("progress") && PROGRESS_STAGES.map((stage) => (
                  <th
                    key={stage.prefix}
                    colSpan={stage.cols.length}
                    className="px-1 py-2 text-center text-[10px] font-bold border-r border-slate-200"
                    style={{ color: stage.color, backgroundColor: `${stage.color}08` }}
                  >
                    {stage.label}
                  </th>
                ))}
                {/* remark 그룹 */}
                {visibleGroups.has("remark") && (
                  <th
                    colSpan={visibleColumns.filter((c) => c.group === "remark").length}
                    className="px-2 py-2 text-center text-[10px] font-bold text-amber-600 bg-amber-50 border-r border-slate-200"
                  >
                    비고/납기
                  </th>
                )}
                {/* md 그룹 */}
                {visibleGroups.has("md") && (
                  <th
                    colSpan={visibleColumns.filter((c) => c.group === "md").length}
                    className="px-2 py-2 text-center text-[10px] font-bold text-violet-600 bg-violet-50"
                  >
                    MD정보
                  </th>
                )}
              </tr>

              {/* 하위 헤더 (각 컬럼 라벨) */}
              <tr className="bg-white border-b border-slate-200">
                {visibleColumns.map((col, idx) => {
                  const gm = GROUP_META[col.group];
                  const isLastInGroup =
                    idx === visibleColumns.length - 1 ||
                    visibleColumns[idx + 1]?.group !== col.group;
                  // 생산진행 내 스테이지 경계
                  const isStageEnd = col.group === "progress" &&
                    PROGRESS_STAGES.some((s) => s.cols[s.cols.length - 1] === col.key);

                  return (
                    <th
                      key={col.key}
                      className={`px-1.5 py-2 text-center text-[10px] font-semibold text-slate-500 ${gm?.bgHeader || ""} ${
                        isLastInGroup || isStageEnd ? "border-r border-slate-200" : ""
                      } ${col.key === "style_no" || col.key === "style_name" ? "sticky left-0 z-20 bg-white" : ""}`}
                      style={col.key === "style_name" ? { left: "80px" } : undefined}
                    >
                      {col.label.replace("원단 ", "").replace("부자재 ", "").replace("재단 ", "").replace("투입 ", "").replace("생산완료 ", "").replace("입고 ", "")}
                      {col.editable && <span className="text-blue-400 ml-0.5">*</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row._row} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                  {visibleColumns.map((col, idx) => {
                    const val = row[col.key];
                    const isEditing = editingCell?.row === row._row && editingCell?.key === col.key;
                    const isPending = pendingChanges.has(`${row._row}:${col.key}`);
                    const isLastInGroup =
                      idx === visibleColumns.length - 1 ||
                      visibleColumns[idx + 1]?.group !== col.group;
                    const isStageEnd = col.group === "progress" &&
                      PROGRESS_STAGES.some((s) => s.cols[s.cols.length - 1] === col.key);

                    // 생산진행 셀 색상
                    let cellBg = "";
                    if (col.group === "progress" && col.key.endsWith("_done") && val) {
                      cellBg = "bg-emerald-50 text-emerald-700";
                    } else if (col.group === "progress" && col.key.endsWith("_plan") && val && !row[col.key.replace("_plan", "_done")]) {
                      if (isOverdue(val, null)) cellBg = "bg-red-50 text-red-600";
                      else cellBg = "bg-sky-50/50 text-sky-700";
                    }

                    // sticky columns
                    const isSticky = col.key === "style_no" || col.key === "style_name";
                    const stickyStyle = col.key === "style_name" ? { left: "80px" } : undefined;

                    // 편집 중
                    if (isEditing) {
                      return (
                        <td key={col.key} className="px-0 py-0">
                          <input
                            ref={inputRef}
                            type={col.type === "date" ? "date" : col.type === "number" ? "number" : "text"}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full px-1.5 py-1.5 text-[11px] border-2 border-blue-400 rounded bg-blue-50 focus:outline-none"
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-1.5 py-1.5 text-center font-mono tabular-nums ${cellBg} ${
                          isLastInGroup || isStageEnd ? "border-r border-slate-100" : ""
                        } ${col.editable ? "cursor-pointer hover:bg-blue-50" : ""} ${
                          isPending ? "ring-1 ring-blue-400 ring-inset" : ""
                        } ${isSticky ? "sticky z-10 bg-white" : ""}`}
                        style={stickyStyle}
                        onDoubleClick={() => col.editable && startEdit(row._row, col.key, val)}
                        title={col.editable ? "더블클릭으로 편집" : undefined}
                      >
                        {col.type === "date" || col.type === "date_or_text"
                          ? fmtDate(val)
                          : col.key === "is_m"
                          ? val === 1 ? <span className="text-emerald-500 font-bold">M</span> : ""
                          : col.key === "pcs" && val
                          ? Number(val).toLocaleString()
                          : val != null ? String(val) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 px-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> 완료</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-50 border border-sky-200" /> 예정</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 지연</span>
        <span className="flex items-center gap-1"><span className="text-blue-400 font-bold">*</span> 편집 가능 (더블클릭)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded ring-1 ring-blue-400" /> 수정 대기</span>
      </div>
    </div>
  );
}
