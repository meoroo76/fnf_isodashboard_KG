"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Package,
  DollarSign,
  Search,
  Factory,
  ChevronDown,
  BarChart3,
  Truck,
  FileText,
  PenLine,
  PieChart,
  Layers,
  TrendingUp,
  GitCompare,
  AlertCircle,
  Bug,
  ClipboardCheck,
  MessageSquare,
  Award,
  Trophy,
  Eye,
  Star,
} from "lucide-react";

interface MenuItem {
  label: string;
  key: string;
  icon: React.ReactNode;
}

interface MenuCategory {
  label: string;
  key: string;
  icon: React.ReactNode;
  pages: MenuItem[];
}

const MENU: MenuCategory[] = [
  {
    label: "생산",
    key: "production",
    icon: <Package size={18} />,
    pages: [
      { label: "오더 현황", key: "order_dashboard", icon: <BarChart3 size={16} /> },
      { label: "납기 관리", key: "delivery_mgmt", icon: <Truck size={16} /> },
      { label: "데이터 입력", key: "supplier_input", icon: <PenLine size={16} /> },
      { label: "리포트", key: "report_gen", icon: <FileText size={16} /> },
    ],
  },
  {
    label: "원가",
    key: "cost",
    icon: <DollarSign size={18} />,
    pages: [
      { label: "원가 총괄", key: "cost_overview", icon: <PieChart size={16} /> },
      { label: "원가 구성", key: "cost_breakdown", icon: <Layers size={16} /> },
      { label: "마크업 분석", key: "markup_analysis", icon: <TrendingUp size={16} /> },
      { label: "시즌 비교", key: "season_compare", icon: <GitCompare size={16} /> },
    ],
  },
  {
    label: "품질",
    key: "quality",
    icon: <Search size={18} />,
    pages: [
      { label: "클레임 현황", key: "claim_dashboard", icon: <AlertCircle size={16} /> },
      { label: "불량 분석", key: "defect_analysis", icon: <Bug size={16} /> },
      { label: "검사 결과", key: "qc_results", icon: <ClipboardCheck size={16} /> },
      { label: "매장 VOC", key: "voc_analysis", icon: <MessageSquare size={16} /> },
    ],
  },
  {
    label: "협력사",
    key: "supplier",
    icon: <Factory size={18} />,
    pages: [
      { label: "오더 현황", key: "supplier_order", icon: <BarChart3 size={16} /> },
      { label: "26FW 진행상세", key: "fw_order_detail", icon: <ClipboardCheck size={16} /> },
      { label: "스코어카드", key: "scorecard", icon: <Award size={16} /> },
      { label: "랭킹", key: "ranking", icon: <Trophy size={16} /> },
      { label: "상세 분석", key: "detail_panel", icon: <Eye size={16} /> },
      { label: "평가 입력", key: "evaluation", icon: <Star size={16} /> },
    ],
  },
];

interface Brand {
  name: string;
  code: string;
  icon: string;
}

const BRANDS: Brand[] = [
  { name: "DUVETICA", code: "V", icon: "🦆" },
  { name: "SERGIO TACCHINI", code: "ST", icon: "🎾" },
];

const SEASONS = ["26F", "26S", "25F", "25S", "24F"];

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
  brand: string;
  onBrandChange: (code: string) => void;
  season: string;
  onSeasonChange: (s: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  activePage,
  onPageChange,
  brand,
  onBrandChange,
  season,
  onSeasonChange,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["production"])
  );

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className={`${collapsed ? "w-[56px]" : "w-[240px]"} min-h-screen bg-[#0f172a] text-slate-300 flex flex-col fixed left-0 top-0 bottom-0 z-40 transition-all duration-200`}>
      {/* Logo + 접기 버튼 */}
      <div className={`${collapsed ? "px-2" : "px-5"} pt-6 pb-4`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0 hover:opacity-90 transition-opacity"
            title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            🏭
          </button>
          {!collapsed && (
            <div>
              <div className="text-[10px] font-bold text-indigo-400 tracking-[2px] uppercase">
                ISO AI AGENT
              </div>
              <div className="text-sm font-semibold text-white">SCM Dashboard</div>
            </div>
          )}
        </div>
      </div>

      {/* Brand Selector */}
      {collapsed ? (
        <div className="px-2 pb-3 flex flex-col gap-1">
          {BRANDS.map((b) => (
            <button key={b.code} onClick={() => onBrandChange(b.code)}
              className={cn("w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all",
                brand === b.code ? "bg-indigo-600 shadow-lg shadow-indigo-500/25" : "bg-slate-800/50 hover:bg-slate-700/50"
              )} title={b.name}>{b.icon}</button>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Brand</div>
          <div className="flex gap-1">
            {BRANDS.map((b) => (
              <button key={b.code} onClick={() => onBrandChange(b.code)}
                className={cn("flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                  brand === b.code ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                )}>{b.icon} {b.name.split(" ")[0]}</button>
            ))}
          </div>
        </div>
      )}

      {/* Season Selector */}
      {collapsed ? (
        <div className="px-2 pb-3">
          <select value={season} onChange={(e) => onSeasonChange(e.target.value)}
            className="w-10 bg-slate-800/50 border border-slate-700 rounded-lg px-0.5 py-2 text-[10px] text-center text-slate-300 focus:outline-none focus:border-indigo-500">
            {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Season</div>
          <select value={season} onChange={(e) => onSeasonChange(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500">
            {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className={`h-px bg-slate-800 ${collapsed ? "mx-2" : "mx-4"}`} />

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-1.5" : "px-3"}`}>
        {MENU.map((cat) => (
          <div key={cat.key} className="mb-1">
            {collapsed ? (
              /* 접힌 상태: 카테고리 아이콘만 (클릭 시 첫 페이지로 이동) */
              <div className="flex flex-col items-center gap-0.5">
                <button onClick={() => onPageChange(cat.pages[0].key)}
                  className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    cat.pages.some((p) => p.key === activePage) ? "bg-indigo-600/20 text-indigo-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  )} title={cat.label}>{cat.icon}</button>
                {/* 활성 카테고리의 하위 페이지 아이콘 */}
                {cat.pages.some((p) => p.key === activePage) && cat.pages.map((page) => (
                  <button key={page.key} onClick={() => onPageChange(page.key)}
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      activePage === page.key ? "bg-indigo-600/20 text-indigo-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                    )} title={page.label}>{page.icon}</button>
                ))}
              </div>
            ) : (
              /* 펼친 상태: 기존 그대로 */
              <>
                <button onClick={() => toggleCategory(cat.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
                  <span className="flex items-center gap-2.5">{cat.icon}{cat.label}</span>
                  <ChevronDown size={14} className={cn("transition-transform", expandedCategories.has(cat.key) ? "rotate-0" : "-rotate-90")} />
                </button>
                {expandedCategories.has(cat.key) && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {cat.pages.map((page) => (
                      <button key={page.key} onClick={() => onPageChange(page.key)}
                        className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all",
                          activePage === page.key ? "bg-indigo-600/20 text-indigo-400 font-medium border-l-2 border-indigo-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                        )}>{page.icon}{page.label}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`${collapsed ? "px-2" : "px-5"} py-4 border-t border-slate-800`}>
        {collapsed ? (
          <div className="text-[9px] text-slate-600 text-center">v1.0</div>
        ) : (
          <div className="text-[11px] text-slate-600">v1.0.0 | F&F ISO AI Agent</div>
        )}
      </div>
    </aside>
  );
}
