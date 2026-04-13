"use client";

import { cn } from "@/lib/utils";
import { formatDelta } from "@/lib/utils";

interface SubMetric {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  detail?: string;
}

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  delta?: number;
  prevValue?: string;
  accent?: string;
  sub?: SubMetric;
}

export default function KpiCard({
  label,
  value,
  unit,
  icon,
  delta,
  prevValue,
  accent = "#4f46e5",
  sub,
}: KpiCardProps) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5">
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
      />

      {/* ── 상단: 주요 지표 ── */}
      <div className="px-5 pt-5 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {icon && <span className="mr-1">{icon}</span>}
            {label}
          </span>
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold",
                delta > 0
                  ? "bg-red-50 text-red-600"
                  : delta < 0
                  ? "bg-blue-50 text-blue-600"
                  : "bg-slate-50 text-slate-500"
              )}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}
              {formatDelta(Math.abs(delta))}
            </span>
          )}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[28px] font-bold text-slate-900 tracking-tight"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-slate-400">{unit}</span>
          )}
        </div>

        {/* Prev value */}
        {prevValue && (
          <div className="text-[11px] text-slate-400 mt-1">
            <span className="font-medium">{prevValue}</span>
          </div>
        )}
      </div>

      {/* ── 하단: 진행률 (sub metric) ── */}
      {sub && (
        <div className="border-t border-dashed border-slate-100 px-5 py-3 bg-slate-50/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {sub.label}
            </span>
            {sub.delta !== undefined && (
              <span
                className={cn(
                  "text-[10px] font-bold",
                  sub.delta > 0
                    ? "text-emerald-600"
                    : sub.delta < 0
                    ? "text-red-500"
                    : "text-slate-400"
                )}
              >
                {sub.delta > 0 ? "▲" : sub.delta < 0 ? "▼" : "—"}
                {formatDelta(Math.abs(sub.delta))}
              </span>
            )}
          </div>

          {/* Progress bar + value */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(parseFloat(sub.value), 100)}%`,
                  background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                }}
              />
            </div>
            <div className="flex items-baseline gap-0.5 min-w-[52px] justify-end">
              <span
                className="text-lg font-bold text-slate-800"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {sub.value}
              </span>
              <span className="text-[10px] text-slate-400">{sub.unit || "%"}</span>
            </div>
          </div>

          {/* Detail */}
          {sub.detail && (
            <div className="text-[10px] text-slate-400 mt-1">{sub.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}
