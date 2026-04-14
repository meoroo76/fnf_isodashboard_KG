"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api, OrderInbound, SeasonSale } from "@/lib/api";
import { formatNumber, calcYoY, formatDelta } from "@/lib/utils";
import KpiCard from "@/components/KpiCard";
import DataTable from "@/components/DataTable";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/** ISO 8601 week number */
function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** COLOR_CD → 실제 색상 매핑 (2자 색상코드 + 톤 L/S/D) */
const COLOR_MAP: Record<string, { bg: string; label: string }> = {
  BK: { bg: "#1a1a1a", label: "BLACK" },
  IV: { bg: "#FFFFF0", label: "IVORY" },
  BR: { bg: "#8B4513", label: "BROWN" },
  NY: { bg: "#1B2A4A", label: "NAVY" },
  CR: { bg: "#DC143C", label: "CRIMSON" },
  SB: { bg: "#87CEEB", label: "SKY BLUE" },
  BG: { bg: "#F5F5DC", label: "BEIGE" },
  PK: { bg: "#FFB6C1", label: "PINK" },
  TQ: { bg: "#40E0D0", label: "TURQUOISE" },
  MG: { bg: "#808080", label: "MID GREY" },
  GR: { bg: "#A9A9A9", label: "GREY" },
  CG: { bg: "#C0C0C0", label: "CHARCOAL" },
  RB: { bg: "#4169E1", label: "ROYAL BLUE" },
  BL: { bg: "#0000CD", label: "BLUE" },
  BD: { bg: "#800020", label: "BURGUNDY" },
  KA: { bg: "#C3B091", label: "KHAKI" },
  YE: { bg: "#FFD700", label: "YELLOW" },
  RD: { bg: "#E53E3E", label: "RED" },
  LV: { bg: "#E6E6FA", label: "LAVENDER" },
  IN: { bg: "#4B0082", label: "INDIGO" },
  GN: { bg: "#228B22", label: "GREEN" },
  MT: { bg: "#98FF98", label: "MINT" },
  OL: { bg: "#808000", label: "OLIVE" },
  WI: { bg: "#F5F5F5", label: "WHITE" },
  CA: { bg: "#D2691E", label: "CAMEL" },
};

const TONE_ADJUST: Record<string, number> = { L: 30, S: 0, D: -40 };

function getColorInfo(code: string): { bg: string; label: string; isDark: boolean } {
  if (!code || code.length < 2) return { bg: "#e2e8f0", label: code, isDark: false };
  const base = code.slice(0, 2).toUpperCase();
  const tone = code.length >= 3 ? code[2].toUpperCase() : "S";
  const info = COLOR_MAP[base];
  if (!info) return { bg: "#e2e8f0", label: code, isDark: false };

  // 톤에 따라 밝기 조절
  let bg = info.bg;
  const adj = TONE_ADJUST[tone] || 0;
  if (adj !== 0) {
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const clamp = (v: number) => Math.max(0, Math.min(255, v + adj));
    bg = `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
  }

  // 어두운 색 판별 (luminance)
  const hex = bg.replace("#", "");
  const rr = parseInt(hex.slice(0, 2), 16);
  const gg = parseInt(hex.slice(2, 4), 16);
  const bb = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255;
  const isDark = luminance < 0.5;

  return { bg, label: code, isDark };
}

interface Props {
  brand: string;
  season: string;
}

interface SubMetric {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  detail?: string;
}

interface KpiData {
  label: string;
  value: string;
  unit: string;
  icon: string;
  delta: number;
  prevValue: string;
  accent: string;
  sub?: SubMetric;
}

export default function OrderDashboard({ brand, season }: Props) {
  const [currData, setCurrData] = useState<OrderInbound[]>([]);
  const [prevData, setPrevData] = useState<OrderInbound[]>([]);
  const [seasonSale, setSeasonSale] = useState<SeasonSale>({});
  const [loading, setLoading] = useState(true);

  const prevSeason = useMemo(() => {
    const year = parseInt(season.slice(0, 2));
    const suffix = season.slice(2);
    return `${(year - 1).toString().padStart(2, "0")}${suffix}`;
  }, [season]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrderInbound(brand, season),
      api.getOrderInbound(brand, prevSeason),
      api.getSeasonSale(brand),
    ]).then(([curr, prev, sale]) => {
      setCurrData(curr.data);
      setPrevData(prev.data);
      setSeasonSale(sale.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [brand, season, prevSeason]);

  // KPI 계산
  const kpis: KpiData[] = useMemo(() => {
    if (!currData.length) return [];

    const currOrdAmt = currData.reduce((s, r) => s + (r.ORD_TAG_AMT || 0), 0);
    const prevOrdAmt = prevData.reduce((s, r) => s + (r.ORD_TAG_AMT || 0), 0);
    const currStyles = new Set(currData.map((r) => r.PRDT_CD)).size;
    const prevStyles = new Set(prevData.map((r) => r.PRDT_CD)).size;
    const currOrdQty = currData.reduce((s, r) => s + (r.ORD_QTY || 0), 0);
    const prevOrdQty = prevData.reduce((s, r) => s + (r.ORD_QTY || 0), 0);
    const currStorQty = currData.reduce((s, r) => s + (r.STOR_QTY || 0), 0);
    const prevStorQty = prevData.reduce((s, r) => s + (r.STOR_QTY || 0), 0);
    const storRate = currOrdQty > 0 ? (currStorQty / currOrdQty) * 100 : 0;
    const prevStorRate = prevOrdQty > 0 ? (prevStorQty / prevOrdQty) * 100 : 0;
    const currStorAmt = currData.reduce((s, r) => s + (r.STOR_TAG_AMT || 0), 0);
    const prevStorAmt = prevData.reduce((s, r) => s + (r.STOR_TAG_AMT || 0), 0);

    // SKU수 (행 수 = 고유 조합)
    const currSkus = currData.length;
    const prevSkus = prevData.length;

    // 입고 스타일/SKU 수 (STOR_QTY > 0)
    const currStorStyles = new Set(currData.filter((r) => (r.STOR_QTY || 0) > 0).map((r) => r.PRDT_CD)).size;
    const prevStorStyles = new Set(prevData.filter((r) => (r.STOR_QTY || 0) > 0).map((r) => r.PRDT_CD)).size;

    // 진행률 계산
    const styleProgress = currStyles > 0 ? (currStorStyles / currStyles) * 100 : 0;
    const prevStyleProgress = prevStyles > 0 ? (prevStorStyles / prevStyles) * 100 : 0;
    const qtyProgress = currOrdQty > 0 ? (currStorQty / currOrdQty) * 100 : 0;
    const prevQtyProgress = prevOrdQty > 0 ? (prevStorQty / prevOrdQty) * 100 : 0;
    const amtProgress = currOrdAmt > 0 ? (currStorAmt / currOrdAmt) * 100 : 0;
    const prevAmtProgress = prevOrdAmt > 0 ? (prevStorAmt / prevOrdAmt) * 100 : 0;

    // 판매 데이터 — 동기간 비교 (당해 누적 vs 전년 동기간)
    const currSaleAmt = Number(seasonSale["당해누적판매택가"] || seasonSale["당해누적판매액"] || 0);
    const prevSaleAmt = Number(seasonSale["전년누적판매택가"] || seasonSale["전년기간판매택가"] || 0);
    const currSaleRate = Number(seasonSale["당해판매율"] || 0);
    const prevSaleRate = Number(seasonSale["전년판매율"] || 0);
    const currSaleQty = Number(seasonSale["당해누적판매수량"] || 0);
    const prevSaleQty = Number(seasonSale["전년누적판매수량"] || seasonSale["전년기간판매수량"] || 0);

    return [
      {
        label: "발주액",
        value: formatNumber(currOrdAmt, "억"),
        unit: "억원",
        icon: "📦",
        delta: calcYoY(currOrdAmt, prevOrdAmt),
        prevValue: `전년 ${formatNumber(prevOrdAmt, "억")}억`,
        accent: "#4f46e5",
        sub: {
          label: "금액 입고율",
          value: amtProgress.toFixed(1),
          delta: amtProgress - prevAmtProgress,
          detail: `입고 ${formatNumber(currStorAmt, "억")}억 / 발주 ${formatNumber(currOrdAmt, "억")}억 · 전년 ${prevAmtProgress.toFixed(1)}%`,
        },
      },
      {
        label: "발주수량",
        value: currOrdQty.toLocaleString(),
        unit: "PCS",
        icon: "📊",
        delta: calcYoY(currOrdQty, prevOrdQty),
        prevValue: `전년 ${prevOrdQty.toLocaleString()} PCS`,
        accent: "#7c3aed",
        sub: {
          label: "수량 입고율",
          value: qtyProgress.toFixed(1),
          delta: qtyProgress - prevQtyProgress,
          detail: `입고 ${currStorQty.toLocaleString()} / 발주 ${currOrdQty.toLocaleString()} PCS · 전년 ${prevQtyProgress.toFixed(1)}%`,
        },
      },
      {
        label: "스타일수",
        value: currStyles.toLocaleString(),
        unit: "STY",
        icon: "👗",
        delta: calcYoY(currStyles, prevStyles),
        prevValue: `전년 ${prevStyles} STY`,
        accent: "#2563eb",
        sub: {
          label: "스타일 입고율",
          value: styleProgress.toFixed(1),
          delta: styleProgress - prevStyleProgress,
          detail: `입고 ${currStorStyles} / 발주 ${currStyles} STY · 전년 ${prevStyleProgress.toFixed(1)}%`,
        },
      },
      {
        label: "SKU수",
        value: currSkus.toLocaleString(),
        unit: "SKU",
        icon: "🏷️",
        delta: calcYoY(currSkus, prevSkus),
        prevValue: `전년 ${prevSkus.toLocaleString()} SKU`,
        accent: "#059669",
        sub: {
          label: "SKU 입고율",
          value: currSkus > 0 ? ((currData.filter((r) => (r.STOR_QTY || 0) > 0).length / currSkus) * 100).toFixed(1) : "0.0",
          delta: (() => {
            const curr = currSkus > 0 ? (currData.filter((r) => (r.STOR_QTY || 0) > 0).length / currSkus) * 100 : 0;
            const prev = prevSkus > 0 ? (prevData.filter((r) => (r.STOR_QTY || 0) > 0).length / prevSkus) * 100 : 0;
            return curr - prev;
          })(),
          detail: `입고 ${currData.filter((r) => (r.STOR_QTY || 0) > 0).length} / 발주 ${currSkus} SKU`,
        },
      },
      {
        label: "판매금액",
        value: currSaleAmt > 0 ? formatNumber(currSaleAmt, "억") : "-",
        unit: currSaleAmt > 0 ? "억원" : "",
        icon: "💰",
        delta: calcYoY(currSaleAmt, prevSaleAmt),
        prevValue: prevSaleAmt > 0 ? `전년 동기간 ${formatNumber(prevSaleAmt, "억")}억 · ${prevSaleQty.toLocaleString()} PCS` : "전년 데이터 없음",
        accent: "#d97706",
        sub: {
          label: "판매율",
          value: currSaleRate > 0 ? currSaleRate.toFixed(1) : "0.0",
          delta: currSaleRate - prevSaleRate,
          detail: `판매 ${currSaleQty.toLocaleString()} PCS · 전년 판매율 ${prevSaleRate > 0 ? prevSaleRate.toFixed(1) + "%" : "-"}`,
        },
      },
    ];
  }, [currData, prevData]);

  // 카테고리 정렬 순서
  const CAT_ORDER = ["Total", "다운", "아우터", "맨투맨", "티셔츠", "팬츠", "가방", "볼캡/햇/비니", "시즌모자", "기타용품"];

  // 카테고리별 집계 (테이블용)
  const categoryData = useMemo(() => {
    if (!currData.length) return [];

    const aggregate = (data: OrderInbound[]) => {
      const map = new Map<string, {
        ordQty: number; ordAmt: number; storQty: number; storAmt: number;
        styles: Set<string>; storStyles: Set<string>; skus: number; storSkus: number;
      }>();
      data.forEach((r) => {
        const cat = r.ITEM_GROUP || "기타용품";
        const cur = map.get(cat) || {
          ordQty: 0, ordAmt: 0, storQty: 0, storAmt: 0,
          styles: new Set<string>(), storStyles: new Set<string>(), skus: 0, storSkus: 0,
        };
        cur.ordQty += r.ORD_QTY || 0;
        cur.ordAmt += r.ORD_TAG_AMT || 0;
        cur.storQty += r.STOR_QTY || 0;
        cur.storAmt += r.STOR_TAG_AMT || 0;
        cur.styles.add(r.PRDT_CD);
        cur.skus += 1;
        if ((r.STOR_QTY || 0) > 0) {
          cur.storStyles.add(r.PRDT_CD);
          cur.storSkus += 1;
        }
        map.set(cat, cur);
      });
      return map;
    };

    const currAgg = aggregate(currData);
    const prevAgg = aggregate(prevData);

    const buildRow = (cat: string, c: ReturnType<typeof aggregate> extends Map<string, infer V> ? V : never, p: ReturnType<typeof aggregate> extends Map<string, infer V> ? V : never, isTotal = false) => ({
      category: cat,
      // 스타일수
      currStyles: c.styles.size, prevStyles: p.styles.size, stylesDelta: c.styles.size - p.styles.size,
      styleStorRate: c.styles.size > 0 ? (c.storStyles.size / c.styles.size) * 100 : 0,
      // SKU수
      currSkus: c.skus, prevSkus: p.skus, skusDelta: c.skus - p.skus,
      skuStorRate: c.skus > 0 ? (c.storSkus / c.skus) * 100 : 0,
      // 수량
      currOrdQty: c.ordQty, prevOrdQty: p.ordQty, qtyGrowth: calcYoY(c.ordQty, p.ordQty),
      qtyStorRate: c.ordQty > 0 ? (c.storQty / c.ordQty) * 100 : 0,
      // 금액
      currOrdAmt: c.ordAmt, prevOrdAmt: p.ordAmt, amtGrowth: calcYoY(c.ordAmt, p.ordAmt),
      amtStorRate: c.ordAmt > 0 ? (c.storAmt / c.ordAmt) * 100 : 0,
      _isTotal: isTotal,
    });

    const emptyAgg = { ordQty: 0, ordAmt: 0, storQty: 0, storAmt: 0, styles: new Set<string>(), storStyles: new Set<string>(), skus: 0, storSkus: 0 };

    // 개별 카테고리 행
    const catRows = CAT_ORDER.filter((c) => c !== "Total").map((cat) => {
      const c = currAgg.get(cat) || emptyAgg;
      const p = prevAgg.get(cat) || emptyAgg;
      return buildRow(cat, c, p);
    }).filter((r) => r.currStyles > 0 || r.prevStyles > 0);

    // Total 행
    const totalC = { ...emptyAgg, styles: new Set<string>(), storStyles: new Set<string>() };
    const totalP = { ...emptyAgg, styles: new Set<string>(), storStyles: new Set<string>() };
    currData.forEach((r) => {
      totalC.ordQty += r.ORD_QTY || 0; totalC.ordAmt += r.ORD_TAG_AMT || 0;
      totalC.storQty += r.STOR_QTY || 0; totalC.storAmt += r.STOR_TAG_AMT || 0;
      totalC.styles.add(r.PRDT_CD); totalC.skus += 1;
      if ((r.STOR_QTY || 0) > 0) { totalC.storStyles.add(r.PRDT_CD); totalC.storSkus += 1; }
    });
    prevData.forEach((r) => {
      totalP.ordQty += r.ORD_QTY || 0; totalP.ordAmt += r.ORD_TAG_AMT || 0;
      totalP.storQty += r.STOR_QTY || 0; totalP.storAmt += r.STOR_TAG_AMT || 0;
      totalP.styles.add(r.PRDT_CD); totalP.skus += 1;
      if ((r.STOR_QTY || 0) > 0) { totalP.storStyles.add(r.PRDT_CD); totalP.storSkus += 1; }
    });

    return [buildRow("Total", totalC, totalP, true), ...catRows];
  }, [currData, prevData]);

  // 입고 진도율 메트릭 선택 (기본: 스타일수)
  const [progressMetric, setProgressMetric] = useState<"styles" | "qty" | "amt">("styles");

  // 주차별 입고 테이블 펼치기
  const [inboundExpanded, setInboundExpanded] = useState(false);

  // 주차별 입고 현황 — 주차 선택
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // 주차 목록 + 현재 주차 자동 선택
  const weekOptions = useMemo(() => {
    if (!currData.length) return [];
    const weekSet = new Map<number, { year: number; startDate: string; endDate: string }>();
    currData.forEach((r) => {
      if ((r.STOR_QTY || 0) <= 0 || !r.INDC_DT_CNFM) return;
      const dt = new Date(r.INDC_DT_CNFM as string);
      const wk = getISOWeek(dt);
      if (!weekSet.has(wk)) {
        // 해당 주의 월~일 범위 계산
        const monday = new Date(dt);
        monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        weekSet.set(wk, {
          year: dt.getFullYear(),
          startDate: `${monday.getMonth() + 1}/${monday.getDate()}`,
          endDate: `${sunday.getMonth() + 1}/${sunday.getDate()}`,
        });
      }
    });
    return [...weekSet.entries()]
      .sort(([a], [b]) => b - a) // 최신 주차 먼저
      .map(([wk, info]) => ({
        week: wk,
        label: `${wk}W (${info.startDate}~${info.endDate})`,
      }));
  }, [currData]);

  // 현재 주차 자동 선택
  useMemo(() => {
    if (weekOptions.length > 0 && selectedWeek === null) {
      const now = new Date();
      const currWk = getISOWeek(now);
      const match = weekOptions.find((w) => w.week === currWk);
      setSelectedWeek(match ? currWk : weekOptions[0].week);
    }
  }, [weekOptions, selectedWeek]);

  // 선택된 주차의 입고 데이터 — 스타일 단위 집계 (칼라 목록 포함)
  interface StyleInbound {
    prdt_cd: string;
    prdt_nm: string;
    colors: string[];
    stor_qty: number;
    ord_qty: number;
    supplier: string;
    indc_dt: string;
  }

  const weeklyStyleList = useMemo((): StyleInbound[] => {
    if (!selectedWeek || !currData.length) return [];
    const rows = currData.filter((r) => {
      if ((r.STOR_QTY || 0) <= 0 || !r.INDC_DT_CNFM) return false;
      const dt = new Date(r.INDC_DT_CNFM as string);
      return getISOWeek(dt) === selectedWeek;
    });

    const map = new Map<string, StyleInbound & { colorSet: Set<string> }>();
    rows.forEach((r) => {
      const key = r.PRDT_CD;
      const cur = map.get(key);
      const clr = String(r.COLOR_CD || "");
      if (!cur) {
        map.set(key, {
          prdt_cd: r.PRDT_CD,
          prdt_nm: r.PRDT_NM || "-",
          colors: [],
          colorSet: new Set(clr ? [clr] : []),
          stor_qty: r.STOR_QTY || 0,
          ord_qty: r.ORD_QTY || 0,
          supplier: r.MFAC_COMPY_NM || "-",
          indc_dt: String(r.INDC_DT_CNFM || ""),
        });
      } else {
        cur.stor_qty += r.STOR_QTY || 0;
        cur.ord_qty += r.ORD_QTY || 0;
        if (clr) cur.colorSet.add(clr);
        if (r.INDC_DT_CNFM && String(r.INDC_DT_CNFM) > cur.indc_dt) cur.indc_dt = String(r.INDC_DT_CNFM);
      }
    });

    return [...map.values()]
      .map((r) => ({ ...r, colors: [...r.colorSet].sort() }))
      .sort((a, b) => b.stor_qty - a.stor_qty);
  }, [currData, selectedWeek]);

  // 스타일 이미지 URL 로드 (KG 대표이미지 매핑 JSON)
  const [styleImages, setStyleImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetch("/data/prdt_img_map.json")
      .then((r) => r.ok ? r.json() : {})
      .then((map: Record<string, string>) => setStyleImages(map))
      .catch(() => {});
  }, []);

  // ── 스타일 상세 모달 ──
  const [selectedStyleDetail, setSelectedStyleDetail] = useState<string | null>(null);

  // 선택 스타일의 전체 데이터 (칼라×사이즈 매트릭스)
  const styleDetailData = useMemo(() => {
    if (!selectedStyleDetail) return null;
    const allRows = currData.filter((r) => r.PRDT_CD === selectedStyleDetail);
    if (!allRows.length) return null;

    const first = allRows[0];

    // 사이즈 목록 수집 (정렬)
    const sizeSet = new Set<string>();
    allRows.forEach((r) => { if (r.SIZE_CD) sizeSet.add(String(r.SIZE_CD)); });
    const sizes = [...sizeSet].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // 칼라×사이즈 매트릭스 구축
    type CellData = { ord: number; stor: number };
    const matrix = new Map<string, Map<string, CellData>>();
    const colorTotals = new Map<string, CellData>();

    allRows.forEach((r) => {
      const clr = String(r.COLOR_CD || "-");
      const sz = String(r.SIZE_CD || "-");
      if (!matrix.has(clr)) matrix.set(clr, new Map());
      const row = matrix.get(clr)!;
      const cell = row.get(sz) || { ord: 0, stor: 0 };
      cell.ord += r.ORD_QTY || 0;
      cell.stor += r.STOR_QTY || 0;
      row.set(sz, cell);

      const ct = colorTotals.get(clr) || { ord: 0, stor: 0 };
      ct.ord += r.ORD_QTY || 0;
      ct.stor += r.STOR_QTY || 0;
      colorTotals.set(clr, ct);
    });

    const colors = [...colorTotals.entries()]
      .sort((a, b) => b[1].ord - a[1].ord)
      .map(([c]) => c);

    // 일자별 입고 상세 — 날짜×칼라 기준, 사이즈 가로축
    const inboundMap = new Map<string, { date: string; color: string; po_no: string; bySz: Map<string, number> }>();
    allRows
      .filter((r) => (r.STOR_QTY || 0) > 0 && r.INDC_DT_CNFM)
      .forEach((r) => {
        const key = `${r.INDC_DT_CNFM}_${r.COLOR_CD || "-"}`;
        const cur = inboundMap.get(key) || {
          date: String(r.INDC_DT_CNFM || ""),
          color: String(r.COLOR_CD || "-"),
          po_no: r.PO_NO || "-",
          bySz: new Map<string, number>(),
        };
        const sz = String(r.SIZE_CD || "-");
        cur.bySz.set(sz, (cur.bySz.get(sz) || 0) + (r.STOR_QTY || 0));
        inboundMap.set(key, cur);
      });
    const inboundRows = [...inboundMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date) || a.color.localeCompare(b.color));

    const totalOrd = [...colorTotals.values()].reduce((s, c) => s + c.ord, 0);
    const totalStor = [...colorTotals.values()].reduce((s, c) => s + c.stor, 0);

    return {
      prdt_cd: selectedStyleDetail,
      prdt_nm: first.PRDT_NM || "-",
      item_group: first.ITEM_GROUP || "-",
      supplier: first.MFAC_COMPY_NM || "-",
      imageUrl: styleImages[selectedStyleDetail] || null,
      totalOrd,
      totalStor,
      sizes,
      colors,
      matrix,
      colorTotals,
      inboundRows,
    };
  }, [selectedStyleDetail, currData, styleImages]);

  // 시즌별 시작/종료일 계산 (각 시즌마다 자기 기준)
  const getSeasonDates = (sesn: string) => {
    const isFW = sesn.toUpperCase().endsWith("F");
    const y = 2000 + parseInt(sesn.slice(0, 2));
    const start = isFW ? new Date(y, 6, 1) : new Date(y - 1, 11, 1);
    const end = isFW ? new Date(y, 10, 30) : new Date(y, 4, 31);
    return { start, end, maxElapsed: Math.round((end.getTime() - start.getTime()) / 86400000) };
  };

  // 입고 진도율 차트 데이터 (당해/전년 각각 자기 시즌 시작일 기준 경과일로 계산)
  const weeklyTrend = useMemo(() => {
    if (!currData.length) return [];

    const currDates = getSeasonDates(season);
    const prevDates = getSeasonDates(prevSeason);

    const calcProgress = (
      data: OrderInbound[],
      seasonDates: { start: Date; maxElapsed: number },
      metric: "styles" | "qty" | "amt",
    ) => {
      const { start, maxElapsed } = seasonDates;
      const stored = data.filter((r) => (r.STOR_QTY || 0) > 0 && r.INDC_DT_CNFM);

      // 분모 계산
      let denom: number;
      if (metric === "styles") {
        denom = Math.max(new Set(data.map((r) => r.PRDT_CD)).size, 1);
      } else if (metric === "qty") {
        denom = Math.max(data.reduce((s, r) => s + (r.ORD_QTY || 0), 0), 1);
      } else {
        denom = Math.max(data.reduce((s, r) => s + (r.ORD_TAG_AMT || 0), 0) / 1e8, 0.01);
      }

      // 경과일별 맵 (스타일은 Set, 수량/금액은 number)
      const dayStyles = new Map<number, Set<string>>();
      const dayValues = new Map<number, number>();

      stored.forEach((r) => {
        const dt = new Date(r.INDC_DT_CNFM as string);
        let elapsed = Math.round((dt.getTime() - start.getTime()) / 86400000);
        elapsed = Math.max(0, Math.min(elapsed, maxElapsed));

        if (metric === "styles") {
          if (!dayStyles.has(elapsed)) dayStyles.set(elapsed, new Set());
          dayStyles.get(elapsed)!.add(r.PRDT_CD);
        } else {
          const val = metric === "qty" ? (r.STOR_QTY || 0) : (r.STOR_TAG_AMT || 0) / 1e8;
          dayValues.set(elapsed, (dayValues.get(elapsed) || 0) + val);
        }
      });

      // 7일 간격으로 누적
      const points: { elapsed: number; rate: number; cumValue: number }[] = [];
      const cumStyles = new Set<string>();
      let cumVal = 0;

      for (let d = 0; d <= maxElapsed; d += 7) {
        for (let dd = Math.max(0, d - 6); dd <= d; dd++) {
          if (metric === "styles") {
            dayStyles.get(dd)?.forEach((s) => cumStyles.add(s));
          } else {
            cumVal += dayValues.get(dd) || 0;
          }
        }
        const numerator = metric === "styles" ? cumStyles.size : cumVal;
        points.push({ elapsed: d, rate: (numerator / denom) * 100, cumValue: numerator });
      }
      return points;
    };

    const currPoints = calcProgress(currData, currDates, progressMetric);
    const prevPoints = calcProgress(prevData, prevDates, progressMetric);

    // 당해 시즌: 오늘 날짜까지만 표시
    const today = new Date();
    const todayElapsed = Math.round((today.getTime() - currDates.start.getTime()) / 86400000);

    // 당해 시즌 날짜 라벨 + 전년은 동일 경과일로 매칭
    const merged = currPoints
      .filter((cp) => cp.elapsed <= todayElapsed) // 당해는 오늘까지만
      .map((cp) => {
        const refDate = new Date(currDates.start.getTime() + cp.elapsed * 86400000);
        const label = `${refDate.getMonth() + 1}/${refDate.getDate()}`;
        const prevMatch = prevPoints.find((pp) => pp.elapsed === cp.elapsed);
        return {
          label,
          당해: Math.round(cp.rate * 10) / 10,
          전년: prevMatch ? Math.round(prevMatch.rate * 10) / 10 : 0,
          currCum: Math.round(cp.cumValue * 100) / 100,
          prevCum: prevMatch ? Math.round(prevMatch.cumValue * 100) / 100 : 0,
        };
      });

    return merged;
  }, [currData, prevData, season, prevSeason, progressMetric]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  const growthColor = (val: unknown) => {
    const n = Number(val);
    if (n > 10) return "#f0fdf4";
    if (n > 0) return "#fefce8";
    if (n < -10) return "#fef2f2";
    if (n < 0) return "#fff7ed";
    return undefined;
  };

  const fmtN = (v: unknown) => Number(v).toLocaleString();
  const fmtDelta = (v: unknown) => { const n = Number(v); return n > 0 ? `+${n}` : String(n); };
  const fmtPct = (v: unknown) => `${Number(v).toFixed(1)}%`;
  const pctColor = (v: unknown) => {
    const n = Number(v);
    if (n >= 90) return "#f0fdf4";
    if (n >= 70) return "#fefce8";
    if (n > 0) return "#fef2f2";
    return undefined;
  };

  const tableColumns = [
    { key: "category", label: "카테고리", align: "left" as const },
    // 스타일수
    { key: "currStyles", label: season, align: "right" as const, format: fmtN },
    { key: "prevStyles", label: prevSeason, align: "right" as const, format: fmtN },
    { key: "stylesDelta", label: "증감", align: "right" as const, format: fmtDelta, colorCode: growthColor },
    { key: "styleStorRate", label: `${season} 입고율`, align: "right" as const, format: fmtPct, colorCode: pctColor },
    // SKU수
    { key: "currSkus", label: season, align: "right" as const, format: fmtN },
    { key: "prevSkus", label: prevSeason, align: "right" as const, format: fmtN },
    { key: "skusDelta", label: "증감", align: "right" as const, format: fmtDelta, colorCode: growthColor },
    { key: "skuStorRate", label: `${season} 입고율`, align: "right" as const, format: fmtPct, colorCode: pctColor },
    // 수량
    { key: "currOrdQty", label: season, align: "right" as const, format: fmtN },
    { key: "prevOrdQty", label: prevSeason, align: "right" as const, format: fmtN },
    { key: "qtyGrowth", label: "성장률", align: "right" as const, format: (v: unknown) => formatDelta(Number(v)), colorCode: growthColor },
    { key: "qtyStorRate", label: "입고율", align: "right" as const, format: fmtPct, colorCode: pctColor },
    // 금액
    { key: "currOrdAmt", label: season, align: "right" as const, format: (v: unknown) => formatNumber(Number(v), "억") },
    { key: "prevOrdAmt", label: prevSeason, align: "right" as const, format: (v: unknown) => formatNumber(Number(v), "억") },
    { key: "amtGrowth", label: "성장률", align: "right" as const, format: (v: unknown) => formatDelta(Number(v)), colorCode: growthColor },
    { key: "amtStorRate", label: "입고율", align: "right" as const, format: fmtPct, colorCode: pctColor },
  ];

  const columnGroups = [
    { label: "카테고리", colSpan: 1 },
    { label: "스타일수", colSpan: 4, color: "#f0f9ff" },
    { label: "SKU수", colSpan: 4, color: "#faf5ff" },
    { label: "수량 (PCS)", colSpan: 4, color: "#f0fdf4" },
    { label: "금액 (억원)", colSpan: 4, color: "#fffbeb" },
  ];

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-slate-800">오더 현황</h2>
        <span className="text-sm text-slate-400">
          {season} vs {prevSeason} 비교
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            icon={kpi.icon}
            delta={kpi.delta}
            prevValue={kpi.prevValue}
            accent={kpi.accent}
            sub={kpi.sub}
          />
        ))}
      </div>

      {/* 주차별 입고 추이 (전체폭) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-slate-700">📈 입고 진도율 (전년비)</h3>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              {([
                { key: "styles" as const, label: "스타일수" },
                { key: "qty" as const, label: "수량" },
                { key: "amt" as const, label: "금액" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setProgressMetric(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    progressMetric === opt.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-indigo-500 rounded" /> {season}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-300 rounded" /> {prevSeason}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={weeklyTrend}>
            <defs>
              <linearGradient id="gradCurr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={45} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} ticks={[0, 20, 40, 60, 80, 100]} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                if (!row) return null;
                const metricUnit = progressMetric === "styles" ? "STY" : progressMetric === "qty" ? "PCS" : "억";
                const currVal = progressMetric === "amt"
                  ? `${Number(row.currCum).toFixed(1)}${metricUnit}`
                  : `${Math.round(row.currCum).toLocaleString()}${metricUnit}`;
                const prevVal = progressMetric === "amt"
                  ? `${Number(row.prevCum).toFixed(1)}${metricUnit}`
                  : `${Math.round(row.prevCum).toLocaleString()}${metricUnit}`;
                return (
                  <div style={{
                    background: "#0f172a",
                    borderRadius: 12,
                    padding: "14px 18px",
                    minWidth: 200,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, fontWeight: 600 }}>
                      📅 {label}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4f46e5" }} />
                      <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600, width: 36 }}>{season}</span>
                      <span style={{ fontSize: 14, color: "#fff", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {currVal}
                      </span>
                      <span style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, marginLeft: "auto" }}>
                        {row.당해}%
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: "#64748b", border: "1px dashed #94a3b8" }} />
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, width: 36 }}>{prevSeason}</span>
                      <span style={{ fontSize: 14, color: "#cbd5e1", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {prevVal}
                      </span>
                      <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, marginLeft: "auto" }}>
                        {row.전년}%
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={100} stroke="#e2e8f0" strokeDasharray="6 3" label={{ value: "100%", position: "right", fontSize: 10, fill: "#94a3b8" }} />
            <Area type="monotone" dataKey="전년" stroke="#cbd5e1" strokeWidth={2} fill="transparent" strokeDasharray="5 5" dot={false} />
            <Area type="monotone" dataKey="당해" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gradCurr)" dot={{ fill: "#4f46e5", r: 3, strokeWidth: 0 }} activeDot={{ r: 6, stroke: "#4f46e5", strokeWidth: 2, fill: "#fff" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 주차별 입고 현황 */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-bold text-slate-800">주차별 입고 현황</h2>
          <select
            value={selectedWeek || ""}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
          >
            {weekOptions.map((opt) => (
              <option key={opt.week} value={opt.week}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 좌측: 입고 실적 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">📦 입고 실적 ({selectedWeek}W)</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{weeklyStyleList.length}건</span>
                <button
                  onClick={() => setInboundExpanded(!inboundExpanded)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  {inboundExpanded ? "접기 ▲" : "펼치기 ▼"}
                </button>
              </div>
            </div>

            {/* 합계 (헤더 바로 아래 고정) */}
            {weeklyStyleList.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-800 text-white flex items-center text-[11px] font-bold">
                <span className="flex-1">합계</span>
                <span className="px-3">{weeklyStyleList.length} STY</span>
                <span className="px-3">{weeklyStyleList.reduce((s, r) => s + r.colors.length, 0)} CLR</span>
                <span className="px-3 font-mono tabular-nums">{weeklyStyleList.reduce((s, r) => s + r.stor_qty, 0).toLocaleString()} PCS</span>
              </div>
            )}

            {/* 테이블 본문 — 스타일 기준 (더블클릭 상세) */}
            <div
              className="overflow-y-auto transition-all duration-300"
              style={{ maxHeight: inboundExpanded ? "none" : "600px" }}
            >
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">이미지</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">품번</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">칼라</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">입고수량</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">협력사</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStyleList.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-400">해당 주차 입고 데이터 없음</td></tr>
                  ) : (
                    weeklyStyleList.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-50 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                        onDoubleClick={() => setSelectedStyleDetail(row.prdt_cd)}
                      >
                        <td className="px-4 py-2">
                          {styleImages[row.prdt_cd] ? (
                            <img src={styleImages[row.prdt_cd]!} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-50" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-[8px]">IMG</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800 text-[11px]">{row.prdt_cd.replace(/^[A-Z]\d{2}[A-Z]/, "")}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{row.prdt_nm}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.colors.map((clr) => {
                              const ci = getColorInfo(clr);
                              return (
                                <span
                                  key={clr}
                                  className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
                                  style={{
                                    backgroundColor: ci.bg,
                                    color: ci.isDark ? "#fff" : "#1e293b",
                                    border: `1px solid ${ci.isDark ? "transparent" : "#e2e8f0"}`,
                                  }}
                                >
                                  {clr}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-800">
                          {row.stor_qty.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-600 truncate max-w-[100px]">
                          {row.supplier}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 입고 상세 모달 */}
            {selectedStyleDetail && styleDetailData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedStyleDetail(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-[1000px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {/* 헤더 — 기본정보 */}
                  <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div className="flex items-center gap-4">
                      {styleDetailData.imageUrl ? (
                        <img src={styleDetailData.imageUrl} alt="" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 text-xs">IMG</div>
                      )}
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {styleDetailData.prdt_cd.replace(/^[A-Z]\d{2}[A-Z]/, "")}
                          <span className="ml-2 text-sm font-normal text-slate-500">{styleDetailData.prdt_nm}</span>
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-[12px] text-slate-500">
                          <span>{styleDetailData.item_group}</span>
                          <span className="text-slate-300">|</span>
                          <span>{styleDetailData.supplier}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStyleDetail(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2">✕</button>
                  </div>

                  {/* KPI 요약 */}
                  <div className="px-6 py-3 bg-slate-50 grid grid-cols-3 gap-4 text-center border-b border-slate-100">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">발주수량</div>
                      <div className="text-lg font-bold text-slate-800 tabular-nums">{styleDetailData.totalOrd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">누적입고</div>
                      <div className="text-lg font-bold text-indigo-600 tabular-nums">{styleDetailData.totalStor.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">입고율</div>
                      <div className="text-lg font-bold text-slate-800 tabular-nums">
                        {styleDetailData.totalOrd > 0 ? `${((styleDetailData.totalStor / styleDetailData.totalOrd) * 100).toFixed(1)}%` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* 칼라×사이즈 매트릭스 테이블 */}
                  <div className="px-6 py-4 overflow-x-auto">
                    <h4 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-2">칼라별 발주/입고 현황</h4>
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-2 py-2 text-[10px] font-semibold text-slate-500 border-b-2 border-slate-200" rowSpan={2}>칼라</th>
                          <th className="text-left px-2 py-2 text-[10px] font-semibold text-slate-500 border-b-2 border-slate-200" rowSpan={2}>구분</th>
                          {styleDetailData.sizes.length > 0 && (
                            <th className="text-center px-1 py-1.5 text-[10px] font-semibold text-slate-500 border-b border-slate-200" colSpan={styleDetailData.sizes.length}>사이즈</th>
                          )}
                          <th className="text-right px-2 py-2 text-[10px] font-semibold text-slate-500 border-b-2 border-slate-200 bg-slate-100" rowSpan={2}>합계</th>
                        </tr>
                        {styleDetailData.sizes.length > 0 && (
                          <tr className="bg-slate-50">
                            {styleDetailData.sizes.map((sz) => (
                              <th key={sz} className="text-right px-1.5 py-1.5 text-[10px] font-semibold text-slate-500 border-b-2 border-slate-200 min-w-[42px]">{sz}</th>
                            ))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {styleDetailData.colors.map((clr) => {
                          const ci = getColorInfo(clr);
                          const colorRow = styleDetailData.matrix.get(clr);
                          const ct = styleDetailData.colorTotals.get(clr) || { ord: 0, stor: 0 };
                          const labels = ["발주수량", "입고수량", "증감"] as const;
                          return labels.map((label, li) => (
                            <tr key={`${clr}_${label}`} className={`${li === 2 ? "border-b-2 border-slate-200" : "border-b border-slate-100"} hover:bg-slate-50/50`}>
                              {li === 0 && (
                                <td rowSpan={3} className="px-2 py-1.5 border-r border-slate-100 align-middle">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold" style={{ backgroundColor: ci.bg, color: ci.isDark ? "#fff" : "#1e293b", border: `1px solid ${ci.isDark ? "transparent" : "#e2e8f0"}` }}>
                                    {clr}
                                  </span>
                                </td>
                              )}
                              <td className={`px-2 py-1 text-[10px] font-medium border-r border-slate-100 whitespace-nowrap ${li === 2 ? "text-slate-500" : "text-slate-600"}`}>
                                {label}
                              </td>
                              {styleDetailData.sizes.map((sz) => {
                                const cell = colorRow?.get(sz);
                                const val = li === 0 ? (cell?.ord || 0) : li === 1 ? (cell?.stor || 0) : ((cell?.stor || 0) - (cell?.ord || 0));
                                return (
                                  <td key={sz} className={`px-1.5 py-1 text-right font-mono tabular-nums ${
                                    li === 1 ? "text-indigo-600 font-medium" : li === 2 ? (val > 0 ? "text-red-500" : val < 0 ? "text-blue-500" : "text-slate-300") : "text-slate-700"
                                  }`}>
                                    {val === 0 ? (li === 2 ? "" : "-") : (li === 2 && val > 0 ? "+" : "") + val.toLocaleString()}
                                  </td>
                                );
                              })}
                              <td className={`px-2 py-1 text-right font-mono tabular-nums font-bold bg-slate-50/80 ${
                                li === 1 ? "text-indigo-600" : li === 2 ? ((ct.stor - ct.ord) > 0 ? "text-red-500" : (ct.stor - ct.ord) < 0 ? "text-blue-500" : "text-slate-300") : "text-slate-800"
                              }`}>
                                {(() => {
                                  const v = li === 0 ? ct.ord : li === 1 ? ct.stor : ct.stor - ct.ord;
                                  return v === 0 && li === 2 ? "" : (li === 2 && v > 0 ? "+" : "") + v.toLocaleString();
                                })()}
                              </td>
                            </tr>
                          ));
                        })}
                        {/* 합계 */}
                        {["발주", "입고", "증감"].map((label, li) => (
                          <tr key={`total_${label}`} className={`bg-slate-100 font-bold ${li === 2 ? "border-b-2 border-slate-300" : "border-b border-slate-200"}`}>
                            {li === 0 && (
                              <td rowSpan={3} className="px-2 py-1.5 text-[11px] font-bold text-slate-700 border-r border-slate-200 align-middle">합계</td>
                            )}
                            <td className="px-2 py-1 text-[10px] font-semibold text-slate-600 border-r border-slate-200">{label}</td>
                            {styleDetailData.sizes.map((sz) => {
                              let val = 0;
                              styleDetailData.colors.forEach((clr) => {
                                const cell = styleDetailData.matrix.get(clr)?.get(sz);
                                if (li === 0) val += cell?.ord || 0;
                                else if (li === 1) val += cell?.stor || 0;
                                else val += (cell?.stor || 0) - (cell?.ord || 0);
                              });
                              return (
                                <td key={sz} className={`px-1.5 py-1 text-right font-mono tabular-nums ${
                                  li === 1 ? "text-indigo-600" : li === 2 ? (val > 0 ? "text-red-500" : val < 0 ? "text-blue-500" : "text-slate-300") : "text-slate-800"
                                }`}>
                                  {val === 0 && li === 2 ? "" : (li === 2 && val > 0 ? "+" : "") + val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                              li === 1 ? "text-indigo-600" : li === 2 ? ((styleDetailData.totalStor - styleDetailData.totalOrd) > 0 ? "text-red-500" : "text-blue-500") : "text-slate-800"
                            }`}>
                              {(() => {
                                const v = li === 0 ? styleDetailData.totalOrd : li === 1 ? styleDetailData.totalStor : styleDetailData.totalStor - styleDetailData.totalOrd;
                                return (li === 2 && v > 0 ? "+" : "") + v.toLocaleString();
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 일자별 입고 상세 — 사이즈 가로축 */}
                  <div className="px-6 py-4 border-t border-slate-100 overflow-x-auto">
                    <h4 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-2">일자별 입고 상세</h4>
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-200 bg-slate-50">
                          <th className="text-center px-2 py-2 text-[10px] font-semibold text-slate-500">입고일</th>
                          <th className="text-left px-2 py-2 text-[10px] font-semibold text-slate-500">칼라</th>
                          {styleDetailData.sizes.map((sz) => (
                            <th key={sz} className="text-right px-1.5 py-2 text-[10px] font-semibold text-slate-500 min-w-[42px]">{sz}</th>
                          ))}
                          <th className="text-right px-2 py-2 text-[10px] font-semibold text-slate-500 bg-slate-100">합계</th>
                          <th className="text-left px-2 py-2 text-[10px] font-semibold text-slate-500">PO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {styleDetailData.inboundRows.length === 0 ? (
                          <tr><td colSpan={styleDetailData.sizes.length + 4} className="text-center py-6 text-slate-400">입고 내역 없음</td></tr>
                        ) : (
                          styleDetailData.inboundRows.map((r, i) => {
                            const ci = getColorInfo(r.color);
                            const rowTotal = [...r.bySz.values()].reduce((s, v) => s + v, 0);
                            return (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="px-2 py-1.5 text-center text-slate-600">{r.date.slice(5)}</td>
                                <td className="px-2 py-1.5">
                                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-medium" style={{ backgroundColor: ci.bg, color: ci.isDark ? "#fff" : "#1e293b", border: `1px solid ${ci.isDark ? "transparent" : "#e2e8f0"}` }}>
                                    {r.color}
                                  </span>
                                </td>
                                {styleDetailData.sizes.map((sz) => {
                                  const v = r.bySz.get(sz) || 0;
                                  return (
                                    <td key={sz} className="px-1.5 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                      {v > 0 ? v.toLocaleString() : <span className="text-slate-200">-</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums font-bold text-slate-800 bg-slate-50/80">{rowTotal.toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-slate-400 font-mono text-[10px] truncate max-w-[100px]">{r.po_no}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 입고 예정 (플레이스홀더) */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">📅 입고 예정 (금주)</h3>
            </div>
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm text-slate-400">엑셀 시트 연동 예정</p>
                <p className="text-xs text-slate-300 mt-1">입고 예정 스타일 리스트가 표시됩니다</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">📋 카테고리별 상세</h3>
        <DataTable
          columns={tableColumns}
          data={categoryData}
          columnGroups={columnGroups}
          compact
          rowClassFn={(row) => (row._isTotal ? "font-bold bg-slate-50/80" : "")}
        />
      </div>
    </div>
  );
}
