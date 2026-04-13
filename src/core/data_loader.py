"""
ISO AI Agent - KG 캐시 데이터 로더
캐시된 JSON 파일에서 polars DataFrame으로 로드
"""
import json
from pathlib import Path

import polars as pl

CACHE_DIR = Path(__file__).parent.parent / "download" / "kg_cache"

# ──────────────────────────────────────────
# 오더/입고 캐시 파일명 매핑
# ──────────────────────────────────────────
_FILE_MAP = {
    ("V", "26F"): "duvetica_26f_order_inbound.json",
    ("V", "26S"): "duvetica_26s_order_inbound.json",
    ("V", "25F"): "duvetica_25f_order_inbound.json",
    ("V", "25S"): "duvetica_25s_order_inbound.json",
    ("V", "24F"): "duvetica_24f_order_inbound.json",
    ("ST", "26F"): "sergio_26f_order_inbound.json",
    ("ST", "26S"): "sergio_26s_order_inbound.json",
    ("ST", "25F"): "sergio_25f_order_inbound.json",
    ("ST", "25S"): "sergio_25s_order_inbound.json",
    ("ST", "24F"): "sergio_24f_order_inbound.json",
}

# ──────────────────────────────────────────
# 원가 캐시 파일명 매핑
# ──────────────────────────────────────────
_COST_FILE_MAP = {
    ("V", "26F"): "duvetica_26f_cost.json",
    ("V", "26S"): "duvetica_26s_cost.json",
    ("V", "25F"): "duvetica_25f_cost.json",
    ("V", "25S"): "duvetica_25s_cost.json",
    ("V", "24F"): "duvetica_24f_cost.json",
    ("ST", "26F"): "sergio_26f_cost.json",
    ("ST", "26S"): "sergio_26s_cost.json",
    ("ST", "25F"): "sergio_25f_cost.json",
    ("ST", "25S"): "sergio_25s_cost.json",
    ("ST", "24F"): "sergio_24f_cost.json",
}

# ──────────────────────────────────────────
# 클레임 캐시 파일명 매핑
# ──────────────────────────────────────────
_CLAIM_FILE_MAP = {
    "V": "duvetica_claims.json",
    "ST": "sergio_claims.json",
}

# ──────────────────────────────────────────
# VOC 캐시 파일명 매핑
# ──────────────────────────────────────────
_VOC_FILE_MAP = {
    "V": "duvetica_voc.json",
    "ST": "sergio_voc.json",
}

# ──────────────────────────────────────────
# 협력사 캐시 파일명 매핑
# ──────────────────────────────────────────
_BP_FILE_MAP = {
    "V": "duvetica_bp.json",
    "ST": "sergio_bp.json",
}

# ──────────────────────────────────────────
# 시즌 판매 캐시 파일명 매핑
# ──────────────────────────────────────────
_SEASON_SALE_FILE_MAP = {
    "V": "duvetica_season_sale.json",
    "ST": "sergio_season_sale.json",
}


def load_order_inbound(brd_cd: str, sesn_running: str) -> pl.DataFrame:
    """캐시된 오더/입고 데이터를 polars DataFrame으로 로드"""
    key = (brd_cd, sesn_running)
    filename = _FILE_MAP.get(key)

    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                df = pl.DataFrame(rows)
                # null 처리
                for col in ["STOR_QTY", "STOR_TAG_AMT", "ORD_QTY", "ORD_TAG_AMT"]:
                    if col in df.columns:
                        df = df.with_columns(pl.col(col).cast(pl.Int64, strict=False).fill_null(0))
                return df

    # 파일이 없으면 빈 DataFrame 반환
    return pl.DataFrame()


def save_order_inbound(brd_cd: str, sesn_running: str, data: list[dict]):
    """오더/입고 데이터를 캐시 파일로 저장"""
    key = (brd_cd, sesn_running)
    filename = _FILE_MAP.get(key)
    if not filename:
        filename = f"{brd_cd.lower()}_{sesn_running.lower()}_order_inbound.json"

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_available_data() -> list[tuple[str, str]]:
    """캐시에 존재하는 (brd_cd, sesn_running) 목록 반환"""
    available = []
    for key, filename in _FILE_MAP.items():
        path = CACHE_DIR / filename
        if path.exists():
            available.append(key)
    return available


# ──────────────────────────────────────────
# 원가 데이터 로더
# ──────────────────────────────────────────
def _load_json_with_data_key(path: Path) -> list[dict]:
    """JSON 파일 로드 — {data: [...]} 또는 [...] 형식 모두 지원"""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "data" in raw:
        return raw["data"]
    if isinstance(raw, list):
        return raw
    return []


def load_cost_data(brd_cd: str, sesn: str) -> pl.DataFrame:
    """캐시된 원가 데이터를 polars DataFrame으로 로드

    Returns:
        21개 컬럼 DataFrame (BRD_CD, SESN, PRDT_CD, PRDT_NM, ITEM_GROUP, ITEM,
        TAG_PRICE, PO_NO, MFAC_COMPY_NM, PO_CNTRY_NM,
        MFAC_COST_QUOTATION_STAT_NM, MFAC_COST_SUPPLIER_OFFER_COST_AMT,
        MFAC_COST_SUPPLIER_NEGO_COST_AMT, MFAC_COST_MFAC_COST_AMT,
        MFAC_COST_MARKUP, MFAC_COST_TAG_AMT, MFAC_COST_EXCHAGE_RATE,
        MFAC_COST_ACCOUNT_TYPE1_NM, MFAC_COST_ACCOUNT_TYPE2_NM,
        MFAC_COST_UNIT_COST, MFAC_COST_COST_AMT)
    """
    key = (brd_cd, sesn)
    filename = _COST_FILE_MAP.get(key)

    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                df = pl.DataFrame(rows)
                # 숫자 컬럼 null → 0
                num_cols = [
                    "TAG_PRICE", "MFAC_COST_SUPPLIER_OFFER_COST_AMT",
                    "MFAC_COST_SUPPLIER_NEGO_COST_AMT", "MFAC_COST_MFAC_COST_AMT",
                    "MFAC_COST_MARKUP", "MFAC_COST_TAG_AMT", "MFAC_COST_EXCHAGE_RATE",
                    "MFAC_COST_UNIT_COST", "MFAC_COST_COST_AMT",
                ]
                for col in num_cols:
                    if col in df.columns:
                        df = df.with_columns(pl.col(col).cast(pl.Float64, strict=False).fill_null(0.0))
                return df

    return pl.DataFrame()


def load_cost_master(brd_cd: str, sesn: str) -> pl.DataFrame:
    """원가 마스터 (PO×스타일 단위, 계정 디테일 제외) — 중복 제거"""
    df = load_cost_data(brd_cd, sesn)
    if df.is_empty():
        return df

    master_cols = [
        "BRD_CD", "SESN", "PRDT_CD", "PRDT_NM", "ITEM_GROUP", "ITEM",
        "TAG_PRICE", "PO_NO", "MFAC_COMPY_NM",
        "MFAC_COST_QUOTATION_STAT_NM",
        "MFAC_COST_SUPPLIER_OFFER_COST_AMT", "MFAC_COST_SUPPLIER_NEGO_COST_AMT",
        "MFAC_COST_MFAC_COST_AMT", "MFAC_COST_MARKUP",
        "MFAC_COST_TAG_AMT", "MFAC_COST_EXCHAGE_RATE",
    ]
    existing = [c for c in master_cols if c in df.columns]
    return df.select(existing).unique()


def load_cost_account(brd_cd: str, sesn: str) -> pl.DataFrame:
    """원가 계정별 디테일 (대분류/중분류/단가/원가)"""
    df = load_cost_data(brd_cd, sesn)
    if df.is_empty():
        return df

    account_cols = [
        "BRD_CD", "SESN", "PRDT_CD", "PO_NO",
        "MFAC_COST_ACCOUNT_TYPE1_NM", "MFAC_COST_ACCOUNT_TYPE2_NM",
        "MFAC_COST_UNIT_COST", "MFAC_COST_COST_AMT",
    ]
    existing = [c for c in account_cols if c in df.columns]
    return df.select(existing)


def get_available_cost_data() -> list[tuple[str, str]]:
    """캐시에 존재하는 원가 (brd_cd, sesn) 목록 반환"""
    available = []
    for key, filename in _COST_FILE_MAP.items():
        path = CACHE_DIR / filename
        if path.exists():
            available.append(key)
    return available


# ──────────────────────────────────────────
# 클레임 데이터 로더
# ──────────────────────────────────────────
def load_claims(brd_cd: str) -> pl.DataFrame:
    """클레임 접수 데이터 로드

    Columns: BRD_CD, CHANNEL_TYPE, CLAIM_CLS_NM, CLAIM_CONTS_ANAL_GROUP_NM,
    CLAIM_ERR_CLS_NM, CLAIM_QTY, CLAIM_RSLT_ANAL_NM, ITEM_GROUP,
    MFAC_COMPY_NM, PO_NO, PRDT_CD, PRDT_NM, SESN, SHOP_NM
    """
    filename = _CLAIM_FILE_MAP.get(brd_cd)
    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                df = pl.DataFrame(rows)
                if "CLAIM_QTY" in df.columns:
                    df = df.with_columns(pl.col("CLAIM_QTY").cast(pl.Float64, strict=False).fill_null(0.0))
                return df
    return pl.DataFrame()


# ──────────────────────────────────────────
# VOC 데이터 로더
# ──────────────────────────────────────────
def load_voc(brd_cd: str) -> pl.DataFrame:
    """매장 VOC 데이터 로드

    Columns: BRD_CD, DT, SHOP_ID, SHOP_NM, SHOP_VOC_SALE_TREND,
    SHOP_VOC_STYLE_BEST, SHOP_VOC_STYLE_WORST, SHOP_VOC_STYLE_REORD,
    SHOP_VOC_REQ_MD_TEAM, SHOP_VOC_REQ_SALES_TEAM, SHOP_VOC_REQ_SOUCING,
    SHOP_VOC_REQ_STYLE, SHOP_VOC_REQ_VMD, SHOP_VOC_OTHER_BRAND,
    SHOP_VOC_DEPARTMNET_CHANNEL, SHOP_VOC_ETC, SHOP_VOC_STYLE_OTHER
    """
    filename = _VOC_FILE_MAP.get(brd_cd)
    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                return pl.DataFrame(rows)
    return pl.DataFrame()


# ──────────────────────────────────────────
# 협력사 데이터 로더
# ──────────────────────────────────────────
def load_business_partners(brd_cd: str) -> pl.DataFrame:
    """생산 협력사 정보 로드"""
    filename = _BP_FILE_MAP.get(brd_cd)
    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                return pl.DataFrame(rows)
    return pl.DataFrame()


# ──────────────────────────────────────────
# 시즌 판매 데이터 로더
# ──────────────────────────────────────────
def load_season_sale(brd_cd: str) -> dict:
    """시즌 판매 요약 (발입출판재) — 단일 행 dict 반환"""
    filename = _SEASON_SALE_FILE_MAP.get(brd_cd)
    if filename:
        path = CACHE_DIR / filename
        if path.exists():
            rows = _load_json_with_data_key(path)
            if rows:
                return rows[0]
    return {}


def load_season_sale_summary(brd_cd: str, season: str) -> dict:
    """특정 시즌의 입고수량/판매수량/판매율 요약 반환

    season_sale.json의 당해/전년 데이터에서 매칭되는 시즌을 추출.
    매칭 안 되면 order_inbound에서 입고수량만 반환.

    Returns:
        {"stor_qty": int, "sale_qty": int, "sale_rate": int, "ord_qty": int, "source": str}
    """
    from src.core.config import CURRENT_SEASON, get_prev_season

    raw = load_season_sale(brd_cd)
    result = {"stor_qty": 0, "sale_qty": 0, "sale_rate": 0, "ord_qty": 0, "source": "none"}

    if raw:
        if season == CURRENT_SEASON:
            result = {
                "stor_qty": raw.get("당해입고수량", 0),
                "sale_qty": raw.get("당해누적판매수량", 0),
                "sale_rate": raw.get("당해판매율", 0),
                "ord_qty": raw.get("당해발주수량", 0),
                "source": "season_sale",
            }
            return result
        elif season == get_prev_season(CURRENT_SEASON):
            result = {
                "stor_qty": raw.get("전년입고수량", 0),
                "sale_qty": raw.get("전년누적판매수량", 0),
                "sale_rate": raw.get("전년판매율", 0),
                "ord_qty": raw.get("전년발주수량", 0),
                "source": "season_sale",
            }
            return result

    # fallback: order_inbound에서 입고수량/발주수량만
    oi = load_order_inbound(brd_cd, season)
    if not oi.is_empty():
        stor = int(oi["STOR_QTY"].sum()) if "STOR_QTY" in oi.columns else 0
        ord_q = int(oi["ORD_QTY"].sum()) if "ORD_QTY" in oi.columns else 0
        result = {"stor_qty": stor, "sale_qty": 0, "sale_rate": 0, "ord_qty": ord_q, "source": "order_inbound"}

    return result
