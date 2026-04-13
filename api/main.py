"""
ISO AI Agent - FastAPI Backend
기존 data_loader 로직을 API로 제공
"""
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from src.core.data_loader import (
    load_order_inbound,
    load_cost_master,
    load_cost_account,
    load_claims,
    load_voc,
    load_season_sale,
    load_season_sale_summary,
    get_available_data,
    get_available_cost_data,
)
from src.core.config import BRANDS, CURRENT_SEASON, get_prev_season, KPI_CARD_REGISTRY

app = FastAPI(title="ISO AI Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 헬퍼 ──
def _df_to_records(df) -> list[dict]:
    if df.is_empty():
        return []
    return df.to_dicts()


# ── 메타 ──
@app.get("/api/brands")
def get_brands():
    return {"brands": BRANDS, "current_season": CURRENT_SEASON}


@app.get("/api/available-data")
def available_data():
    return {
        "order_inbound": get_available_data(),
        "cost": get_available_cost_data(),
    }


# ── 오더/입고 ──
@app.get("/api/order-inbound")
def order_inbound(
    brd_cd: str = Query(...),
    sesn: str = Query(...),
):
    df = load_order_inbound(brd_cd, sesn)
    return {"data": _df_to_records(df), "count": df.height}


# ── 원가 ──
@app.get("/api/cost/master")
def cost_master(
    brd_cd: str = Query(...),
    sesn: str = Query(...),
):
    df = load_cost_master(brd_cd, sesn)
    return {"data": _df_to_records(df), "count": df.height}


@app.get("/api/cost/account")
def cost_account(
    brd_cd: str = Query(...),
    sesn: str = Query(...),
):
    df = load_cost_account(brd_cd, sesn)
    return {"data": _df_to_records(df), "count": df.height}


# ── 클레임 ──
@app.get("/api/claims")
def claims(brd_cd: str = Query(...)):
    df = load_claims(brd_cd)
    return {"data": _df_to_records(df), "count": df.height}


# ── VOC ──
@app.get("/api/voc")
def voc(brd_cd: str = Query(...)):
    df = load_voc(brd_cd)
    return {"data": _df_to_records(df), "count": df.height}


# ── 시즌 판매 ──
@app.get("/api/season-sale")
def season_sale(brd_cd: str = Query(...)):
    data = load_season_sale(brd_cd)
    return {"data": data}


@app.get("/api/season-sale/summary")
def season_sale_summary(
    brd_cd: str = Query(...),
    sesn: str = Query(...),
):
    data = load_season_sale_summary(brd_cd, sesn)
    return {"data": data}


# ── KPI 레지스트리 ──
@app.get("/api/kpi-registry")
def kpi_registry():
    return {"registry": KPI_CARD_REGISTRY}


# ── 스타일 이미지 URL 조회 (KG API 프록시) ──
# 이미지 캐시 (서버 메모리)
_img_cache: dict[str, str | None] = {}


@app.get("/api/style-images")
def style_images(prdt_cds: str = Query(..., description="콤마 구분 품번 리스트")):
    """KG API로 품번별 이미지 URL 일괄 조회 (캐시 사용)"""
    import json
    import subprocess
    import tempfile
    import glob
    import os

    codes = [c.strip() for c in prdt_cds.split(",") if c.strip()]
    if not codes:
        return {"data": {}}

    result_map: dict[str, str | None] = {}
    to_fetch: list[str] = []

    for code in codes:
        if code in _img_cache:
            result_map[code] = _img_cache[code]
        else:
            to_fetch.append(code)

    # 미캐시 품번만 KG API 조회
    for code in to_fetch[:30]:
        try:
            brd_cd = "V" if code.startswith("V") else "ST"
            body = json.dumps({
                "filters": [
                    {"system_code": brd_cd, "system_field_name": "BRD_CD"},
                    {"system_code": code, "system_field_name": "PRDT_CD"},
                ],
                "meta_info": {"data_size_only": False, "data_type": "list", "requested_record_rows": 1},
            })
            proc = subprocess.run(
                ["dcs-ai-cli", "fetch",
                 "--endpoint", "/api/v1/hq/search/product_codes_properties",
                 "--method", "POST",
                 "--body", body,
                 "--name", f"img_{code}"],
                capture_output=True, text=True, timeout=10,
            )
            tmpdir = tempfile.gettempdir()
            files = sorted(glob.glob(os.path.join(tmpdir, "dcs-ai-cli", f"img_{code}_*.json")))
            if files:
                raw = json.loads(open(files[-1], encoding="utf-8").read())
                data = raw.get("data", raw) if isinstance(raw, dict) else raw
                if isinstance(data, list) and data:
                    url = data[0].get("PRDT_IMG_URL")
                    _img_cache[code] = url
                    result_map[code] = url
                else:
                    _img_cache[code] = None
                    result_map[code] = None
        except Exception:
            _img_cache[code] = None
            result_map[code] = None

    return {"data": result_map}
