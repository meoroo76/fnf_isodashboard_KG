"""
Cat.2 원가 총괄 + KPI 페이지
브랜드/시즌별 원가율, 마크업, 원가 구성 5대 항목, 카테고리별 평균원가
데이터 소스: KG 캐시 (get_product_po_manufacturing_cost)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CATEGORY_COLORS,
    COST_ITEM_COLORS,
    COST_ITEM_ICONS,
    CURRENT_SEASON,
    PREV_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    STATUS_COLORS,
    calc_cost_rate,
    calc_markup,
    calc_yoy,
    calc_delta,
    get_markup_verdict,
    get_prev_season,
)
from src.core.data_loader import load_cost_master, load_cost_account

try:
    from src.service.common.components import (
        season_filter,
        render_kpi_cards,
        render_status_badge,
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

    def render_kpi_cards(cards, category="cost"):
        cols = st.columns(len(cards))
        for col, card in zip(cols, cards):
            with col:
                st.metric(label=card.get("id", ""), value=card.get("current", 0))

    def format_number(value, unit=""):
        if value is None:
            return "-"
        return f"{value:,.1f}{unit}"


# ──────────────────────────────────────────
# 상수
# ──────────────────────────────────────────
COST_ITEMS = ["원부자재", "아트웍", "공임", "정상마진", "경비"]


# ──────────────────────────────────────────
# 데이터 로드
# ──────────────────────────────────────────
@st.cache_data(ttl=600)
def _load_master(brd_cd: str, season: str) -> pl.DataFrame:
    return load_cost_master(brd_cd, season)


@st.cache_data(ttl=600)
def _load_account(brd_cd: str, season: str) -> pl.DataFrame:
    return load_cost_account(brd_cd, season)


def _calc_season_summary(master: pl.DataFrame) -> dict:
    """마스터에서 시즌 요약 KPI 계산"""
    if master.is_empty():
        return {"avg_tag_krw": 0, "avg_cost_usd": 0, "cost_rate": 0, "markup": 0, "style_count": 0}

    avg_tag = master["MFAC_COST_TAG_AMT"].mean()
    avg_cost = master["MFAC_COST_MFAC_COST_AMT"].mean()
    avg_exchange = master["MFAC_COST_EXCHAGE_RATE"].filter(master["MFAC_COST_EXCHAGE_RATE"] > 0).mean()
    if avg_exchange is None or avg_exchange == 0:
        avg_exchange = 1350.0

    # VAT 포함 원가 기준 마크업: TAG / (원가 * 1.1 * 환율)
    cost_krw = avg_cost * 1.1 * avg_exchange
    markup_val = avg_tag / cost_krw if cost_krw > 0 else 0
    # 원가율: (원가 * 1.1) / (TAG / 환율) * 100
    cost_rate_val = (avg_cost * 1.1 / (avg_tag / avg_exchange)) * 100 if avg_tag > 0 else 0

    style_count = master["PRDT_CD"].n_unique()

    return {
        "avg_tag_krw": avg_tag,
        "avg_cost_usd": avg_cost * 1.1,  # VAT 포함
        "cost_rate": cost_rate_val,
        "markup": markup_val,
        "style_count": style_count,
        "exchange_rate": avg_exchange,
    }


# ──────────────────────────────────────────
# 차트: 원가 구성 5대 항목 Donut
# ──────────────────────────────────────────
def _build_donut_chart(account: pl.DataFrame) -> go.Figure:
    """계정 대분류별 원가 합계 Donut"""
    if account.is_empty():
        return go.Figure()

    agg = (
        account.group_by("MFAC_COST_ACCOUNT_TYPE1_NM")
        .agg(pl.col("MFAC_COST_COST_AMT").sum().alias("total_cost"))
        .sort("total_cost", descending=True)
    )

    labels = agg["MFAC_COST_ACCOUNT_TYPE1_NM"].to_list()
    values = agg["total_cost"].to_list()
    colors = [COST_ITEM_COLORS.get(item, "#6b7280") for item in labels]
    icons = [COST_ITEM_ICONS.get(item, "") for item in labels]
    text_labels = [f"{icons[i]} {labels[i]}" for i in range(len(labels))]

    fig = go.Figure(data=[go.Pie(
        labels=text_labels,
        values=values,
        hole=0.55,
        marker=dict(colors=colors),
        textinfo="label+percent",
        textfont=dict(size=12),
        hovertemplate="%{label}: %{value:,.0f}<extra></extra>",
    )])

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="원가 구성 (계정 대분류)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        height=400,
        margin=dict(l=20, r=20, t=60, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=-0.15, xanchor="center", x=0.5),
        annotations=[dict(
            text="원가 구성",
            x=0.5, y=0.5, font_size=14, showarrow=False,
            font=dict(color=tc["font_color"]),
        )],
    )
    return fig


# ──────────────────────────────────────────
# 차트: 카테고리별 평균원가 Bar
# ──────────────────────────────────────────
def _build_category_cost_chart(master: pl.DataFrame) -> go.Figure:
    """카테고리(ITEM_GROUP)별 평균원가(USD, VAT포함) Bar"""
    if master.is_empty():
        return go.Figure()

    cat_df = (
        master.group_by("ITEM_GROUP")
        .agg((pl.col("MFAC_COST_MFAC_COST_AMT") * 1.1).mean().alias("avg_cost"))
        .sort("avg_cost", descending=True)
    )

    categories = cat_df["ITEM_GROUP"].to_list()
    avg_costs = cat_df["avg_cost"].to_list()
    bar_colors = [CATEGORY_COLORS.get(c, "#4f46e5") for c in categories]

    fig = go.Figure(data=[go.Bar(
        x=categories,
        y=avg_costs,
        marker_color=bar_colors,
        text=[f"${v:,.0f}" for v in avg_costs],
        textposition="outside",
        textfont=dict(size=12),
    )])

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="카테고리별 평균원가 (USD, VAT포함)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="카테고리"),
        yaxis=dict(title="평균원가 (USD)", gridcolor=tc["gridcolor"]),
        height=400,
        margin=dict(l=60, r=20, t=60, b=60),
    )
    return fig


# ──────────────────────────────────────────
# 마크업 게이지
# ──────────────────────────────────────────
def _build_markup_gauge(markup_curr: float, markup_prev: float) -> None:
    """마크업 상태 게이지를 HTML로 렌더링"""
    delta = calc_delta(markup_curr, markup_prev)
    verdict = get_markup_verdict(delta)

    icon = verdict["icon"]
    label = verdict["label"]
    color = verdict["color"]
    bg = verdict["bg"]
    border = verdict["border"]

    delta_sign = "+" if delta >= 0 else ""

    st.markdown(
        f"""
        <div style="background:{bg}; border:2px solid {border};
                    border-radius:12px; padding:20px; text-align:center;">
            <div style="font-size:14px; color:#6b7280; margin-bottom:4px;">마크업 상태</div>
            <div style="font-size:36px; font-weight:700; color:{color};">
                {icon} {markup_curr:.2f}x
            </div>
            <div style="font-size:14px; color:{color}; margin-top:4px;">
                {label} | 전년 대비 {delta_sign}{delta:.2f}x
            </div>
            <div style="font-size:12px; color:#9ca3af; margin-top:2px;">
                전년: {markup_prev:.2f}x
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.2 원가 총괄 + KPI"""
    st.markdown("## 원가 총괄 대시보드")
    st.markdown("---")

    # ── 1) 필터 ──
    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")
    prev_season = get_prev_season(season)

    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    # ── 2) 데이터 로드 ──
    master = _load_master(brd_cd, season)
    account = _load_account(brd_cd, season)

    if master.is_empty():
        st.warning(f"{brand_name} {season} 시즌 원가 데이터가 없습니다. Claude Code에서 데이터를 먼저 가져와주세요.")
        return

    # 현재 시즌 KPI
    curr = _calc_season_summary(master)
    exchange_rate = curr["exchange_rate"]
    st.caption(f"{brand_name} | 시즌: {season} | 환율: {exchange_rate:,.0f}원/USD | 스타일 수: {curr['style_count']}개 | * 원가는 VAT 포함 기준")

    # 전년 시즌 KPI
    prev_master = _load_master(brd_cd, prev_season)
    if not prev_master.is_empty():
        prev = _calc_season_summary(prev_master)
    else:
        prev = {"avg_tag_krw": 0, "avg_cost_usd": 0, "cost_rate": 0, "markup": 0, "style_count": 0}

    # ── 3) KPI 카드 ──
    kpi_cards = [
        {"id": "cost_rate", "current": curr["cost_rate"], "prev": prev["cost_rate"]},
        {"id": "avg_tag",   "current": curr["avg_tag_krw"], "prev": prev["avg_tag_krw"]},
        {"id": "avg_cost",  "current": curr["avg_cost_usd"], "prev": prev["avg_cost_usd"]},
        {"id": "markup",    "current": curr["markup"], "prev": prev["markup"]},
    ]

    render_kpi_cards(kpi_cards, category="cost")
    st.markdown("")

    # ── 4) 마크업 게이지 + Donut ──
    col_gauge, col_donut = st.columns([1, 2])

    with col_gauge:
        _build_markup_gauge(curr["markup"], prev["markup"] if prev["markup"] > 0 else curr["markup"])

    with col_donut:
        fig_donut = _build_donut_chart(account)
        st.plotly_chart(fig_donut, use_container_width=True)

    st.markdown("---")

    # ── 5) 카테고리별 평균원가 ──
    fig_cat = _build_category_cost_chart(master)
    st.plotly_chart(fig_cat, use_container_width=True)
