"""
ISO AI Agent - F&F 지식그래프(dcsai MCP) API 클라이언트
KG API를 Python에서 호출하기 위한 래퍼
"""
import json
import subprocess
import hashlib
import time
from pathlib import Path
from typing import Any

# 캐시 디렉토리
CACHE_DIR = Path(__file__).parent.parent / "download" / "kg_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL = 3600  # 1시간


def _cache_key(api_name: str, params: dict) -> str:
    raw = json.dumps({"api": api_name, "params": params}, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> dict | None:
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - data.get("_ts", 0) < CACHE_TTL:
            return data.get("result")
    return None


def _set_cache(key: str, result: dict):
    path = CACHE_DIR / f"{key}.json"
    path.write_text(
        json.dumps({"_ts": time.time(), "result": result}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _build_filters_product(brd_cd: str, sesn: str = None, **kwargs) -> list[dict]:
    filters = [{"system_code": brd_cd, "system_field_name": "BRD_CD"}]
    if sesn:
        filters.append({"system_code": sesn, "system_field_name": "SESN"})
    return filters


def _build_filters_order(sesn_running: str = None, po_cntry: str = "한국", **kwargs) -> list[dict]:
    filters = []
    if sesn_running:
        filters.append({"system_code": sesn_running, "system_field_name": "SESN_RUNNING"})
    if po_cntry:
        filters.append({"system_code": po_cntry, "system_field_name": "PO_CNTRY_NM"})
    return filters


def _meta_info(rows: int = 20000, with_sql: bool = False) -> dict:
    return {
        "requested_record_rows": rows,
        "data_size_only": False,
        "sql_only": False,
        "with_sql": with_sql,
        "data_type": "list",
    }


# ──────────────────────────────────────────
# 오더 현황
# ──────────────────────────────────────────
def get_order_status(
    brd_cd: str,
    sesn_running: str,
    po_cntry: str = "한국",
    selectors_product: list[str] = None,
    selectors_order: list[str] = None,
    metrics: list[str] = None,
    use_cache: bool = True,
) -> dict:
    """오더 현황 조회 (get_order_status)"""
    if selectors_product is None:
        selectors_product = ["BRD_CD", "SESN", "PRDT_CD", "ITEM", "ITEM_GROUP", "PRDT_NM"]
    if selectors_order is None:
        selectors_order = [
            "PO_NO", "SESN_RUNNING", "MFAC_COMPY_NM", "ORIGIN_NM",
            "INDC_DT_REQ", "INDC_DT_CNFM", "ORD_TYPE",
        ]
    if metrics is None:
        metrics = ["ORD_QTY", "ORD_TAG_AMT"]

    params = {
        "filters_product": _build_filters_product(brd_cd),
        "filters_order": _build_filters_order(sesn_running, po_cntry),
        "selectors_product": [{"system_field_name": s} for s in selectors_product],
        "selectors_order": [{"system_field_name": s} for s in selectors_order],
        "selectors_sku": [],
        "metrics_order": [{"system_field_name": m} for m in metrics],
        "meta_info": _meta_info(),
    }

    api_schema = {
        "name": "get_order_status",
        "endpoint": "/api/v1/hq/scm/order_status",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 발주/입고 현황
# ──────────────────────────────────────────
def get_order_inbound_status(
    brd_cd: str,
    sesn_running: str,
    po_cntry: str = "한국",
    selectors_product: list[str] = None,
    selectors_order: list[str] = None,
    metrics: list[str] = None,
    use_cache: bool = True,
) -> dict:
    """발주/입고 현황 조회 (get_order_inbound_status)"""
    if selectors_product is None:
        selectors_product = ["SESN", "ITEM_GROUP", "ITEM"]
    if selectors_order is None:
        selectors_order = ["PO_NO", "SESN_RUNNING", "MFAC_COMPY_NM"]
    if metrics is None:
        metrics = ["ORD_QTY", "ORD_TAG_AMT", "STOR_QTY", "STOR_TAG_AMT"]

    params = {
        "filters_product": _build_filters_product(brd_cd),
        "filters_order": _build_filters_order(sesn_running, po_cntry),
        "selectors_product": [{"system_field_name": s} for s in selectors_product],
        "selectors_order": [{"system_field_name": s} for s in selectors_order],
        "selectors_sku": [],
        "metrics_order": [{"system_field_name": m} for m in metrics],
        "meta_info": _meta_info(),
    }

    api_schema = {
        "name": "get_order_inbound_status",
        "endpoint": "/api/v1/hq/scm/order_inbound_status",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 협력사 정보
# ──────────────────────────────────────────
def get_manufacturing_bp_info(brd_cd: str, use_cache: bool = True) -> dict:
    """생산 협력사 정보 조회"""
    params = {
        "filters_product": _build_filters_product(brd_cd),
        "meta_info": _meta_info(),
    }
    api_schema = {
        "name": "get_manufacturing_business_partner_info",
        "endpoint": "/api/v1/hq/scm/manufacturing_business_partner_info",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 원가 조회
# ──────────────────────────────────────────
def get_manufacturing_cost(
    brd_cd: str,
    sesn: str,
    po_cntry: str = "한국",
    use_cache: bool = True,
) -> dict:
    """스타일 원가 조회 (마스터 + 계정별 디테일)"""
    params = {
        "filters_product": _build_filters_product(brd_cd, sesn),
        "filters_order": _build_filters_order(po_cntry=po_cntry),
        "selectors_product": [
            {"system_field_name": s} for s in
            ["BRD_CD", "SESN", "PRDT_CD", "PRDT_NM", "ITEM_GROUP", "ITEM"]
        ],
        "selectors_order": [
            {"system_field_name": s} for s in
            ["PO_NO", "MFAC_COMPY_NM", "PO_CNTRY_NM"]
        ],
        "selectors_cost": [
            {"system_field_name": s} for s in [
                "MFAC_COST_QUOTATION_STAT_NM",
                "MFAC_COST_SUPPLIER_OFFER_COST_AMT",
                "MFAC_COST_SUPPLIER_NEGO_COST_AMT",
                "MFAC_COST_MFAC_COST_AMT",
                "MFAC_COST_MARKUP",
                "MFAC_COST_TAG_AMT",
                "MFAC_COST_EXCHAGE_RATE",
            ]
        ],
        "selectors_cost_account": [
            {"system_field_name": s} for s in [
                "MFAC_COST_ACCOUNT_TYPE1_NM",
                "MFAC_COST_ACCOUNT_TYPE2_NM",
                "MFAC_COST_UNIT_COST",
                "MFAC_COST_COST_AMT",
            ]
        ],
        "meta_info": _meta_info(),
    }
    api_schema = {
        "name": "get_product_po_manufacturing_cost",
        "endpoint": "/api/v1/hq/scm/product_po_manufacturing_cost",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 선적 이행률
# ──────────────────────────────────────────
def get_trade_fulfillment(brd_cd: str, sesn: str, use_cache: bool = True) -> dict:
    """발주-선적 이행률 조회"""
    params = {
        "filters_product": _build_filters_product(brd_cd, sesn),
        "filters_order": [],
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_CNTRY_NM"},
            {"system_field_name": "MFAC_COMPY_NM"},
        ],
        "selectors_intl_trade_dtl": [],
        "meta_info": _meta_info(),
    }
    api_schema = {
        "name": "get_intl_trade_fulfillment_rate",
        "endpoint": "/api/v1/hq/scm/intl_trade_fulfillment_rate",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 리드타임/지연
# ──────────────────────────────────────────
def get_trade_leadtime(brd_cd: str, sesn: str, use_cache: bool = True) -> dict:
    """선적 리드타임/지연 분석"""
    params = {
        "filters_product": _build_filters_product(brd_cd, sesn),
        "filters_order": [],
        "filters_intl_trade": [
            {"system_code": "IMP", "system_field_name": "INTL_TRADE_TYPE"},
        ],
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "MFAC_COMPY_NM"},
            {"system_field_name": "STOR_REQ_DT"},
        ],
        "selectors_intl_trade": [
            {"system_field_name": "INTL_TRADE_FORWARDER_NM"},
            {"system_field_name": "INTL_TRADE_ORIGIN_NM"},
        ],
        "selectors_lead_time": [
            {"system_field_name": s} for s in [
                "TRANSIT_DAYS", "DELAY_ETD_DAYS", "DELAY_GR_DAYS",
                "IS_DELAYED_ETD", "IS_NOT_DEPARTED",
            ]
        ],
        "metrics_order": [],
        "metrics_intl_trade": [
            {"system_field_name": "INTL_TRADE_IV_ACT_QTY"},
        ],
        "period_date_field": "INTL_TRADE_BK_DT",
        "meta_info": _meta_info(),
    }
    api_schema = {
        "name": "get_intl_trade_lead_time",
        "endpoint": "/api/v1/hq/scm/intl_trade_lead_time",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 클레임
# ──────────────────────────────────────────
def get_claim_receipt(brd_cd: str, start_dt: str = None, end_dt: str = None, use_cache: bool = True) -> dict:
    """소비자 클레임 접수 조회"""
    params = {
        "filters_product": _build_filters_product(brd_cd),
        "meta_info": _meta_info(),
    }
    api_schema = {
        "name": "get_claim_receipt",
        "endpoint": "/api/v1/hq/scm/claim_receipt",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 입고 예정
# ──────────────────────────────────────────
def get_inbound_booking(use_cache: bool = True) -> dict:
    """물류 입고 예정 정보"""
    params = {"meta_info": _meta_info()}
    api_schema = {
        "name": "get_inbound_booking_status",
        "endpoint": "/api/v1/hq/scm/inbound_booking_status",
        "method": "POST",
    }
    return _call_kg_api(api_schema, params, use_cache)


# ──────────────────────────────────────────
# 공통 API 호출 (dcsai MCP 프록시)
# ──────────────────────────────────────────
def _call_kg_api(api_schema: dict, params: dict, use_cache: bool = True) -> dict:
    """
    dcsai MCP의 execute_kg_api_to_context를 호출.
    Streamlit 환경에서는 MCP를 직접 호출할 수 없으므로,
    캐시된 데이터를 사용하거나 별도 스크립트로 데이터를 미리 가져옴.
    """
    cache_key = _cache_key(api_schema["name"], params)

    if use_cache:
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

    # MCP 직접 호출은 Claude Code 세션에서만 가능
    # Streamlit 런타임에서는 캐시 데이터를 사용
    # 데이터가 없으면 빈 결과 반환
    return {"status": "no_cache", "data": [], "message": f"캐시 없음: {api_schema['name']}. Claude Code에서 데이터를 먼저 가져와주세요."}


def save_to_cache(api_name: str, params: dict, result: dict):
    """외부에서 가져온 데이터를 캐시에 저장"""
    key = _cache_key(api_name, params)
    _set_cache(key, result)
