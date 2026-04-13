"use client";

import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  group?: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
  colorCode?: (value: unknown, row: Record<string, unknown>) => string | undefined;
  width?: string;
}

interface ColumnGroup {
  label: string;
  colSpan: number;
  color?: string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  columnGroups?: ColumnGroup[];
  rowClassFn?: (row: Record<string, unknown>, idx: number) => string;
  stickyHeader?: boolean;
  compact?: boolean;
}

export default function DataTable({
  columns,
  data,
  columnGroups,
  rowClassFn,
  stickyHeader = false,
  compact = false,
}: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse">
        {columnGroups && (
          <thead>
            <tr>
              {columnGroups.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.colSpan}
                  className="text-center text-[11px] font-bold uppercase tracking-wider border-b-2 border-slate-200"
                  style={{
                    padding: "10px 8px",
                    background: g.color || "#f8fafc",
                    color: "#475569",
                  }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b-2 border-slate-200 bg-slate-50 whitespace-nowrap",
                  stickyHeader && "sticky top-0 z-10",
                  compact ? "px-2.5 py-2" : "px-3 py-2.5"
                )}
                style={{
                  textAlign: col.align || "right",
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={cn(
                "border-b border-slate-100 hover:bg-slate-50/50 transition-colors",
                rowClassFn?.(row, rowIdx)
              )}
            >
              {columns.map((col) => {
                const raw = row[col.key];
                const display = col.format ? col.format(raw, row) : String(raw ?? "");
                const cellColor = col.colorCode?.(raw, row);
                return (
                  <td
                    key={col.key}
                    className={cn(
                      "font-mono tabular-nums",
                      compact ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]",
                      col.align === "left"
                        ? "text-left font-sans font-medium text-slate-800"
                        : "text-right"
                    )}
                    style={{
                      backgroundColor: cellColor || undefined,
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
