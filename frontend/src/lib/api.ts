const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

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
  STOR_SCHD_DT: string;
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

export const api = {
  getBrands: () => fetchApi<BrandsResponse>("/api/brands"),

  getOrderInbound: (brdCd: string, sesn: string) =>
    fetchApi<ApiListResponse<OrderInbound>>("/api/order-inbound", { brd_cd: brdCd, sesn }),

  getCostMaster: (brdCd: string, sesn: string) =>
    fetchApi<ApiListResponse<CostMaster>>("/api/cost/master", { brd_cd: brdCd, sesn }),

  getCostAccount: (brdCd: string, sesn: string) =>
    fetchApi<ApiListResponse<Record<string, unknown>>>("/api/cost/account", { brd_cd: brdCd, sesn }),

  getClaims: (brdCd: string) =>
    fetchApi<ApiListResponse<Claim>>("/api/claims", { brd_cd: brdCd }),

  getVoc: (brdCd: string) =>
    fetchApi<ApiListResponse<Record<string, unknown>>>("/api/voc", { brd_cd: brdCd }),

  getSeasonSale: (brdCd: string) =>
    fetchApi<ApiDataResponse<SeasonSale>>("/api/season-sale", { brd_cd: brdCd }),

  getSeasonSaleSummary: (brdCd: string, sesn: string) =>
    fetchApi<ApiDataResponse<Record<string, unknown>>>("/api/season-sale/summary", { brd_cd: brdCd, sesn }),
};
