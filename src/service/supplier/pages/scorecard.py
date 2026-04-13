"""
Cat.4 협력사 종합 스코어카드
발주/입고 + 원가 + 클레임 데이터를 조합하여 협력사별 종합 스코어 산출
데이터 소스: KG 캐시 (order_inbound, cost, claim 조합)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CURRENT_SEASON,
    CHART_COLORS,
    SUPPLIER_SCORE_COLORS,
    SUPPLIER_SCORE_ICONS,
    SUPPLIER_SCORE_WEIGHTS,
    GRADE_MAP,
    PLOTLY_TEMPLATE_CONFIG,
    get_supplier_grade,
)
from src.core.data_loader import load_order_inbound, load_cost_master, load_claims


@st.cache_data(ttl=600)
def _build_supplier_scorecard(brd_cd: str, season: str) -> pl.DataFrame:
    """발주/입고/원가/클레임에서 협력사별 스코어 산출"""
    # 1) 발주/입고 데이터 → 이행률 (납기 스코어)
    order_df = load_order_inbound(brd_cd, season)

    # 2) 원가 데이터 → 마크업 (원가 스코어)
    cost_df = load_cost_master(brd_cd, season)

    # 3) 클레임 데이터 → 클레임율 (품질 스코어)
    claim_df = load_claims(brd_cd)

    # 협력사 목록 수집
    suppliers = set()
    if not order_df.is_empty() and "MFAC_COMPY_NM" in order_df.columns:
        suppliers.update(order_df["MFAC_COMPY_NM"].drop_nulls().unique().to_list())
    if not cost_df.is_empty() and "MFAC_COMPY_NM" in cost_df.columns:
        suppliers.update(cost_df["MFAC_COMPY_NM"].drop_nulls().unique().to_list())

    if not suppliers:
        return pl.DataFrame()

    rows = []
    for supplier in sorted(suppliers):
        # 납기 스코어: 입고수량/발주수량 * 100 (이행률 기반)
        delivery_score = 80.0  # 기본값
        if not order_df.is_empty() and "MFAC_COMPY_NM" in order_df.columns:
            s_order = order_df.filter(pl.col("MFAC_COMPY_NM") == supplier)
            if not s_order.is_empty():
                ord_qty = s_order["ORD_QTY"].sum() if "ORD_QTY" in s_order.columns else 0
                stor_qty = s_order["STOR_QTY"].sum() if "STOR_QTY" in s_order.columns else 0
                if ord_qty > 0:
                    fulfill_rate = min(stor_qty / ord_qty * 100, 100)
                    delivery_score = fulfill_rate

        # 품질 스코어: 100 - (클레임율 * 10) — 클레임 적을수록 높은 점수
        quality_score = 90.0
        if not claim_df.is_empty() and "MFAC_COMPY_NM" in claim_df.columns:
            s_claim = claim_df.filter(pl.col("MFAC_COMPY_NM") == supplier)
            claim_qty = s_claim["CLAIM_QTY"].sum() if not s_claim.is_empty() else 0
            if claim_qty > 0:
                quality_score = max(100 - claim_qty * 0.5, 30)

        # 원가 스코어: 마크업 기반 (3.0 이상이면 95, 2.5~3.0이면 80, 미만이면 60)
        cost_score = 80.0
        if not cost_df.is_empty() and "MFAC_COMPY_NM" in cost_df.columns:
            s_cost = cost_df.filter(pl.col("MFAC_COMPY_NM") == supplier)
            if not s_cost.is_empty() and "MFAC_COST_MARKUP" in s_cost.columns:
                avg_mu = s_cost["MFAC_COST_MARKUP"].mean()
                if avg_mu and avg_mu > 0:
                    if avg_mu >= 3.0:
                        cost_score = 95
                    elif avg_mu >= 2.5:
                        cost_score = 80
                    else:
                        cost_score = 60

        # 대응력/준법은 정량화 데이터 없으므로 기본값
        response_score = 80.0
        compliance_score = 85.0

        # 종합점수
        composite = (
            delivery_score * SUPPLIER_SCORE_WEIGHTS["납기"] +
            quality_score * SUPPLIER_SCORE_WEIGHTS["품질"] +
            cost_score * SUPPLIER_SCORE_WEIGHTS["원가"] +
            response_score * SUPPLIER_SCORE_WEIGHTS["대응력"] +
            compliance_score * SUPPLIER_SCORE_WEIGHTS["준법"]
        )

        grade_info = get_supplier_grade(composite)

        rows.append({
            "협력사": supplier,
            "납기": round(delivery_score, 1),
            "품질": round(quality_score, 1),
            "원가": round(cost_score, 1),
            "대응력": round(response_score, 1),
            "준법": round(compliance_score, 1),
            "종합점수": round(composite, 1),
            "등급": grade_info["grade"],
            "등급아이콘": grade_info["icon"],
        })

    return pl.DataFrame(rows).sort("종합점수", descending=True)


def _build_grade_dist_chart(df: pl.DataFrame) -> go.Figure:
    """등급 분포 Bar"""
    if df.is_empty():
        return go.Figure()

    grade_counts = df.group_by("등급").len().sort("등급")
    grades = grade_counts["등급"].to_list()
    counts = grade_counts["len"].to_list()
    colors = [GRADE_MAP.get(g, {}).get("color", "#6b7280") for g in grades]

    fig = go.Figure(data=[go.Bar(
        x=grades, y=counts, marker_color=colors,
        text=[f"{v}개" for v in counts], textposition="outside",
    )])
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="등급별 협력사 분포", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="등급"), yaxis=dict(title="협력사 수", gridcolor=tc["gridcolor"]),
        height=350, margin=dict(l=60, r=20, t=60, b=60),
    )
    return fig


def _build_radar_chart(df: pl.DataFrame, top_n: int = 5) -> go.Figure:
    """TOP N 협력사 Radar Chart"""
    if df.is_empty():
        return go.Figure()

    top = df.head(top_n)
    categories = ["납기", "품질", "원가", "대응력", "준법"]

    fig = go.Figure()
    for i, row in enumerate(top.iter_rows(named=True)):
        values = [row[c] for c in categories] + [row[categories[0]]]
        fig.add_trace(go.Scatterpolar(
            r=values,
            theta=categories + [categories[0]],
            name=f'{row["등급아이콘"]} {row["협력사"]} ({row["종합점수"]})',
            line=dict(color=CHART_COLORS[i % len(CHART_COLORS)]),
        ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
        title=dict(text=f"TOP {top_n} 협력사 역량 비교", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        height=450, margin=dict(l=60, r=60, t=80, b=40),
    )
    return fig


def render():
    st.markdown("## 협력사 종합 스코어카드")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    df = _build_supplier_scorecard(brd_cd, season)
    if df.is_empty():
        st.warning(f"{brand_name} 협력사 데이터가 없습니다.")
        return

    st.caption(f"{brand_name} | 시즌: {season} | 협력사: {df.height}개 | * 대응력/준법은 정성평가(Google Sheets) 연동 시 실제값 반영 예정")

    col1, col2 = st.columns([1, 2])
    with col1:
        st.plotly_chart(_build_grade_dist_chart(df), use_container_width=True)
    with col2:
        st.plotly_chart(_build_radar_chart(df), use_container_width=True)

    st.markdown("---")
    st.markdown("### 협력사 스코어카드 상세")
    display_df = df.select(["등급아이콘", "협력사", "종합점수", "등급", "납기", "품질", "원가", "대응력", "준법"])
    st.dataframe(display_df.to_pandas(), use_container_width=True, hide_index=True,
                 height=min(600, 40 + df.height * 35))
