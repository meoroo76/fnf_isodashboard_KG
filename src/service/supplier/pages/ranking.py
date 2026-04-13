"""
Cat.4 협력사 랭킹
종합점수 기반 랭킹, 카테고리별 비교, 이행률 Bar
데이터 소스: KG 캐시 (order_inbound, cost, claim 조합)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CHART_COLORS,
    GRADE_MAP,
    PLOTLY_TEMPLATE_CONFIG,
    get_supplier_grade,
)
from src.service.supplier.pages.scorecard import _build_supplier_scorecard
from src.core.data_loader import load_order_inbound


@st.cache_data(ttl=600)
def _load_scorecard(brd_cd: str, season: str) -> pl.DataFrame:
    return _build_supplier_scorecard(brd_cd, season)


def _build_ranking_bar(df: pl.DataFrame) -> go.Figure:
    """종합점수 Horizontal Bar"""
    if df.is_empty():
        return go.Figure()

    suppliers = df["협력사"].to_list()
    scores = df["종합점수"].to_list()
    grades = df["등급"].to_list()
    colors = [GRADE_MAP.get(g, {}).get("color", "#6b7280") for g in grades]

    fig = go.Figure(data=[go.Bar(
        x=scores, y=suppliers, orientation="h",
        marker_color=colors,
        text=[f"{v:.1f}" for v in scores], textposition="outside",
    )])
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="협력사 종합점수 랭킹", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="종합점수", range=[0, 105], gridcolor=tc["gridcolor"]),
        yaxis=dict(autorange="reversed"),
        height=max(350, df.height * 40),
        margin=dict(l=180, r=40, t=60, b=60),
    )
    return fig


def _build_fulfillment_chart(brd_cd: str, season: str, suppliers: list[str]) -> go.Figure:
    """협력사별 이행률 Bar"""
    order_df = load_order_inbound(brd_cd, season)
    if order_df.is_empty() or "MFAC_COMPY_NM" not in order_df.columns:
        return go.Figure()

    rows = []
    for s in suppliers:
        s_df = order_df.filter(pl.col("MFAC_COMPY_NM") == s)
        if s_df.is_empty():
            continue
        ord_qty = s_df["ORD_QTY"].sum() if "ORD_QTY" in s_df.columns else 0
        stor_qty = s_df["STOR_QTY"].sum() if "STOR_QTY" in s_df.columns else 0
        rate = min(stor_qty / ord_qty * 100, 100) if ord_qty > 0 else 0
        rows.append({"supplier": s, "rate": rate, "ord": ord_qty, "stor": stor_qty})

    if not rows:
        return go.Figure()

    rows.sort(key=lambda x: -x["rate"])
    names = [r["supplier"] for r in rows]
    rates = [r["rate"] for r in rows]
    colors = ["#16A34A" if r >= 95 else "#F59E0B" if r >= 85 else "#EF4444" for r in rates]

    fig = go.Figure(data=[go.Bar(
        x=rates, y=names, orientation="h", marker_color=colors,
        text=[f"{v:.1f}%" for v in rates], textposition="outside",
    )])
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="협력사별 입고 이행률", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="이행률 (%)", range=[0, 110], gridcolor=tc["gridcolor"]),
        yaxis=dict(autorange="reversed"),
        height=max(350, len(rows) * 40),
        margin=dict(l=180, r=40, t=60, b=60),
    )
    return fig


def render():
    st.markdown("## 협력사 랭킹")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    df = _load_scorecard(brd_cd, season)
    if df.is_empty():
        st.warning(f"{brand_name} 협력사 데이터가 없습니다.")
        return

    st.caption(f"{brand_name} | 시즌: {season}")

    col1, col2 = st.columns(2)
    with col1:
        st.plotly_chart(_build_ranking_bar(df), use_container_width=True)
    with col2:
        suppliers = df["협력사"].to_list()
        st.plotly_chart(_build_fulfillment_chart(brd_cd, season, suppliers), use_container_width=True)

    st.markdown("---")
    st.markdown("### 전체 랭킹 테이블")
    rank_df = df.with_row_index("순위", offset=1)
    st.dataframe(rank_df.to_pandas(), use_container_width=True, hide_index=True)
