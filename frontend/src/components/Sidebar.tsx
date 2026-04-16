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
}

export default function Sidebar({
  activePage,
  onPageChange,
  brand,
  onBrandChange,
  season,
  onSeasonChange,
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
    <aside className="w-[240px] min-h-screen bg-[#0f172a] text-slate-300 flex flex-col fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">
            🏭
          </div>
          <div>
            <div className="text-[10px] font-bold text-indigo-400 tracking-[2px] uppercase">
              ISO AI AGENT
            </div>
            <div className="text-sm font-semibold text-white">SCM Dashboard</div>
          </div>
        </div>
      </div>

      {/* Brand Selector */}
      <div className="px-4 pb-3">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
          Brand
        </div>
        <div className="flex gap-1">
          {BRANDS.map((b) => (
            <button
              key={b.code}
              onClick={() => onBrandChange(b.code)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                brand === b.code
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
              )}
            >
              {b.icon} {b.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Season Selector */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
          Season
        </div>
        <select
          value={season}
          onChange={(e) => onSeasonChange(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="h-px bg-slate-800 mx-4" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {MENU.map((cat) => (
          <div key={cat.key} className="mb-1">
            <button
              onClick={() => toggleCategory(cat.key)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                {cat.icon}
                {cat.label}
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform",
                  expandedCategories.has(cat.key) ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>

            {expandedCategories.has(cat.key) && (
              <div className="ml-2 mt-0.5 space-y-0.5">
                {cat.pages.map((page) => (
                  <button
                    key={page.key}
                    onClick={() => {
                      onPageChange(page.key);
                      if (!expandedCategories.has(cat.key)) toggleCategory(cat.key);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all",
                      activePage === page.key
                        ? "bg-indigo-600/20 text-indigo-400 font-medium border-l-2 border-indigo-400"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                    )}
                  >
                    {page.icon}
                    {page.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="text-[11px] text-slate-600">v1.0.0 | F&F ISO AI Agent</div>
      </div>
    </aside>
  );
}
