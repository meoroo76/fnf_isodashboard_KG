"use client";

import { cn } from "@/lib/utils";
import { formatDelta } from "@/lib/utils";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  delta?: number;
  deltaLabel?: string;
  prevValue?: string;
  sparkData?: number[];
  accent?: string;
  size?: "default" | "large";
}

export default function KpiCard({
  label,
  value,
  unit,
  icon,
  delta,
  deltaLabel,
  prevValue,
  sparkData,
  accent = "#4f46e5",
  size = "default",
}: KpiCardProps) {
  const sparkChartData = sparkData?.map((v, i) => ({ v, i }));

  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 group",
        size === "large" ? "p-6" : "p-5"
      )}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          className={cn(
            "font-bold text-slate-900 tracking-tight",
            size === "large" ? "text-3xl" : "text-2xl"
          )}
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
        <div className="text-[11px] text-slate-400 mb-3">
          <span className="text-slate-500">{deltaLabel || "전년"}</span>{" "}
          <span className="font-medium">{prevValue}</span>
        </div>
      )}

      {/* Sparkline */}
      {sparkChartData && sparkChartData.length > 0 && (
        <div className="h-10 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkChartData}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={accent}
                strokeWidth={2}
                fill={`url(#spark-${label})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
