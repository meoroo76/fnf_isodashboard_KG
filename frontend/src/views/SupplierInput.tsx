"use client";

interface Props { brand: string; season: string; }

const INPUT_FIELDS = [
  { group: "기본 정보", fields: ["협력사코드", "협력사명", "국가", "담당자", "연락처"] },
  { group: "생산 정보", fields: ["생산능력(월)", "주요 생산품목", "주요 거래 브랜드", "인증 현황"] },
  { group: "거래 조건", fields: ["결제 조건", "리드타임(일)", "MOQ", "불량 보상 조건"] },
  { group: "평가 데이터", fields: ["납기준수율(%)", "클레임율(%)", "FPY 합격률(%)", "원가 경쟁력 점수"] },
];

export default function SupplierInput({ brand, season }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-cyan-500" />
        <h2 className="text-lg font-bold text-slate-800">데이터 입력</h2>
        <span className="text-sm text-slate-400">{season}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 flex items-center justify-center mb-4">
            <span className="text-3xl">📥</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">데이터 입력 기능 준비 중</h3>
          <p className="text-sm text-slate-400 max-w-md">
            협력사 데이터 직접 입력 및 일괄 업로드 기능이 준비되면 아래 항목을 입력하실 수 있습니다.
          </p>
        </div>

        {/* Expected input fields layout */}
        <div className="max-w-3xl mx-auto grid grid-cols-2 gap-6">
          {INPUT_FIELDS.map((group) => (
            <div key={group.group} className="rounded-xl border border-slate-100 p-5">
              <h4 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-cyan-400" />
                {group.group}
              </h4>
              <div className="space-y-2">
                {group.fields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <div className="flex-1 h-8 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center px-3">
                      <span className="text-xs text-slate-400">{field}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Upload area */}
        <div className="max-w-3xl mx-auto mt-6">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50">
            <div className="text-2xl mb-2">📄</div>
            <p className="text-sm text-slate-500 font-medium">엑셀 파일 일괄 업로드 (예정)</p>
            <p className="text-xs text-slate-400 mt-1">.xlsx, .csv 형식 지원 예정</p>
          </div>
        </div>
      </div>
    </div>
  );
}
