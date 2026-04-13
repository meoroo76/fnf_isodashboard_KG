"""
Cat.2 시즌간 원가 비교 페이지
시즌별 대분류 비중 Grouped Bar, 카테고리별 원가 Heatmap, 요약 테이블
데이터 소스: KG 캐시 (get_product_po_manufacturing_cost)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CATEGORY_COLORS,
    COMPARE_COLORS,
    COST_ITEM_COLORS,
    COST_ITEM_ICONS,
    CURRENT_SEASON,
    PREV_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    calc_cost_rate,
    calc_yoy,
    get_prev_season,
)
from src.core.data_loader import load_cost_master, load_cost_account, get_available_cost_data

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


@st.cache_data(ttl=600)
def _load_account(brd_cd: str, season: str) -> pl.DataFrame:
    return load_cost_account(brd_cd, season)


def _get_available_seasons(brd_cd: str) -> list[str]:
    """해당 브랜드의 사용 가능한 시즌 목록"""
    available = get_available_cost_data()
    return sorted([sesn for brd, sesn in available if brd == brd_cd], reverse=True)


def _calc_type1_pcts(account: pl.DataFrame) -> dict[str, float]:
    """대분류별 비중(%) 계산"""
    if account.is_empty():
        return {}
    agg = account.group_by("MFAC_COST_ACCOUNT_TYPE1_NM").agg(
        pl.col("MFAC_COST_COST_AMT").sum().alias("total")
    )
    grand = agg["total"].sum()
    if grand == 0:
        return {}
    return {r["MFAC_COST_ACCOUNT_TYPE1_NM"]: r["total"] / grand * 100 for r in agg.iter_rows(named=True)}


def _calc_category_avg_cost(master: pl.DataFrame) -> dict[str, float]:
    """카테고리별 평균원가(USD, VAT포함)"""
    if master.is_empty():
        return {}
    agg = master.group_by("ITEM_GROUP").agg(
        (pl.col("MFAC_COST_MFAC_COST_AMT") * 1.1).mean().alias("avg_cost")
    )
    return {r["ITEM_GROUP"]: r["avg_cost"] for r in agg.iter_rows(named=True)}


def _calc_season_summary(master: pl.DataFrame) -> dict:
    """시즌 요약"""
    if master.is_empty():
        return {"avg_tag": 0, "avg_cost": 0, "style_count": 0, "cost_rate": 0}
    avg_tag = master["MFAC_COST_TAG_AMT"].mean()
    avg_cost = master["MFAC_COST_MFAC_COST_AMT"].mean() * 1.1
    avg_ex = master["MFAC_COST_EXCHAGE_RATE"].filter(master["MFAC_COST_EXCHAGE_RATE"] > 0).mean()
    if avg_ex is None or avg_ex == 0:
        avg_ex = 1350.0
    cost_rate = (avg_cost / (avg_tag / avg_ex)) * 100 if avg_tag > 0 else 0
    return {
        "avg_tag": avg_tag,
        "avg_cost": avg_cost,
        "style_count": master["PRDT_CD"].n_unique(),
        "cost_rate": cost_rate,
    }


# ──────────────────────────────────────────
# 차트: 시즌별 5대 항목 Grouped Bar
# ──────────────────────────────────────────
def _build_season_grouped_bar(season_pcts: dict[str, dict[str, float]]) -> go.Figure:
    """시즌별 대분류 비중 Grouped Bar"""
    seasons = list(season_pcts.keys())
    all_types = list(dict.fromkeys(
        t for pcts in season_pcts.values() for t in pcts.keys()
    ))

    fig = go.Figure()
    for item in all_types:
        icon = COST_ITEM_ICONS.get(item, "")
        values = [season_pcts[s].get(item, 0) for s in seasons]
        fig.add_trace(go.Bar(
            x=seasons,
            y=values,
            name=f"{icon} {item}",
            marker_color=COST_ITEM_COLORS.get(item, "#6b7280"),
            text=[f"{v:.1f}%" for v in values],
            textposition="inside",
            textfont=dict(size=11, color="white"),
        ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        barmode="stack",
        title=dict(text="시즌별 원가 항목 비중 비교", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="시즌"),
        yaxis=dict(title="비중 (%)", gridcolor=tc["gridcolor"]),
        height=400,
        margin=dict(l=60, r=20, t=60, b=60),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
    )
    return fig


# ──────────────────────────────────────────
# 차트: 카테고리별 Heatmap
# ──────────────────────────────────────────
def _build_category_heatmap(season_cats: dict[str, dict[str, float]]) -> go.Figure:
    """카테고리별 시즌 평균원가 Heatmap"""
    seasons = list(season_cats.keys())
    all_cats = list(dict.fromkeys(
        c for cats in season_cats.values() for c in cats.keys()
    ))

    z = []
    for cat in all_cats:
        row = [season_cats[s].get(cat, 0) for s in seasons]
        z.append(row)

    fig = go.Figure(data=go.Heatmap(
        z=z,
        x=seasons,
        y=all_cats,
        colorscale="Blues",
        text=[[f"${v:,.0f}" for v in row] for row in z],
        texttemplate="%{text}",
        hovertemplate="카테고리: %{y}<br>시즌: %{x}<br>평균원가: %{text}<extra></extra>",
    ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="카테고리별 시즌 평균원가 (USD, VAT포함)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        height=400,
        margin=dict(l=100, r=20, t=60, b=60),
    )
    return fig


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.2 시즌간 원가 비교"""
    st.markdown("## 시즌간 원가 비교")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    available_seasons = _get_available_seasons(brd_cd)
    if not available_seasons:
        st.warning(f"{brand_name} 원가 데이터가 없습니다.")
        return

    st.caption(f"{brand_name} | 사용 가능 시즌: {', '.join(available_seasons)}")

    # 시즌별 데이터 수집
    season_pcts: dict[str, dict[str, float]] = {}
    season_cats: dict[str, dict[str, float]] = {}
    season_summaries: dict[str, dict] = {}

    for sesn in available_seasons:
        master = _load_master(brd_cd, sesn)
        account = _load_account(brd_cd, sesn)
        season_pcts[sesn] = _calc_type1_pcts(account)
        season_cats[sesn] = _calc_category_avg_cost(master)
        season_summaries[sesn] = _calc_season_summary(master)

    # ── 시즌별 대분류 비중 ──
    col1, col2 = st.columns(2)

    with col1:
        fig_bar = _build_season_grouped_bar(season_pcts)
        st.plotly_chart(fig_bar, use_container_width=True)

    with col2:
        fig_heat = _build_category_heatmap(season_cats)
        st.plotly_chart(fig_heat, use_container_width=True)

    st.markdown("---")

    # ── 요약 테이블 ──
    st.markdown("### 시즌별 요약")

    summary_rows = []
    for sesn in available_seasons:
        s = season_summaries[sesn]
        summary_rows.append({
            "시즌": sesn,
            "스타일수": s["style_count"],
            "평균TAG(KRW)": f'{s["avg_tag"]:,.0f}',
            "평균원가(USD)": f'${s["avg_cost"]:,.1f}',
            "원가율(%)": f'{s["cost_rate"]:.1f}%',
        })

    if summary_rows:
        st.dataframe(
            pl.DataFrame(summary_rows).to_pandas(),
            use_container_width=True,
            hide_index=True,
        )
