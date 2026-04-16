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
const GROUP_META: Record<string, { label: string; color: string; bgHeader: string; bgTopHeader: string }> = {
  basic:    { label: "기본정보",    color: "#334155", bgHeader: "bg-slate-50",  bgTopHeader: "bg-slate-100" },
  info:     { label: "생산처/담당", color: "#4338ca", bgHeader: "bg-indigo-50/50", bgTopHeader: "bg-indigo-50" },
  progress: { label: "생산진행",    color: "#0369a1", bgHeader: "bg-sky-50/50",    bgTopHeader: "bg-sky-50" },
  remark:   { label: "비고/납기",   color: "#b45309", bgHeader: "bg-amber-50/50",  bgTopHeader: "bg-amber-50" },
  md:       { label: "MD정보",      color: "#7c3aed", bgHeader: "bg-violet-50/50", bgTopHeader: "bg-violet-50" },
};

// 생산진행 서브그룹
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

// 틀고정할 왼쪽 고정 컬럼 키 (기본정보 + 생산처/담당 까지)
const FROZEN_KEYS = new Set(["style_no", "style_name", "color", "pcs", "supplier", "staff"]);

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

// ── 팝업 모달 ──
function TextModal({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">내용 편집</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 min-h-[200px] p-4 text-sm text-slate-700 resize-none focus:outline-none"
        />
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700">취소</button>
          <button
            onClick={() => { onSave(text); onClose(); }}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
          >저장</button>
        </div>
      </div>
    </div>
  );
}

// ── 체크박스 드롭다운 필터 ──
function CheckboxFilter({
  label, options, selected, onChange
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayLabel = selected.size > 0 ? `${label} (${selected.size})` : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2.5 py-1.5 border rounded-lg text-[10px] font-medium flex items-center gap-1 transition-all ${
          selected.size > 0
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {displayLabel}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[140px] max-h-[280px] overflow-y-auto py-1">
          <button
            onClick={() => { onChange(new Set()); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-red-400 hover:bg-red-50 font-medium"
          >전체 해제</button>
          <button
            onClick={() => { onChange(new Set(options)); }}
            className="w-full px-3 py-1.5 text-left text-[10px] text-blue-400 hover:bg-blue-50 font-medium border-b border-slate-100 mb-1"
          >전체 선택</button>
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => {
                  const next = new Set(selected);
                  if (next.has(opt)) next.delete(opt); else next.add(opt);
                  onChange(next);
                }}
                className="rounded border-slate-300 w-3.5 h-3.5"
              />
              <span className="text-[11px] text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function FwOrderDetail() {
  const [payload, setPayload] = useState<OrderListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, { _row: number; field: string; value: unknown }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 텍스트 모달
  const [modalCell, setModalCell] = useState<{ row: number; key: string; value: string } | null>(null);

  // 필터 (체크박스 복수선택)
  const [filterSupplier, setFilterSupplier] = useState<Set<string>>(new Set());
  const [filterStaff, setFilterStaff] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<Set<string>>(new Set());
  const [filterGender, setFilterGender] = useState<Set<string>>(new Set());
  const [filterItemType, setFilterItemType] = useState<Set<string>>(new Set());
  const [filterStyleNo, setFilterStyleNo] = useState("");
  const [showOnlyM, setShowOnlyM] = useState(false);

  // 컬럼 숨기기
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(["image", "arrival_yn", "marketing", "sku_count"]));
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // 그룹 토글
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(
    new Set(["basic", "info", "progress", "remark"])
  );

  useEffect(() => {
    fetch("/data/duvetica_fw_orderlist.json")
      .then((r) => r.json())
      .then((d: OrderListPayload) => { setPayload(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 필터 옵션
  const filterOptions = useMemo(() => {
    if (!payload) return { suppliers: [], staffList: [], categories: [], genders: [], itemTypes: [] };
    const suppliers = [...new Set(payload.data.map((r) => r.supplier as string).filter(Boolean))].sort();
    const staffList = [...new Set(payload.data.map((r) => r.staff as string).filter(Boolean))].sort();
    const categories = [...new Set(payload.data.map((r) => r.category as string).filter(Boolean))].sort();
    const genders = [...new Set(payload.data.map((r) => r.gender as string).filter(Boolean))].sort();
    const itemTypes = [...new Set(payload.data.map((r) => r.item_type as string).filter(Boolean))].sort();
    return { suppliers, staffList, categories, genders, itemTypes };
  }, [payload]);

  // 필터링
  const filteredData = useMemo(() => {
    if (!payload) return [];
    return payload.data.filter((r) => {
      if (filterSupplier.size > 0 && !filterSupplier.has(r.supplier as string)) return false;
      if (filterStaff.size > 0 && !filterStaff.has(r.staff as string)) return false;
      if (filterCategory.size > 0 && !filterCategory.has(r.category as string)) return false;
      if (filterGender.size > 0 && !filterGender.has(r.gender as string)) return false;
      if (filterItemType.size > 0 && !filterItemType.has(r.item_type as string)) return false;
      if (filterStyleNo && !(r.style_no as string || "").toLowerCase().includes(filterStyleNo.toLowerCase())) return false;
      if (showOnlyM && r.is_m !== 1) return false;
      return true;
    });
  }, [payload, filterSupplier, filterStaff, filterCategory, filterGender, filterItemType, filterStyleNo, showOnlyM]);

  const visibleColumns = useMemo(() => {
    if (!payload) return [];
    return payload.columns.filter((c) => visibleGroups.has(c.group) && !hiddenCols.has(c.key));
  }, [payload, visibleGroups, hiddenCols]);

  // 고정/스크롤 컬럼 분리
  const frozenCols = useMemo(() => visibleColumns.filter((c) => FROZEN_KEYS.has(c.key)), [visibleColumns]);
  const scrollCols = useMemo(() => visibleColumns.filter((c) => !FROZEN_KEYS.has(c.key)), [visibleColumns]);

  // 편집
  const startEdit = useCallback((row: number, key: string, currentVal: unknown) => {
    setEditingCell({ row, key });
    setEditValue(currentVal != null ? String(currentVal) : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const applyChange = useCallback((rowNum: number, key: string, value: unknown) => {
    if (!payload) return;
    const dataIdx = payload.data.findIndex((r) => r._row === rowNum);
    if (dataIdx >= 0) {
      const updated = { ...payload };
      updated.data = [...updated.data];
      updated.data[dataIdx] = { ...updated.data[dataIdx], [key]: value };
      setPayload(updated);
    }
    const changeKey = `${rowNum}:${key}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(changeKey, { _row: rowNum, field: key, value });
      return next;
    });
  }, [payload]);

  const commitEdit = useCallback(() => {
    if (!editingCell || !payload) return;
    const { row, key } = editingCell;
    const colDef = payload.columns.find((c) => c.key === key);
    let finalValue: unknown = editValue.trim() || null;
    if (colDef?.type === "number" && finalValue) {
      finalValue = Number(finalValue);
      if (isNaN(finalValue as number)) finalValue = editValue.trim();
    }
    applyChange(row, key, finalValue);
    setEditingCell(null);
  }, [editingCell, editValue, payload, applyChange]);

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

  // 필터 초기화
  const hasAnyFilter = filterSupplier.size > 0 || filterStaff.size > 0 || filterCategory.size > 0 || filterGender.size > 0 || filterItemType.size > 0 || filterStyleNo || showOnlyM;
  const clearAllFilters = () => {
    setFilterSupplier(new Set()); setFilterStaff(new Set()); setFilterCategory(new Set());
    setFilterGender(new Set()); setFilterItemType(new Set()); setFilterStyleNo(""); setShowOnlyM(false);
  };

  // 셀 렌더링 (고정/스크롤 공용)
  const renderCell = (row: RowData, col: ColDef, isPending: boolean) => {
    const val = row[col.key];
    const isEditing = editingCell?.row === row._row && editingCell?.key === col.key;

    // 비고/remark 긴 텍스트: 클릭 → 모달
    const isLongText = col.key === "remark" || col.key === "md_history";

    // 셀 배경색
    let cellBg = "";
    if (col.group === "progress" && col.key.endsWith("_done") && val) {
      cellBg = "bg-emerald-50 text-emerald-700";
    } else if (col.group === "progress" && col.key.endsWith("_plan") && val && !row[col.key.replace("_plan", "_done")]) {
      if (isOverdue(val, null)) cellBg = "bg-red-50 text-red-600";
      else cellBg = "bg-sky-50/50 text-sky-700";
    }

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={col.type === "date" ? "date" : col.type === "number" ? "number" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-1 py-1 text-[11px] border-2 border-blue-400 rounded bg-blue-50 focus:outline-none"
        />
      );
    }

    // 비고 셀: 줄인 너비 + 클릭 → 모달
    if (isLongText) {
      return (
        <div
          className={`truncate max-w-[120px] cursor-pointer hover:text-blue-600 ${cellBg}`}
          title={val ? String(val) : "클릭하여 편집"}
          onClick={() => setModalCell({ row: row._row, key: col.key, value: val ? String(val) : "" })}
        >
          {val ? String(val) : ""}
        </div>
      );
    }

    const displayVal = col.type === "date" || col.type === "date_or_text"
      ? fmtDate(val)
      : col.key === "is_m"
      ? val === 1 ? <span className="text-emerald-500 font-bold">M</span> : ""
      : col.key === "pcs" && val
      ? Number(val).toLocaleString()
      : val != null ? String(val) : "";

    return (
      <span
        className={`${cellBg} ${col.editable && !isLongText ? "cursor-pointer" : ""}`}
        onDoubleClick={() => col.editable && startEdit(row._row, col.key, val)}
      >
        {displayVal}
      </span>
    );
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
  if (!payload || !payload.data.length) {
    return <div className="text-center text-slate-400 py-16">데이터가 없습니다.</div>;
  }

  const GENDER_LABELS: Record<string, string> = { D: "여성", U: "남녀공용", X: "남성" };

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-7 rounded-full bg-sky-500" />
          <h2 className="text-lg font-bold text-slate-800">26FW 스타일/칼라별 진행현황</h2>
          <span className="text-xs text-slate-400">
            {filteredData.length} / {payload.data.length}건
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
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

      {/* 그룹 토글 + 열 숨기기 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 mr-1">그룹</span>
          {Object.entries(GROUP_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setVisibleGroups((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              })}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                visibleGroups.has(key) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-slate-200" />
        {/* 열 숨기기 */}
        <div ref={colPickerRef} className="relative">
          <button
            onClick={() => setShowColPicker(!showColPicker)}
            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center gap-1"
          >
            열 표시/숨기기
            {hiddenCols.size > 0 && <span className="text-red-400">({hiddenCols.size}개 숨김)</span>}
          </button>
          {showColPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-[260px] max-h-[400px] overflow-y-auto py-1">
              <div className="px-3 py-1.5 flex gap-2 border-b border-slate-100">
                <button onClick={() => setHiddenCols(new Set())} className="text-[10px] text-blue-400 hover:text-blue-600 font-medium">전체 표시</button>
              </div>
              {payload.columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hiddenCols.has(col.key)}
                    onChange={() => {
                      const next = new Set(hiddenCols);
                      if (next.has(col.key)) next.delete(col.key); else next.add(col.key);
                      setHiddenCols(next);
                    }}
                    className="rounded border-slate-300 w-3 h-3"
                  />
                  <span className="text-[10px] text-slate-600">{col.label}</span>
                  <span className="text-[9px] text-slate-300 ml-auto">{col.group}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 필터 (헤더 2행에 체크박스 드롭다운) */}
      <div className="flex items-center gap-2 flex-wrap">
        <CheckboxFilter label="생산처" options={filterOptions.suppliers} selected={filterSupplier} onChange={setFilterSupplier} />
        <CheckboxFilter label="담당자" options={filterOptions.staffList} selected={filterStaff} onChange={setFilterStaff} />
        <CheckboxFilter label="분류" options={filterOptions.categories} selected={filterCategory} onChange={setFilterCategory} />
        <CheckboxFilter label="성별" options={filterOptions.genders.map((g) => g)} selected={filterGender} onChange={setFilterGender} />
        <CheckboxFilter label="복종" options={filterOptions.itemTypes} selected={filterItemType} onChange={setFilterItemType} />
        <input
          type="text"
          placeholder="STYLE NO."
          value={filterStyleNo}
          onChange={(e) => setFilterStyleNo(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[10px] bg-white w-28 focus:outline-none focus:border-blue-400"
        />
        <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showOnlyM} onChange={(e) => setShowOnlyM(e.target.checked)} className="rounded border-slate-300 w-3 h-3" />
          M=1
        </label>
        {hasAnyFilter && (
          <button onClick={clearAllFilters} className="text-[10px] text-red-400 hover:text-red-600 font-medium">초기화</button>
        )}
      </div>

      {/* 틀고정 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex" style={{ maxHeight: "75vh" }}>
          {/* 왼쪽 고정 영역 */}
          <div className="flex-shrink-0 overflow-hidden border-r-2 border-slate-300" style={{ zIndex: 20 }}>
            <div className="overflow-y-hidden" style={{ maxHeight: "75vh" }}>
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th colSpan={frozenCols.length} className="px-2 py-2 text-center text-[10px] font-bold text-slate-600">
                      고정
                    </th>
                  </tr>
                  <tr className="bg-white border-b border-slate-200">
                    {frozenCols.map((col) => (
                      <th key={col.key} className="px-2 py-2 text-center text-[10px] font-semibold text-slate-500 bg-slate-50">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row) => (
                    <tr key={row._row} className="border-b border-slate-50 hover:bg-blue-50/30 h-[32px]">
                      {frozenCols.map((col) => {
                        const isPending = pendingChanges.has(`${row._row}:${col.key}`);
                        return (
                          <td key={col.key} className={`px-2 py-1 text-center font-mono tabular-nums ${isPending ? "ring-1 ring-blue-400 ring-inset" : ""} ${col.key === "style_name" ? "text-left max-w-[160px] truncate" : ""}`}>
                            {renderCell(row, col, isPending)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 오른쪽 스크롤 영역 */}
          <div className="flex-1 overflow-auto" style={{ maxHeight: "75vh" }}>
            <table className="text-[11px] border-collapse whitespace-nowrap w-full">
              <thead className="sticky top-0 z-20">
                {/* 상위 헤더 */}
                <tr className="border-b border-slate-200">
                  {(() => {
                    const groups: { group: string; count: number; stageIdx?: number }[] = [];
                    for (const col of scrollCols) {
                      if (col.group === "progress") {
                        const stageIdx = PROGRESS_STAGES.findIndex((s) => s.cols.includes(col.key));
                        const last = groups[groups.length - 1];
                        if (last && last.group === "progress" && last.stageIdx === stageIdx) {
                          last.count++;
                        } else {
                          groups.push({ group: "progress", count: 1, stageIdx });
                        }
                      } else {
                        const last = groups[groups.length - 1];
                        if (last && last.group === col.group) {
                          last.count++;
                        } else {
                          groups.push({ group: col.group, count: 1 });
                        }
                      }
                    }
                    return groups.map((g, i) => {
                      if (g.group === "progress" && g.stageIdx !== undefined) {
                        const stage = PROGRESS_STAGES[g.stageIdx];
                        return (
                          <th key={`${g.group}-${i}`} colSpan={g.count}
                            className="px-1 py-2 text-center text-[10px] font-bold border-r border-slate-200"
                            style={{ color: stage.color, backgroundColor: `${stage.color}08` }}
                          >{stage.label}</th>
                        );
                      }
                      const meta = GROUP_META[g.group];
                      return (
                        <th key={`${g.group}-${i}`} colSpan={g.count}
                          className={`px-2 py-2 text-center text-[10px] font-bold border-r border-slate-200 ${meta?.bgTopHeader || ""}`}
                          style={{ color: meta?.color }}
                        >{meta?.label || g.group}</th>
                      );
                    });
                  })()}
                </tr>
                {/* 컬럼 라벨 */}
                <tr className="bg-white border-b border-slate-200">
                  {scrollCols.map((col) => {
                    const gm = GROUP_META[col.group];
                    // 간결한 라벨
                    let shortLabel = col.label;
                    for (const strip of ["원단 ", "부자재 ", "재단 ", "투입 ", "생산완료 ", "입고 "]) {
                      shortLabel = shortLabel.replace(strip, "");
                    }
                    return (
                      <th key={col.key} className={`px-1.5 py-2 text-center text-[10px] font-semibold text-slate-500 ${gm?.bgHeader || ""}`}
                        style={col.key === "remark" || col.key === "md_history" ? { maxWidth: "120px" } : undefined}
                      >
                        {shortLabel}
                        {col.editable && <span className="text-blue-400 ml-0.5">*</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row._row} className="border-b border-slate-50 hover:bg-blue-50/30 h-[32px]">
                    {scrollCols.map((col) => {
                      const isPending = pendingChanges.has(`${row._row}:${col.key}`);
                      const isStageEnd = col.group === "progress" &&
                        PROGRESS_STAGES.some((s) => s.cols[s.cols.length - 1] === col.key);
                      return (
                        <td key={col.key}
                          className={`px-1.5 py-1 text-center font-mono tabular-nums ${
                            isStageEnd ? "border-r border-slate-100" : ""
                          } ${isPending ? "ring-1 ring-blue-400 ring-inset" : ""}`}
                          style={col.key === "remark" || col.key === "md_history" ? { maxWidth: "120px" } : undefined}
                        >
                          {renderCell(row, col, isPending)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* 텍스트 모달 */}
      {modalCell && (
        <TextModal
          value={modalCell.value}
          onSave={(v) => applyChange(modalCell.row, modalCell.key, v || null)}
          onClose={() => setModalCell(null)}
        />
      )}
    </div>
  );
}
