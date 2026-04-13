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
