"use client";

import { useMemo } from "react";

interface Props { brand: string; season: string; }

const CRITERIA = [
  { label: "납기", weight: 30, icon: "🚚", desc: "납기준수율, 입고 정시성", color: "#6366f1" },
  { label: "품질", weight: 30, icon: "🔍", desc: "클레임율, FPY 합격률, 불량 유형", color: "#10b981" },
  { label: "원가", weight: 20, icon: "💵", desc: "원가 경쟁력, M/U 수준", color: "#f59e0b" },
  { label: "대응력", weight: 10, icon: "🤝", desc: "커뮤니케이션, 긴급 대응, 유연성", color: "#8b5cf6" },
  { label: "준법", weight: 10, icon: "📜", desc: "법규 준수, 인증 보유, 환경 기준", color: "#0891b2" },
];

export default function SupplierEval({ brand, season }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-purple-500" />
        <h2 className="text-lg font-bold text-slate-800">협력사 평가</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      {/* Coming soon notice */}
      <div className="bg-white rounded-2xl border border-slate-100 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
            <span className="text-3xl">📝</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">평가 데이터 입력 기능 준비 중</h3>
          <p className="text-sm text-slate-400 max-w-md">
            협력사 종합 평가 입력 기능이 준비되면 아래 기준에 따라 평가를 진행하실 수 있습니다.
          </p>
        </div>

        {/* Evaluation criteria layout */}
        <div className="max-w-2xl mx-auto">
          <h4 className="text-sm font-bold text-slate-600 mb-4 text-center">평가 기준 구성</h4>
          <div className="space-y-3">
            {CRITERIA.map((c) => (
              <div key={c.label} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: `${c.color}15` }}>
                  {c.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{c.label}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full text-white" style={{ background: c.color }}>
                      {c.weight}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{c.desc}</p>
                </div>
                <div className="w-32">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.weight}%`, background: c.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-full">
              <span>합계</span>
              <span className="font-bold text-slate-600">100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
