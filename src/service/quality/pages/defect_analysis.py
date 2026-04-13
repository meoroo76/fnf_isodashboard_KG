"""
Cat.3 불량 유형 분석
불량유형별 상세, 협력사×불량유형 Heatmap, 스타일 TOP10
데이터 소스: KG 캐시 (get_claim_receipt)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CHART_COLORS,
    DEFECT_TYPE_COLORS,
    DEFECT_TYPE_ICONS,
    CATEGORY_COLORS,
    PLOTLY_TEMPLATE_CONFIG,
)
from src.core.data_loader import load_claims


@st.cache_data(ttl=600)
def _load_claims(brd_cd: str) -> pl.DataFrame:
    return load_claims(brd_cd)


def _build_defect_heatmap(df: pl.DataFrame) -> go.Figure:
    """협력사 x 불량유형 Heatmap"""
    if df.is_empty():
        return go.Figure()

    pivot = (
        df.filter(
            pl.col("MFAC_COMPY_NM").is_not_null() &
            pl.col("CLAIM_CONTS_ANAL_GROUP_NM").is_not_null()
        )
        .group_by(["MFAC_COMPY_NM", "CLAIM_CONTS_ANAL_GROUP_NM"])
        .agg(pl.col("CLAIM_QTY").sum().alias("qty"))
    )

    if pivot.is_empty():
        return go.Figure()

    # TOP 8 협력사 + TOP 8 불량유형
    top_suppliers = (
        pivot.group_by("MFAC_COMPY_NM").agg(pl.col("qty").sum())
        .sort("qty", descending=True).head(8)["MFAC_COMPY_NM"].to_list()
    )
    top_types = (
        pivot.group_by("CLAIM_CONTS_ANAL_GROUP_NM").agg(pl.col("qty").sum())
        .sort("qty", descending=True).head(8)["CLAIM_CONTS_ANAL_GROUP_NM"].to_list()
    )

    pivot_filtered = pivot.filter(
        pl.col("MFAC_COMPY_NM").is_in(top_suppliers) &
        pl.col("CLAIM_CONTS_ANAL_GROUP_NM").is_in(top_types)
    )

    # 매트릭스 구성
    z = []
    for supplier in top_suppliers:
        row = []
        for dtype in top_types:
            val = pivot_filtered.filter(
                (pl.col("MFAC_COMPY_NM") == supplier) &
                (pl.col("CLAIM_CONTS_ANAL_GROUP_NM") == dtype)
            )
            row.append(val["qty"].sum() if not val.is_empty() else 0)
        z.append(row)

    fig = go.Figure(data=go.Heatmap(
        z=z, x=top_types, y=top_suppliers,
        colorscale="Reds",
        text=[[f"{v:,.0f}" for v in row] for row in z],
        texttemplate="%{text}",
        hovertemplate="협력사: %{y}<br>불량유형: %{x}<br>건수: %{text}<extra></extra>",
    ))
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="협력사 x 불량유형 Heatmap", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        height=450, margin=dict(l=150, r=20, t=60, b=80),
    )
    return fig


def _build_category_defect_bar(df: pl.DataFrame) -> go.Figure:
    """카테고리별 불량 건수"""
    if df.is_empty() or "ITEM_GROUP" not in df.columns:
        return go.Figure()

    agg = (
        df.group_by("ITEM_GROUP").agg(pl.col("CLAIM_QTY").sum().alias("qty"))
        .sort("qty", descending=True)
    )
    cats = agg["ITEM_GROUP"].to_list()
    qtys = agg["qty"].to_list()
    colors = [CATEGORY_COLORS.get(c, "#4f46e5") for c in cats]

    fig = go.Figure(data=[go.Bar(
        x=cats, y=qtys, marker_color=colors,
        text=[f"{v:,.0f}" for v in qtys], textposition="outside",
    )])
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="카테고리별 클레임 건수", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="카테고리"), yaxis=dict(title="건수", gridcolor=tc["gridcolor"]),
        height=400, margin=dict(l=60, r=20, t=60, b=60),
    )
    return fig


def render():
    st.markdown("## 불량 유형 분석")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    df = _load_claims(brd_cd)

    if df.is_empty():
        st.warning(f"{brand_name} 클레임 데이터가 없습니다.")
        return

    st.caption(f"{brand_name} | 기간: 2025.01 ~ 2026.04")

    col1, col2 = st.columns(2)
    with col1:
        st.plotly_chart(_build_defect_heatmap(df), use_container_width=True)
    with col2:
        st.plotly_chart(_build_category_defect_bar(df), use_container_width=True)

    # 스타일별 TOP 10
    st.markdown("---")
    st.markdown("### 클레임 TOP 10 스타일")
    top_styles = (
        df.group_by(["PRDT_CD", "PRDT_NM", "ITEM_GROUP"])
        .agg([
            pl.col("CLAIM_QTY").sum().alias("클레임수량"),
            pl.col("CLAIM_CONTS_ANAL_GROUP_NM").first().alias("주요불량유형"),
            pl.col("MFAC_COMPY_NM").first().alias("협력사"),
        ])
        .sort("클레임수량", descending=True).head(10)
    )
    if not top_styles.is_empty():
        st.dataframe(top_styles.to_pandas(), use_container_width=True, hide_index=True)
