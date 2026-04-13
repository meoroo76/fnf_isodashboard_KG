"""
Cat.2 마크업 분석 페이지
마크업 분포 히스토그램, 상태별 건수, 네고 성과
데이터 소스: KG 캐시 (get_product_po_manufacturing_cost)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CURRENT_SEASON,
    PREV_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    STATUS_COLORS,
    calc_markup,
    get_markup_verdict,
)
from src.core.data_loader import load_cost_master

try:
    from src.service.common.components import (
        season_filter,
        format_number,
    )
    _HAS_COMPONENTS = True
except ImportError:
    _HAS_COMPONENTS = False

    def season_filter(current=CURRENT_SEASON, options=None, key="season_filter") -> str:
        if options is None:
            options = [current]
        if key in st.session_state and st.session_state[key] not in options:
            del st.session_state[key]
        return st.selectbox("운용시즌", options, index=0, key=key)

    def format_number(value, unit=""):
        if value is None:
            return "-"
        return f"{value:,.1f}{unit}"


# ──────────────────────────────────────────
# 데이터 로드
# ──────────────────────────────────────────
@st.cache_data(ttl=600)
def _load_master(brd_cd: str, season: str) -> pl.DataFrame:
    return load_cost_master(brd_cd, season)


# ──────────────────────────────────────────
# 차트: 마크업 분포 Histogram
# ──────────────────────────────────────────
def _build_markup_histogram(master: pl.DataFrame) -> go.Figure:
    markups = master["MFAC_COST_MARKUP"].to_list()
    # 0이거나 극단값 제외
    markups = [m for m in markups if 0 < m < 20]

    fig = go.Figure(data=[go.Histogram(
        x=markups,
        nbinsx=15,
        marker_color="#4f46e5",
        opacity=0.85,
        hovertemplate="마크업: %{x:.2f}x<br>건수: %{y}<extra></extra>",
    )])

    fig.add_vline(x=3.0, line_dash="dash", line_color="#16A34A",
                  annotation_text="양호 (3.0x)", annotation_position="top right")
    fig.add_vline(x=2.5, line_dash="dash", line_color="#F59E0B",
                  annotation_text="주의 (2.5x)", annotation_position="top left")

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="스타일별 마크업 분포", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="마크업 (배율)", gridcolor=tc["gridcolor"]),
        yaxis=dict(title="스타일 수", gridcolor=tc["gridcolor"]),
        height=400,
        margin=dict(l=60, r=20, t=60, b=60),
    )
    return fig


# ──────────────────────────────────────────
# 마크업 상태별 건수 카드
# ──────────────────────────────────────────
def _render_markup_status_cards(master: pl.DataFrame) -> None:
    markups = master["MFAC_COST_MARKUP"].to_list()
    markups = [m for m in markups if m > 0]

    good_count = sum(1 for m in markups if m >= 3.0)
    warn_count = sum(1 for m in markups if 2.5 <= m < 3.0)
    danger_count = sum(1 for m in markups if m < 2.5)

    statuses = [
        ("good", good_count, "양호"),
        ("warn", warn_count, "주의"),
        ("danger", danger_count, "위험"),
    ]

    cols = st.columns(3)
    for idx, (key, count, label) in enumerate(statuses):
        cfg = STATUS_COLORS[key]
        with cols[idx]:
            st.markdown(
                f"""
                <div style="background:{cfg['bg']}; border:2px solid {cfg['border']};
                            border-radius:12px; padding:20px; text-align:center;">
                    <div style="font-size:36px; font-weight:700; color:{cfg['color']};">
                        {cfg['icon']} {count}건
                    </div>
                    <div style="font-size:14px; color:{cfg['color']}; margin-top:4px;">
                        {label} (M/U {'>=3.0' if key == 'good' else '2.5~3.0' if key == 'warn' else '<2.5'})
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )


# ──────────────────────────────────────────
# 차트: 카테고리별 마크업 Box Plot
# ──────────────────────────────────────────
def _build_category_markup_box(master: pl.DataFrame) -> go.Figure:
    """카테고리별 마크업 분포 Box Plot"""
    categories = master["ITEM_GROUP"].unique().sort().to_list()

    fig = go.Figure()
    colors = ["#4f46e5", "#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626"]

    for i, cat in enumerate(categories):
        cat_data = master.filter(pl.col("ITEM_GROUP") == cat)
        markups = cat_data["MFAC_COST_MARKUP"].to_list()
        markups = [m for m in markups if 0 < m < 20]
        if markups:
            fig.add_trace(go.Box(
                y=markups,
                name=cat,
                marker_color=colors[i % len(colors)],
                boxmean=True,
            ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="카테고리별 마크업 분포", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        yaxis=dict(title="마크업 (배율)", gridcolor=tc["gridcolor"]),
        height=450,
        margin=dict(l=60, r=20, t=60, b=60),
    )
    return fig


# ──────────────────────────────────────────
# 차트: 네고 성과 — 협력사별 제시가 vs 협상가
# ─────────────────────────────────────��────
def _build_nego_chart(master: pl.DataFrame) -> go.Figure:
    """협력사별 평균 제시가 vs 협상가 Grouped Bar"""
    # 제시가/협상가��� 0보다 큰 데���터만
    nego_df = master.filter(
        (pl.col("MFAC_COST_SUPPLIER_OFFER_COST_AMT") > 0) &
        (pl.col("MFAC_COST_SUPPLIER_NEGO_COST_AMT") > 0)
    )
    if nego_df.is_empty():
        return go.Figure()

    supplier_df = (
        nego_df.group_by("MFAC_COMPY_NM")
        .agg([
            (pl.col("MFAC_COST_SUPPLIER_OFFER_COST_AMT") * 1.1).mean().alias("avg_offer"),
            (pl.col("MFAC_COST_SUPPLIER_NEGO_COST_AMT") * 1.1).mean().alias("avg_nego"),
            pl.len().alias("cnt"),
        ])
        .filter(pl.col("cnt") >= 2)
        .sort("avg_offer", descending=True)
        .head(10)
    )

    if supplier_df.is_empty():
        return go.Figure()

    suppliers = supplier_df["MFAC_COMPY_NM"].to_list()
    offers = supplier_df["avg_offer"].to_list()
    negos = supplier_df["avg_nego"].to_list()
    savings = [(o - n) / o * 100 if o > 0 else 0 for o, n in zip(offers, negos)]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=suppliers, y=offers,
        name="제시가 (USD, VAT포함)",
        marker_color="#ef4444",
        text=[f"${v:,.0f}" for v in offers],
        textposition="outside",
        textfont=dict(size=11),
    ))
    fig.add_trace(go.Bar(
        x=suppliers, y=negos,
        name="협상가 (USD, VAT포함)",
        marker_color="#10b981",
        text=[f"${v:,.0f}" for v in negos],
        textposition="outside",
        textfont=dict(size=11),
    ))

    for i, (s, sav) in enumerate(zip(suppliers, savings)):
        if sav > 0:
            fig.add_annotation(
                x=s, y=max(offers[i], negos[i]) + 15,
                text=f"v{sav:.1f}%",
                showarrow=False,
                font=dict(size=11, color="#059669"),
            )

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        barmode="group",
        title=dict(text="네고 성과: 협력사별 제시가 vs 협상가 (VAT포함)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="협력사", tickangle=-30),
        yaxis=dict(title="평균 원가 (USD)", gridcolor=tc["gridcolor"]),
        height=450,
        margin=dict(l=60, r=20, t=60, b=100),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
    )
    return fig


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.2 마크업 분석"""
    st.markdown("## 마크업 분석")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")

    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    master = _load_master(brd_cd, season)
    if master.is_empty():
        st.warning(f"{brand_name} {season} 시즌 원가 데이터가 없습니다.")
        return

    avg_exchange = master["MFAC_COST_EXCHAGE_RATE"].filter(master["MFAC_COST_EXCHAGE_RATE"] > 0).mean()
    if avg_exchange is None or avg_exchange == 0:
        avg_exchange = 1350.0
    st.caption(f"{brand_name} | 시즌: {season} | 환율: {avg_exchange:,.0f}원/USD | * 원가는 VAT 포함 기준")

    # ── 마크업 상태별 건수 카드 ──
    st.markdown("### 마크업 상태 요약")
    _render_markup_status_cards(master)
    st.markdown("")

    # ─�� 카테고리별 마크업 Box Plot ──
    fig_box = _build_category_markup_box(master)
    st.plotly_chart(fig_box, use_container_width=True)
    st.markdown("---")

    # ── 마크업 분포 히스토그램 ──
    fig_hist = _build_markup_histogram(master)
    st.plotly_chart(fig_hist, use_container_width=True)
    st.markdown("---")

    # ── 네고 성과 ──
    st.markdown("### 네고 성과")
    fig_nego = _build_nego_chart(master)
    if fig_nego.data:
        st.plotly_chart(fig_nego, use_container_width=True)

        # 네고 요약
        nego_df = master.filter(
            (pl.col("MFAC_COST_SUPPLIER_OFFER_COST_AMT") > 0) &
            (pl.col("MFAC_COST_SUPPLIER_NEGO_COST_AMT") > 0)
        )
        total_offer = (nego_df["MFAC_COST_SUPPLIER_OFFER_COST_AMT"] * 1.1).sum()
        total_nego = (nego_df["MFAC_COST_SUPPLIER_NEGO_COST_AMT"] * 1.1).sum()
        total_saving = total_offer - total_nego
        saving_rate = (total_saving / total_offer * 100) if total_offer > 0 else 0

        st.markdown(
            f"""
            <div style="background:#ecfdf5; border:1px solid #a7f3d0;
                        border-radius:8px; padding:16px; margin-top:8px;">
                <span style="font-size:14px; color:#059669;">
                    총 네고 절감: <b>${total_saving:,.0f}</b> (절감율: <b>{saving_rate:.1f}%</b>)
                    | 제시가 합계: ${total_offer:,.0f} -> 협상가 합계: ${total_nego:,.0f}
                    | * VAT 포함 기준
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.info("제시가/협상가 데이터가 있는 PO가 부족하여 네고 성과를 표시할 수 없습니다.")
