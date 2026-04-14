/**
 * API 클라이언트 — FastAPI 또는 정적 JSON fallback
 * Vercel 배포 시 /data/ 정적 파일에서 직접 로드
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// FastAPI가 살아있으면 사용, 아니면 정적 파일 fallback
let useStaticFallback = !process.env.NEXT_PUBLIC_API_URL;

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!useStaticFallback) {
    try {
      const url = new URL(`${API_BASE}${path}`);
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const res = await fetch(url.toString());
      if (res.ok) return res.json();
    } catch {
      useStaticFallback = true;
    }
  }
  throw new Error("API unavailable");
}

// ── 정적 JSON 파일 매핑 ──
const BRAND_PREFIX: Record<string, string> = { V: "duvetica", ST: "sergio" };

function brandFile(brdCd: string): string {
  return BRAND_PREFIX[brdCd] || "duvetica";
}

async function loadJsonFile<T>(filename: string): Promise<T> {
  const res = await fetch(`/data/${filename}`);
  if (!res.ok) throw new Error(`File not found: ${filename}`);
  const raw = await res.json();
  // {data: [...]} 또는 [...] 형태 모두 지원
  if (raw && typeof raw === "object" && "data" in raw) return raw;
  return { data: raw } as T;
}

function parseRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const d = (raw as Record<string, unknown>).data;
    return Array.isArray(d) ? d : [];
  }
  return [];
}

// ── 타입 ──
interface ApiListResponse<T> {
  data: T[];
  count: number;
}

interface ApiDataResponse<T> {
  data: T;
}

export interface OrderInbound {
  BRD_CD: string;
  SESN: string;
  SESN_RUNNING: string;
  PRDT_CD: string;
  PRDT_NM: string;
  ITEM_GROUP: string;
  ITEM: string;
  PART_CD: string;
  ORD_QTY: number;
  ORD_TAG_AMT: number;
  STOR_QTY: number;
  STOR_TAG_AMT: number;
  MFAC_COMPY_NM: string;
  PO_CNTRY_NM: string;
  PO_NO: string;
  STOR_DT: string;
  INDC_DT_CNFM: string;
  INDC_DT_REQ: string;
  [key: string]: unknown;
}

export interface CostMaster {
  BRD_CD: string;
  SESN: string;
  PRDT_CD: string;
  PRDT_NM: string;
  ITEM_GROUP: string;
  ITEM: string;
  TAG_PRICE: number;
  PO_NO: string;
  MFAC_COMPY_NM: string;
  MFAC_COST_MFAC_COST_AMT: number;
  MFAC_COST_MARKUP: number;
  MFAC_COST_TAG_AMT: number;
  MFAC_COST_EXCHAGE_RATE: number;
  [key: string]: unknown;
}

export interface Claim {
  BRD_CD: string;
  SESN: string;
  PRDT_CD: string;
  PRDT_NM: string;
  ITEM_GROUP: string;
  CLAIM_QTY: number;
  CLAIM_CLS_NM: string;
  CLAIM_CONTS_ANAL_GROUP_NM: string;
  CLAIM_ERR_CLS_NM: string;
  MFAC_COMPY_NM: string;
  CLAIM_DT?: string;
  CLAIM_RCPT_DT?: string;
  [key: string]: unknown;
}

export interface SeasonSale {
  [key: string]: number | string;
}

export interface BrandInfo {
  code: string;
  icon: string;
  color: string;
}

export interface BrandsResponse {
  brands: Record<string, BrandInfo>;
  current_season: string;
}

// ── 시즌코드 → 파일명 매핑 ──
function orderInboundFile(brdCd: string, sesn: string): string {
  const s = sesn.toLowerCase().replace("s", "s").replace("f", "f");
  return `${brandFile(brdCd)}_${s}_order_inbound.json`;
}

function costFile(brdCd: string, sesn: string): string {
  const s = sesn.toLowerCase();
  return `${brandFile(brdCd)}_${s}_cost.json`;
}

// ── API 객체 ──
export const api = {
  getBrands: async (): Promise<BrandsResponse> => {
    try { return await fetchApi<BrandsResponse>("/api/brands"); } catch {}
    return {
      brands: {
        DUVETICA: { code: "V", icon: "🦆", color: "#4f46e5" },
        "SERGIO TACCHINI": { code: "ST", icon: "🎾", color: "#7c3aed" },
      },
      current_season: "26S",
    };
  },

  getOrderInbound: async (brdCd: string, sesn: string): Promise<ApiListResponse<OrderInbound>> => {
    try { return await fetchApi<ApiListResponse<OrderInbound>>("/api/order-inbound", { brd_cd: brdCd, sesn }); } catch {}
    const filename = orderInboundFile(brdCd, sesn);
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: [], count: 0 };
      const raw = await res.json();
      const rows = parseRows(raw) as OrderInbound[];
      return { data: rows, count: rows.length };
    } catch { return { data: [], count: 0 }; }
  },

  getCostMaster: async (brdCd: string, sesn: string): Promise<ApiListResponse<CostMaster>> => {
    try { return await fetchApi<ApiListResponse<CostMaster>>("/api/cost/master", { brd_cd: brdCd, sesn }); } catch {}
    const filename = costFile(brdCd, sesn);
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: [], count: 0 };
      const raw = await res.json();
      const rows = parseRows(raw) as CostMaster[];
      return { data: rows, count: rows.length };
    } catch { return { data: [], count: 0 }; }
  },

  getCostAccount: async (brdCd: string, sesn: string): Promise<ApiListResponse<Record<string, unknown>>> => {
    try { return await fetchApi<ApiListResponse<Record<string, unknown>>>("/api/cost/account", { brd_cd: brdCd, sesn }); } catch {}
    const filename = costFile(brdCd, sesn);
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: [], count: 0 };
      const raw = await res.json();
      const rows = parseRows(raw) as Record<string, unknown>[];
      return { data: rows, count: rows.length };
    } catch { return { data: [], count: 0 }; }
  },

  getClaims: async (brdCd: string): Promise<ApiListResponse<Claim>> => {
    try { return await fetchApi<ApiListResponse<Claim>>("/api/claims", { brd_cd: brdCd }); } catch {}
    const filename = `${brandFile(brdCd)}_claims.json`;
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: [], count: 0 };
      const raw = await res.json();
      const rows = parseRows(raw) as Claim[];
      return { data: rows, count: rows.length };
    } catch { return { data: [], count: 0 }; }
  },

  getVoc: async (brdCd: string): Promise<ApiListResponse<Record<string, unknown>>> => {
    try { return await fetchApi<ApiListResponse<Record<string, unknown>>>("/api/voc", { brd_cd: brdCd }); } catch {}
    const filename = `${brandFile(brdCd)}_voc.json`;
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: [], count: 0 };
      const raw = await res.json();
      const rows = parseRows(raw) as Record<string, unknown>[];
      return { data: rows, count: rows.length };
    } catch { return { data: [], count: 0 }; }
  },

  getSeasonSale: async (brdCd: string): Promise<ApiDataResponse<SeasonSale>> => {
    try { return await fetchApi<ApiDataResponse<SeasonSale>>("/api/season-sale", { brd_cd: brdCd }); } catch {}
    const filename = `${brandFile(brdCd)}_season_sale.json`;
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) return { data: {} };
      const raw = await res.json();
      const rows = parseRows(raw);
      return { data: (rows[0] || {}) as SeasonSale };
    } catch { return { data: {} }; }
  },

  getSeasonSaleSummary: async (brdCd: string, sesn: string): Promise<ApiDataResponse<Record<string, unknown>>> => {
    try { return await fetchApi<ApiDataResponse<Record<string, unknown>>>("/api/season-sale/summary", { brd_cd: brdCd, sesn }); } catch {}
    return { data: {} };
  },

  getStyleImages: async (prdtCds: string[]): Promise<ApiDataResponse<Record<string, string | null>>> => {
    try { return await fetchApi<ApiDataResponse<Record<string, string | null>>>("/api/style-images", { prdt_cds: prdtCds.join(",") }); } catch {}
    return { data: {} };
  },
};
