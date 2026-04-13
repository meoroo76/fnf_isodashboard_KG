"use client";

import { useMemo } from "react";
import KpiCard from "@/components/KpiCard";

interface Props { brand: string; season: string; }

export default function QcResults({ brand, season }: Props) {
  const kpis = useMemo(() => [
    { label: "FPY 합격률", value: "-", unit: "%", icon: "✅", delta: 0, prevValue: "데이터 연동 예정", accent: "#059669" },
    { label: "AQL 합격률", value: "-", unit: "%", icon: "🔍", delta: 0, prevValue: "데이터 연동 예정", accent: "#2563eb" },
    { label: "DHU", value: "-", unit: "", icon: "📏", delta: 0, prevValue: "데이터 연동 예정", accent: "#f59e0b" },
    { label: "검사건수", value: "-", unit: "건", icon: "📋", delta: 0, prevValue: "데이터 연동 예정", accent: "#6366f1" },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-bold text-slate-800">QC 검사 결과</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl border border-slate-100 p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <span className="text-3xl">🔬</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">검사 데이터 연동 예정</h3>
          <p className="text-sm text-slate-400 max-w-md">
            QC 검사 결과 데이터가 연동되면 FPY 합격률, AQL 합격률, DHU 지표 및
            검사 이력을 확인하실 수 있습니다.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 w-full max-w-lg">
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-left">
              <div className="text-xs font-semibold text-slate-400 mb-1">예정 지표</div>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>FPY (First Pass Yield)</li>
                <li>AQL 검사 합격률</li>
                <li>DHU (Defects per Hundred Units)</li>
                <li>협력사별 검사 현황</li>
              </ul>
            </div>
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-left">
              <div className="text-xs font-semibold text-slate-400 mb-1">예정 기능</div>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>검사 이력 조회</li>
                <li>불량 유형별 분석</li>
                <li>협력사 품질 트렌드</li>
                <li>시즌별 비교</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
