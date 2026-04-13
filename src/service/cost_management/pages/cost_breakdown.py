"""
Cat.2 원가 구성 분석 페이지
계정 대분류/중분류 Treemap, 시즌 추이 Stacked Bar, 스타일별 원가 상세 테이블
데이터 소스: KG 캐시 (get_product_po_manufacturing_cost)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    COST_ITEM_COLORS,
    COST_ITEM_ICONS,
    CURRENT_SEASON,
    PREV_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    STATUS_COLORS,
    calc_cost_rate,
    calc_markup,
    get_markup_verdict,
    get_prev_season,
)
from src.core.data_loader import load_cost_master, load_cost_account

try:
    from src.service.common.components import (
        season_filter,
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

    def render_status_badge(status_dict: dict) -> str:
        return f'{status_dict.get("icon", "")} {status_dict.get("label", "")}'

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


# ──────────────────────────────────────────
# 차트: 계정 대분류/중분류 Treemap
# ──────────────────────────────────────────
def _build_treemap(account: pl.DataFrame) -> go.Figure:
    """Treemap: 대분류(ACCOUNT_TYPE1) -> 중분류(ACCOUNT_TYPE2)"""
    if account.is_empty():
        return go.Figure()

    # 대분류별 합계
    type1_agg = (
        account.group_by("MFAC_COST_ACCOUNT_TYPE1_NM")
        .agg(pl.col("MFAC_COST_COST_AMT").sum().alias("total"))
        .sort("total", descending=True)
    )

    # 중분류별 합계
    type2_agg = (
        account.filter(pl.col("MFAC_COST_ACCOUNT_TYPE2_NM").is_not_null())
        .group_by(["MFAC_COST_ACCOUNT_TYPE1_NM", "MFAC_COST_ACCOUNT_TYPE2_NM"])
        .agg(pl.col("MFAC_COST_COST_AMT").sum().alias("total"))
        .sort("total", descending=True)
    )

    ids = []
    labels = []
    parents = []
    values = []
    colors = []

    # 대분류 노드
    for row in type1_agg.iter_rows(named=True):
        name = row["MFAC_COST_ACCOUNT_TYPE1_NM"]
        icon = COST_ITEM_ICONS.get(name, "")
        ids.append(name)
        labels.append(f"{icon} {name}")
        parents.append("")
        values.append(row["total"])
        colors.append(COST_ITEM_COLORS.get(name, "#6b7280"))

    # 중분류 노드
    for row in type2_agg.iter_rows(named=True):
        parent = row["MFAC_COST_ACCOUNT_TYPE1_NM"]
        child = row["MFAC_COST_ACCOUNT_TYPE2_NM"]
        sub_id = f"{parent}/{child}"
        ids.append(sub_id)
        labels.append(child)
        parents.append(parent)
        values.append(row["total"])
        colors.append(COST_ITEM_COLORS.get(parent, "#6b7280"))

    fig = go.Figure(go.Treemap(
        ids=ids,
        labels=labels,
        parents=parents,
        values=values,
        marker=dict(colors=colors),
        textinfo="label+percent parent",
        hovertemplate="<b>%{label}</b><br>원가: %{value:,.0f}<extra></extra>",
        branchvalues="total",
    ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="원가 구성 Treemap (대분류 > 중분류)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        height=450,
        margin=dict(l=10, r=10, t=50, b=10),
    )
    return fig


# ──────────────────────────────────────────
# 차트: 시즌 추이 Stacked Bar
# ──────────────────────────────────────────
def _build_season_stacked_bar(
    curr_account: pl.DataFrame,
    prev_account: pl.DataFrame,
    season: str,
    prev_season: str,
) -> go.Figure:
    """전시즌 vs 당시즌 대분류별 Stacked Bar"""

    def _get_type1_pct(acc: pl.DataFrame) -> dict:
        if acc.is_empty():
            return {}
        agg = acc.group_by("MFAC_COST_ACCOUNT_TYPE1_NM").agg(
            pl.col("MFAC_COST_COST_AMT").sum().alias("total")
        )
        grand_total = agg["total"].sum()
        if grand_total == 0:
            return {}
        return {
            r["MFAC_COST_ACCOUNT_TYPE1_NM"]: r["total"] / grand_total * 100
            for r in agg.iter_rows(named=True)
        }

    curr_pcts = _get_type1_pct(curr_account)
    prev_pcts = _get_type1_pct(prev_account)

    # 모든 대분류 키 합집합
    all_types = list(dict.fromkeys(list(curr_pcts.keys()) + list(prev_pcts.keys())))
    seasons = [prev_season, season]

    fig = go.Figure()
    for item in all_types:
        icon = COST_ITEM_ICONS.get(item, "")
        prev_val = prev_pcts.get(item, 0)
        curr_val = curr_pcts.get(item, 0)
        fig.add_trace(go.Bar(
            x=seasons,
            y=[prev_val, curr_val],
            name=f"{icon} {item}",
            marker_color=COST_ITEM_COLORS.get(item, "#6b7280"),
            text=[f"{prev_val:.1f}%", f"{curr_val:.1f}%"],
            textposition="inside",
            textfont=dict(size=11, color="white"),
        ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        barmode="stack",
        title=dict(text="시즌별 원가 항목 비중 추이", font=dict(size=16)),
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
# 테이블: 스타일별 원가 상세
# ──────────────────────────────────────────
def _build_detail_table(master: pl.DataFrame) -> pl.DataFrame:
    """스타일별 원가 상세 테이블"""
    if master.is_empty():
        return pl.DataFrame()

    records = master.to_dicts()
    table_rows = []

    for r in records:
        tag = r.get("MFAC_COST_TAG_AMT", 0) or 0
        cost_raw = r.get("MFAC_COST_MFAC_COST_AMT", 0) or 0
        cost = cost_raw * 1.1  # VAT 포함
        exchange = r.get("MFAC_COST_EXCHAGE_RATE", 0) or 0
        if exchange == 0:
            exchange = 1350.0
        markup = r.get("MFAC_COST_MARKUP", 0) or 0
        offer = r.get("MFAC_COST_SUPPLIER_OFFER_COST_AMT", 0) or 0
        nego = r.get("MFAC_COST_SUPPLIER_NEGO_COST_AMT", 0) or 0

        cost_rate = (cost / (tag / exchange)) * 100 if tag > 0 and exchange > 0 else 0

        # 마크업 상태
        if markup >= 3.0:
            mu_status = STATUS_COLORS["good"]
        elif markup >= 2.5:
            mu_status = STATUS_COLORS["warn"]
        else:
            mu_status = STATUS_COLORS["danger"]

        mu_badge = f'{mu_status["icon"]} {markup:.2f}x'

        table_rows.append({
            "스타일": r.get("PRDT_CD", ""),
            "품명": r.get("PRDT_NM", ""),
            "카테고리": r.get("ITEM_GROUP", ""),
            "TAG가": f'{tag:,.0f}',
            "원가(USD)": f'${cost:,.1f}',
            "원가율%": f'{cost_rate:.1f}%',
            "M/U": mu_badge,
            "제시가": f'${offer:,.1f}' if offer > 0 else "-",
            "협상가": f'${nego:,.1f}' if nego > 0 else "-",
            "협력사": r.get("MFAC_COMPY_NM", ""),
            "PO": r.get("PO_NO", ""),
            "견적상태": r.get("MFAC_COST_QUOTATION_STAT_NM", ""),
        })

    return pl.DataFrame(table_rows)


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.2 원가 구성 분석"""
    st.markdown("## 원가 구성 분석")
    st.markdown("---")

    # ── 1) 필터 ──
    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")
    prev_season = get_prev_season(season)

    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    st.caption(f"{brand_name} | 시즌: {season} | * 원가는 VAT ���함 기준")

    # ── 2) 데이터 로드 ──
    master = _load_master(brd_cd, season)
    account = _load_account(brd_cd, season)

    if master.is_empty():
        st.warning(f"{brand_name} {season} 시즌 원가 데이터가 없습니다.")
        return

    prev_account = _load_account(brd_cd, prev_season)

    # ── 3) Treemap + Stacked Bar ──
    col_tree, col_stack = st.columns(2)

    with col_tree:
        fig_tree = _build_treemap(account)
        st.plotly_chart(fig_tree, use_container_width=True)

    with col_stack:
        fig_stack = _build_season_stacked_bar(account, prev_account, season, prev_season)
        st.plotly_chart(fig_stack, use_container_width=True)

    st.markdown("---")

    # ── 4) 스타일별 원가 상세 테이블 ──
    st.markdown("### 스타일별 원가 상세")

    detail_df = _build_detail_table(master)
    if not detail_df.is_empty():
        st.dataframe(
            detail_df.to_pandas(),
            use_container_width=True,
            height=min(600, 40 + detail_df.height * 35),
        )
