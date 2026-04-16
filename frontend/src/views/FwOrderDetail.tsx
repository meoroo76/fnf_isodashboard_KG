"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";

// ── 타입 ──
interface ColDef { col: number; key: string; label: string; group: string; editable: boolean; type: string }
interface RowData { _row: number; [key: string]: unknown }
interface OrderListPayload { meta: { synced_at: string; row_count: number; last_edited?: string }; columns: ColDef[]; data: RowData[] }

// ── 그룹 메타 ──
const GROUP_META: Record<string, { label: string; color: string; bg: string }> = {
  basic:    { label: "기본정보",    color: "#334155", bg: "bg-slate-100" },
  info:     { label: "생산처/담당", color: "#4338ca", bg: "bg-indigo-50" },
  progress: { label: "생산진행",    color: "#0369a1", bg: "bg-sky-50" },
  remark:   { label: "비고/납기",   color: "#b45309", bg: "bg-amber-50" },
  md:       { label: "MD정보",      color: "#7c3aed", bg: "bg-violet-50" },
};

const PROGRESS_STAGES = [
  { label: "원단완료", color: "#8b5cf6", cols: ["fabric_plan", "fabric_done"] },
  { label: "부자재",   color: "#6366f1", cols: ["trim_plan", "trim_done"] },
  { label: "QC",       color: "#3b82f6", cols: ["qc_plan", "qc_done"] },
  { label: "PP",       color: "#0ea5e9", cols: ["pp_plan", "pp_done"] },
  { label: "재단/편직",color: "#14b8a6", cols: ["cutting_plan", "cutting_done"] },
  { label: "투입",     color: "#10b981", cols: ["putin_plan", "putin_done"] },
  { label: "생산완료", color: "#22c55e", cols: ["finish_plan", "finish_done"] },
  { label: "선적",     color: "#f59e0b", cols: ["ship_handover", "ship_plan", "ship_done"] },
  { label: "입고",     color: "#ef4444", cols: ["arrival_plan", "arrival_done"] },
];

// ── 틀고정: 복종(item_type)까지 좌측 고정 ──
const FROZEN_UP_TO = "item_type";

// ── 유틸 ──
function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  if (s.length === 10 && s[4] === "-") return s.slice(5);
  return s;
}
function isOverdue(plan: unknown, done: unknown): boolean {
  if (!plan || done) return false;
  const s = String(plan);
  return s.length === 10 && new Date(s) < new Date();
}

// ── 팝업 모달 (비고 등 긴 텍스트) ──
function TextModal({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">내용 편집</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)}
          className="flex-1 min-h-[200px] p-4 text-sm text-slate-700 resize-none focus:outline-none" />
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700">취소</button>
          <button onClick={() => { onSave(text); onClose(); }}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">저장</button>
        </div>
      </div>
    </div>
  );
}

// ── 열 필터 드롭다운 (헤더2행 각 열) ──
function ColumnFilter({ colKey, options, selected, onChange, anchor }: {
  colKey: string; options: string[]; selected: Set<string>;
  onChange: (s: Set<string>) => void; anchor: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isActive = selected.size > 0;

  return (
    <div ref={ref} className="inline-block relative ml-0.5">
      <button onClick={() => setOpen(!open)}
        className={`align-middle ${isActive ? "text-blue-500" : "text-slate-300 hover:text-slate-500"}`}
        title="필터">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className={`absolute top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[55] min-w-[130px] max-h-[260px] overflow-y-auto py-1 ${anchor === "right" ? "right-0" : "left-0"}`}>
          <div className="flex gap-2 px-3 py-1 border-b border-slate-100">
            <button onClick={() => onChange(new Set())} className="text-[10px] text-red-400 font-medium">해제</button>
            <button onClick={() => onChange(new Set(options))} className="text-[10px] text-blue-400 font-medium">전체</button>
          </div>
          {options.map((v) => (
            <label key={v} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(v)}
                onChange={() => { const n = new Set(selected); if (n.has(v)) n.delete(v); else n.add(v); onChange(n); }}
                className="rounded border-slate-300 w-3 h-3" />
              <span className="text-[10px] text-slate-700 truncate max-w-[120px]">{v || "(빈값)"}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════
export default function FwOrderDetail() {
  const [payload, setPayload] = useState<OrderListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, { _row: number; field: string; value: unknown }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [modalCell, setModalCell] = useState<{ row: number; key: string; value: string } | null>(null);

  // 열 필터 (각 컬럼별)
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  // 그룹 토글
  const [visibleGroups, setVisibleGroups] = useState<Set<string>>(new Set(["basic", "info", "progress", "remark"]));
  // 열 숨기기
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(["image", "arrival_yn", "marketing", "sku_count"]));
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  // M=1 필터
  const [showOnlyM, setShowOnlyM] = useState(false);
  // 스타일 검색
  const [filterStyleNo, setFilterStyleNo] = useState("");

  // 스크롤 동기화 ref
  const frozenBodyRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/data/duvetica_fw_orderlist.json")
      .then((r) => r.json())
      .then((d: OrderListPayload) => { setPayload(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // 스크롤 동기화 (좌우 세로 스크롤 연동)
  const syncScroll = useCallback((source: "frozen" | "scroll") => {
    const frozen = frozenBodyRef.current;
    const scroll = scrollBodyRef.current;
    if (!frozen || !scroll) return;
    if (source === "frozen") scroll.scrollTop = frozen.scrollTop;
    else frozen.scrollTop = scroll.scrollTop;
  }, []);

  // 담당자↔협력사 상호작용: 선택된 담당자의 협력사만 표시
  const staffSupplierMap = useMemo(() => {
    if (!payload) return new Map<string, Set<string>>();
    const map = new Map<string, Set<string>>();
    for (const r of payload.data) {
      const staff = r.staff as string;
      const sup = r.supplier as string;
      if (staff && sup) {
        if (!map.has(staff)) map.set(staff, new Set());
        map.get(staff)!.add(sup);
      }
    }
    return map;
  }, [payload]);

  // 각 열의 고유값 (필터 옵션)
  const colUniqueVals = useMemo(() => {
    if (!payload) return {};
    const result: Record<string, string[]> = {};
    for (const col of payload.columns) {
      const vals = [...new Set(payload.data.map((r) => {
        const v = r[col.key];
        return v != null ? String(v) : "";
      }).filter(Boolean))].sort();
      if (vals.length > 0 && vals.length <= 100) {
        result[col.key] = vals;
      }
    }
    return result;
  }, [payload]);

  // 협력사 필터 옵션: 담당자 선택 시 해당 협력사만
  const supplierFilterOptions = useMemo(() => {
    const staffFilter = colFilters["staff"];
    if (!staffFilter || staffFilter.size === 0) {
      return colUniqueVals["supplier"] || [];
    }
    const allowed = new Set<string>();
    for (const s of staffFilter) {
      const sups = staffSupplierMap.get(s);
      if (sups) sups.forEach((v) => allowed.add(v));
    }
    return [...allowed].sort();
  }, [colFilters, colUniqueVals, staffSupplierMap]);

  // 담당자 필터 옵션: 협력사 선택 시 해당 담당자만
  const staffFilterOptions = useMemo(() => {
    const supFilter = colFilters["supplier"];
    if (!supFilter || supFilter.size === 0) {
      return colUniqueVals["staff"] || [];
    }
    const allowed = new Set<string>();
    for (const [staff, sups] of staffSupplierMap) {
      for (const s of supFilter) {
        if (sups.has(s)) { allowed.add(staff); break; }
      }
    }
    return [...allowed].sort();
  }, [colFilters, colUniqueVals, staffSupplierMap]);

  // 필터링
  const filteredData = useMemo(() => {
    if (!payload) return [];
    return payload.data.filter((r) => {
      // 열별 필터
      for (const [key, selected] of Object.entries(colFilters)) {
        if (selected.size === 0) continue;
        const val = r[key] != null ? String(r[key]) : "";
        if (!selected.has(val)) return false;
      }
      if (showOnlyM && r.is_m !== 1) return false;
      if (filterStyleNo && !(r.style_no as string || "").toLowerCase().includes(filterStyleNo.toLowerCase())) return false;
      return true;
    });
  }, [payload, colFilters, showOnlyM, filterStyleNo]);

  // 보이는 컬럼
  const visibleColumns = useMemo(() => {
    if (!payload) return [];
    return payload.columns.filter((c) => visibleGroups.has(c.group) && !hiddenCols.has(c.key));
  }, [payload, visibleGroups, hiddenCols]);

  // 고정/스크롤 분리 (복종까지 고정)
  const frozenCols = useMemo(() => {
    const result: ColDef[] = [];
    for (const col of visibleColumns) {
      result.push(col);
      if (col.key === FROZEN_UP_TO) break;
    }
    return result;
  }, [visibleColumns]);

  const scrollCols = useMemo(() => {
    let found = false;
    return visibleColumns.filter((c) => {
      if (found) return true;
      if (c.key === FROZEN_UP_TO) { found = true; return false; }
      return false;
    });
  }, [visibleColumns]);

  // 편집
  const startEdit = useCallback((row: number, key: string, val: unknown) => {
    setEditingCell({ row, key });
    setEditValue(val != null ? String(val) : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const applyChange = useCallback((rowNum: number, key: string, value: unknown) => {
    if (!payload) return;
    const idx = payload.data.findIndex((r) => r._row === rowNum);
    if (idx >= 0) {
      const u = { ...payload, data: [...payload.data] };
      u.data[idx] = { ...u.data[idx], [key]: value };
      setPayload(u);
    }
    setPendingChanges((prev) => { const n = new Map(prev); n.set(`${rowNum}:${key}`, { _row: rowNum, field: key, value }); return n; });
  }, [payload]);

  const commitEdit = useCallback(() => {
    if (!editingCell || !payload) return;
    const col = payload.columns.find((c) => c.key === editingCell.key);
    let v: unknown = editValue.trim() || null;
    if (col?.type === "number" && v) { const n = Number(v); if (!isNaN(n)) v = n; }
    applyChange(editingCell.row, editingCell.key, v);
    setEditingCell(null);
  }, [editingCell, editValue, payload, applyChange]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit(); else if (e.key === "Escape") cancelEdit();
  }, [commitEdit, cancelEdit]);

  // 저장
  const saveChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/fw-orderlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify([...pendingChanges.values()]) });
      const result = await res.json();
      if (result.ok) { setPendingChanges(new Map()); setSaveMsg(`${result.changed}건 저장`); setTimeout(() => setSaveMsg(""), 3000); }
      else setSaveMsg(`실패: ${result.error}`);
    } catch (e) { setSaveMsg(`실패: ${e instanceof Error ? e.message : "Unknown"}`); }
    setSaving(false);
  }, [pendingChanges]);

  // 필터 업데이트 헬퍼
  const setColFilter = useCallback((key: string, selected: Set<string>) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (selected.size === 0) delete next[key]; else next[key] = selected;
      // 담당자 변경 시 협력사 필터 중 유효하지 않은 값 제거
      if (key === "staff" && next["supplier"]) {
        const allowed = new Set<string>();
        if (selected.size > 0) {
          for (const s of selected) { staffSupplierMap.get(s)?.forEach((v) => allowed.add(v)); }
          const cleaned = new Set([...next["supplier"]].filter((v) => allowed.has(v)));
          if (cleaned.size === 0) delete next["supplier"]; else next["supplier"] = cleaned;
        }
      }
      return next;
    });
  }, [staffSupplierMap]);

  const hasAnyFilter = Object.keys(colFilters).length > 0 || showOnlyM || filterStyleNo;
  const clearAll = () => { setColFilters({}); setShowOnlyM(false); setFilterStyleNo(""); };

  // ── 셀 렌더 ──
  const renderCell = (row: RowData, col: ColDef): ReactNode => {
    const val = row[col.key];
    const isEditing = editingCell?.row === row._row && editingCell?.key === col.key;
    const isLongText = col.key === "remark" || col.key === "md_history";

    let cellBg = "";
    if (col.group === "progress" && col.key.endsWith("_done") && val) cellBg = "bg-emerald-50 text-emerald-700";
    else if (col.group === "progress" && col.key.endsWith("_plan") && val && !row[col.key.replace("_plan", "_done")]) {
      cellBg = isOverdue(val, null) ? "bg-red-50 text-red-600" : "bg-sky-50/50 text-sky-700";
    }

    if (isEditing) return (
      <input ref={inputRef} type={col.type === "date" ? "date" : col.type === "number" ? "number" : "text"}
        value={editValue} onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit} onKeyDown={handleKeyDown}
        className="w-full px-1 py-1 text-[11px] border-2 border-blue-400 rounded bg-blue-50 focus:outline-none" />
    );

    if (isLongText) return (
      <div className="truncate max-w-[120px] cursor-pointer hover:text-blue-600"
        title={val ? String(val) : "클릭하여 편집"}
        onClick={() => setModalCell({ row: row._row, key: col.key, value: val ? String(val) : "" })}>
        {val ? String(val) : ""}
      </div>
    );

    const display = col.type === "date" || col.type === "date_or_text" ? fmtDate(val)
      : col.key === "is_m" ? (val === 1 ? <span className="text-emerald-500 font-bold">M</span> : "")
      : col.key === "pcs" && val ? Number(val).toLocaleString()
      : val != null ? String(val) : "";

    return (
      <span className={`${cellBg} ${col.editable ? "cursor-pointer" : ""}`}
        onDoubleClick={() => col.editable && startEdit(row._row, col.key, val)}>
        {display}
      </span>
    );
  };

  // ── 상위 헤더 그룹 생성 ──
  const buildTopHeader = (cols: ColDef[]): ReactNode[] => {
    const groups: { key: string; label: string; color: string; bg: string; count: number }[] = [];
    for (const col of cols) {
      if (col.group === "progress") {
        const stage = PROGRESS_STAGES.find((s) => s.cols.includes(col.key));
        const label = stage?.label || "";
        const last = groups[groups.length - 1];
        if (last && last.key === `progress-${label}`) { last.count++; }
        else groups.push({ key: `progress-${label}`, label, color: stage?.color || "#0369a1", bg: `${(stage?.color || "#0369a1")}08`, count: 1 });
      } else {
        const meta = GROUP_META[col.group];
        const last = groups[groups.length - 1];
        if (last && last.key === col.group) { last.count++; }
        else groups.push({ key: col.group, label: meta?.label || col.group, color: meta?.color || "#333", bg: "", count: 1 });
      }
    }
    return groups.map((g, i) => (
      <th key={`${g.key}-${i}`} colSpan={g.count}
        className={`px-1 py-1.5 text-center text-[10px] font-bold border-r border-slate-200 ${g.bg ? "" : GROUP_META[g.key]?.bg || "bg-slate-100"}`}
        style={g.bg ? { color: g.color, backgroundColor: g.bg } : { color: g.color }}>
        {g.label}
      </th>
    ));
  };

  // ── 하위 헤더 (필터 포함) ──
  const buildSubHeader = (cols: ColDef[], side: "left" | "right"): ReactNode => (
    <tr className="bg-white border-b border-slate-200">
      {cols.map((col) => {
        let shortLabel = col.label;
        for (const s of ["원단 ", "부자재 ", "재단 ", "투입 ", "생산완료 ", "입고 "]) shortLabel = shortLabel.replace(s, "");

        const filterOpts = col.key === "supplier" ? supplierFilterOptions
          : col.key === "staff" ? staffFilterOptions
          : colUniqueVals[col.key];
        const hasFilter = filterOpts && filterOpts.length > 1;

        return (
          <th key={col.key} className={`px-1 py-1.5 text-center text-[10px] font-semibold text-slate-500 ${GROUP_META[col.group]?.bg || ""}`}
            style={col.key === "remark" || col.key === "md_history" ? { maxWidth: "120px" } : undefined}>
            {shortLabel}
            {col.editable && <span className="text-blue-400 ml-0.5">*</span>}
            {hasFilter && (
              <ColumnFilter colKey={col.key} options={filterOpts!}
                selected={colFilters[col.key] || new Set()}
                onChange={(s) => setColFilter(col.key, s)}
                anchor={side === "left" ? "left" : "right"} />
            )}
          </th>
        );
      })}
    </tr>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        로딩 중...
      </div>
    </div>
  );
  if (!payload?.data.length) return <div className="text-center text-slate-400 py-16">데이터 없음</div>;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-7 rounded-full bg-sky-500" />
          <h2 className="text-lg font-bold text-slate-800">26FW 스타일/칼라별 진행현황</h2>
          <span className="text-xs text-slate-400">{filteredData.length} / {payload.data.length}건</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <button onClick={saveChanges} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
              {saving ? "저장 중..." : `저장 (${pendingChanges.size}건)`}
            </button>
          )}
          {saveMsg && <span className={`text-xs font-medium ${saveMsg.includes("실패") ? "text-red-500" : "text-emerald-500"}`}>{saveMsg}</span>}
        </div>
      </div>

      {/* 컨트롤: 그룹 토글 + 열 숨기기 + 전역 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(GROUP_META).map(([key, meta]) => (
          <button key={key} onClick={() => setVisibleGroups((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${visibleGroups.has(key) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"}`}>
            {meta.label}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-200" />
        <div ref={colPickerRef} className="relative">
          <button onClick={() => setShowColPicker(!showColPicker)}
            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center gap-1">
            열 {hiddenCols.size > 0 && <span className="text-red-400">({hiddenCols.size}숨김)</span>}
          </button>
          {showColPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[55] w-[240px] max-h-[380px] overflow-y-auto py-1">
              <div className="px-3 py-1 border-b border-slate-100">
                <button onClick={() => setHiddenCols(new Set())} className="text-[10px] text-blue-400 font-medium">전체 표시</button>
              </div>
              {payload.columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={!hiddenCols.has(col.key)}
                    onChange={() => { const n = new Set(hiddenCols); if (n.has(col.key)) n.delete(col.key); else n.add(col.key); setHiddenCols(n); }}
                    className="rounded border-slate-300 w-3 h-3" />
                  <span className="text-[10px] text-slate-600">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <input type="text" placeholder="STYLE NO." value={filterStyleNo} onChange={(e) => setFilterStyleNo(e.target.value)}
          className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] bg-white w-24 focus:outline-none focus:border-blue-400" />
        <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showOnlyM} onChange={(e) => setShowOnlyM(e.target.checked)} className="rounded border-slate-300 w-3 h-3" />
          M=1
        </label>
        {hasAnyFilter && <button onClick={clearAll} className="text-[10px] text-red-400 hover:text-red-600 font-medium">필터 초기화</button>}
      </div>

      {/* 틀고정 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex" style={{ height: "75vh" }}>
          {/* ── 좌측 고정 ── */}
          <div className="flex-shrink-0 border-r-2 border-slate-300 flex flex-col" style={{ zIndex: 20 }}>
            {/* 고정 헤더 */}
            <div className="flex-shrink-0">
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200">{buildTopHeader(frozenCols)}</tr>
                  {buildSubHeader(frozenCols, "left")}
                </thead>
              </table>
            </div>
            {/* 고정 바디 */}
            <div ref={frozenBodyRef} className="flex-1 overflow-y-auto overflow-x-hidden"
              onScroll={() => syncScroll("frozen")}
              style={{ scrollbarWidth: "none" }}>
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <tbody>
                  {filteredData.map((row) => (
                    <tr key={row._row} className="border-b border-slate-50 hover:bg-blue-50/30 h-[30px]">
                      {frozenCols.map((col) => {
                        const isPending = pendingChanges.has(`${row._row}:${col.key}`);
                        return (
                          <td key={col.key} className={`px-1.5 py-1 text-center font-mono tabular-nums text-[11px] ${isPending ? "ring-1 ring-blue-400 ring-inset" : ""} ${col.key === "style_name" ? "text-left max-w-[150px] truncate" : ""}`}>
                            {renderCell(row, col)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 우측 스크롤 ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 스크롤 헤더 */}
            <div className="flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}
              ref={(el) => {
                // 가로 스크롤 동기화를 위한 ref
                if (el) {
                  const body = scrollBodyRef.current;
                  if (body) {
                    el.onscroll = () => { body.scrollLeft = el.scrollLeft; };
                  }
                }
              }}>
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200">{buildTopHeader(scrollCols)}</tr>
                  {buildSubHeader(scrollCols, "right")}
                </thead>
              </table>
            </div>
            {/* 스크롤 바디 (가로+세로 스크롤바 표시) */}
            <div ref={scrollBodyRef} className="flex-1 overflow-auto"
              onScroll={() => syncScroll("scroll")}>
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <tbody>
                  {filteredData.map((row) => (
                    <tr key={row._row} className="border-b border-slate-50 hover:bg-blue-50/30 h-[30px]">
                      {scrollCols.map((col) => {
                        const isPending = pendingChanges.has(`${row._row}:${col.key}`);
                        const isStageEnd = col.group === "progress" && PROGRESS_STAGES.some((s) => s.cols[s.cols.length - 1] === col.key);
                        return (
                          <td key={col.key}
                            className={`px-1.5 py-1 text-center font-mono tabular-nums text-[11px] ${isStageEnd ? "border-r border-slate-100" : ""} ${isPending ? "ring-1 ring-blue-400 ring-inset" : ""}`}
                            style={col.key === "remark" || col.key === "md_history" ? { maxWidth: "120px" } : undefined}>
                            {renderCell(row, col)}
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
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 px-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> 완료</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-50 border border-sky-200" /> 예정</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 지연</span>
        <span><span className="text-blue-400 font-bold">*</span> 편집(더블클릭)</span>
        <span className="flex items-center gap-1"><svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg> 열 필터 (헤더 클릭)</span>
      </div>

      {/* 텍스트 모달 */}
      {modalCell && (
        <TextModal value={modalCell.value}
          onSave={(v) => applyChange(modalCell.row, modalCell.key, v || null)}
          onClose={() => setModalCell(null)} />
      )}
    </div>
  );
}
