import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** 숫자를 억/천 단위로 포맷 */
export function formatNumber(value: number, unit?: string): string {
  if (unit === "억") {
    return (value / 100_000_000).toFixed(1);
  }
  if (unit === "천") {
    return Math.round(value / 1000).toLocaleString();
  }
  if (unit === "백만") {
    return (value / 1_000_000).toFixed(0);
  }
  return value.toLocaleString();
}

/** 증감률 포맷 (+xx.x% / -xx.x%) */
export function formatDelta(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** 전년비 계산 */
export function calcYoY(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return ((curr / prev) - 1) * 100;
}

/** 값에 따른 색상 클래스 */
export function deltaColorClass(value: number): string {
  if (value > 0) return "text-red-500";
  if (value < 0) return "text-blue-500";
  return "text-slate-400";
}

/** 백만원 포맷 */
export function formatMillions(value: number): string {
  return Math.round(value / 1_000_000).toLocaleString();
}

/** 사이즈 정렬 (문자 → 숫자 순, 문자는 XS~3XL 순서) */
const SIZE_ORDER: Record<string, number> = {
  XXS: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5,
  "2XL": 6, XXL: 6, "3XL": 7, XXXL: 7, "4XL": 8, "5XL": 9,
  F: 50, FREE: 50,
};

function sizeRank(s: string): number {
  const upper = s.toUpperCase();
  if (upper in SIZE_ORDER) return SIZE_ORDER[upper];
  const n = parseInt(s, 10);
  if (!isNaN(n)) return 100 + n;
  return 200;
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ra = sizeRank(a), rb = sizeRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
