"use client";

interface Props { brand: string; season: string; }

const REPORT_TEMPLATES = [
  { name: "시즌 소싱 리포트", desc: "시즌별 발주/입고/원가 종합 분석", icon: "📊", status: "준비 중" },
  { name: "협력사 평가 리포트", desc: "협력사별 납기/품질/원가 종합 성적표", icon: "🏭", status: "준비 중" },
  { name: "원가 분석 리포트", desc: "카테고리별 원가 구조 및 M/U 분석", icon: "💵", status: "준비 중" },
  { name: "클레임 분석 리포트", desc: "불량 유형별 클레임 현황 및 추이", icon: "⚠️", status: "준비 중" },
  { name: "QC 검사 리포트", desc: "검사 합격률 및 불량 상세 분석", icon: "🔍", status: "준비 중" },
  { name: "시즌 비교 리포트", desc: "다시즌 원가/M/U 비교 트렌드", icon: "📈", status: "준비 중" },
];

export default function ReportGen({ brand, season }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-rose-500" />
        <h2 className="text-lg font-bold text-slate-800">리포트 생성</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
            <span className="text-3xl">📑</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">리포트 생성 기능 준비 중</h3>
          <p className="text-sm text-slate-400 max-w-md">
            대시보드 데이터를 기반으로 PPTX/PDF 리포트를 자동 생성하는 기능이 준비 중입니다.
          </p>
        </div>

        {/* Report template preview */}
        <div className="max-w-3xl mx-auto">
          <h4 className="text-sm font-bold text-slate-600 mb-4">리포트 템플릿 미리보기</h4>
          <div className="grid grid-cols-2 gap-4">
            {REPORT_TEMPLATES.map((tpl) => (
              <div
                key={tpl.name}
                className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 opacity-60"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-xl shrink-0">
                  {tpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{tpl.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">
                      {tpl.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{tpl.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export options preview */}
        <div className="max-w-3xl mx-auto mt-6">
          <h4 className="text-sm font-bold text-slate-600 mb-3">내보내기 형식 (예정)</h4>
          <div className="flex items-center gap-4 justify-center">
            {[
              { format: "PPTX", icon: "📊", color: "#c2410c" },
              { format: "PDF", icon: "📄", color: "#dc2626" },
              { format: "XLSX", icon: "📗", color: "#16a34a" },
            ].map((f) => (
              <div
                key={f.format}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-200 text-slate-400"
              >
                <span>{f.icon}</span>
                <span className="text-sm font-medium">{f.format}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
