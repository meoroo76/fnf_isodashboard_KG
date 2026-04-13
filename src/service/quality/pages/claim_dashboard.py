"""
Cat.3 클레임 현황 대시보드
시즌별 전년 동시즌 비교 + 과실구분별 분석
데이터 소스: KG 캐시 (get_claim_receipt)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CURRENT_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    get_prev_season,
)
from src.core.data_loader import load_claims, load_season_sale_summary


@st.cache_data(ttl=600)
def _load_claims(brd_cd: str) -> pl.DataFrame:
    return load_claims(brd_cd)


@st.cache_data(ttl=600)
def _get_season_summary(brd_cd: str, season: str) -> dict:
    """해당 시즌의 입고/판매/판매율 요약"""
    return load_season_sale_summary(brd_cd, season)


def _claim_rate(claim_qty: float, sale_qty: int) -> float:
    """클레임율 (%) = 클레임수량 / 판매수량 × 100"""
    if sale_qty == 0:
        return 0.0
    return claim_qty / sale_qty * 100


def _delta_str(curr: float, prev: float) -> tuple[str, str]:
    """증감 문자열 + 색상 (클레임 건수용: 감소=좋음)"""
    if prev == 0:
        return ("", "#6b7280")
    diff = curr - prev
    rate = (curr / prev - 1) * 100
    sign = "+" if diff >= 0 else ""
    color = "#dc2626" if diff > 0 else "#059669" if diff < 0 else "#6b7280"
    return (f"{sign}{diff:,.0f}건 ({sign}{rate:.1f}%)", color)


def _delta_rate_str(curr: float, prev: float) -> tuple[str, str]:
    """클레임율 증감 문자열 + 색상 (감소=좋음)"""
    if prev == 0 and curr == 0:
        return ("", "#6b7280")
    diff = curr - prev
    sign = "+" if diff >= 0 else ""
    color = "#dc2626" if diff > 0 else "#059669" if diff < 0 else "#6b7280"
    return (f"{sign}{diff:.2f}%p", color)


def _delta_pct_str(curr: int, prev: int) -> tuple[str, str]:
    """일반 수량 증감 (증가=좋음)"""
    if prev == 0:
        return ("", "#6b7280")
    rate = (curr / prev - 1) * 100
    sign = "+" if rate >= 0 else ""
    color = "#059669" if rate >= 0 else "#dc2626"
    return (f"{sign}{rate:.1f}%", color)


def _render_kpi_card(label: str, curr_val: str, delta_text: str, delta_color: str, color: str):
    delta_html = f'<div style="font-size:12px; color:{delta_color}; margin-top:4px;">전년비 {delta_text}</div>' if delta_text else ""
    st.markdown(
        f"""<div style="background:white; border-left:4px solid {color};
            border-radius:8px; padding:16px; min-height:120px;">
            <div style="font-size:12px; color:#6b7280;">{label}</div>
            <div style="font-size:24px; font-weight:700; color:{color};">{curr_val}</div>
            {delta_html}
        </div>""", unsafe_allow_html=True)


def _build_err_cls_comparison(curr_df: pl.DataFrame, prev_df: pl.DataFrame, season: str, prev_season: str) -> go.Figure:
    """과실구분별 당시즌 vs 전년 비교 차트"""
    tc = PLOTLY_TEMPLATE_CONFIG

    def _agg(df: pl.DataFrame) -> dict[str, float]:
        if df.is_empty() or "CLAIM_ERR_CLS_NM" not in df.columns:
            return {}
        agg = df.group_by("CLAIM_ERR_CLS_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True)
        return {r["CLAIM_ERR_CLS_NM"]: r["qty"] for r in agg.iter_rows(named=True)}

    curr_map = _agg(curr_df)
    prev_map = _agg(prev_df)
    all_keys = list(dict.fromkeys(list(curr_map.keys()) + list(prev_map.keys())))

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=all_keys, y=[prev_map.get(k, 0) for k in all_keys],
        name=prev_season, marker_color="#9ca3af",
        text=[f"{prev_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.add_trace(go.Bar(
        x=all_keys, y=[curr_map.get(k, 0) for k in all_keys],
        name=season, marker_color="#ef4444",
        text=[f"{curr_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.update_layout(
        title=dict(text=f"과실구분별 클레임 비교 ({season} vs {prev_season})", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        barmode="group",
        xaxis=dict(title="과실구분"), yaxis=dict(title="클레임 수량", gridcolor=tc["gridcolor"]),
        height=400, margin=dict(l=60, r=20, t=60, b=60),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


def _build_defect_type_comparison(curr_df: pl.DataFrame, prev_df: pl.DataFrame, season: str, prev_season: str) -> go.Figure:
    """불량유형별 당시즌 vs 전년 비교 차트"""
    tc = PLOTLY_TEMPLATE_CONFIG

    def _agg(df: pl.DataFrame) -> dict[str, float]:
        if df.is_empty() or "CLAIM_CONTS_ANAL_GROUP_NM" not in df.columns:
            return {}
        agg = df.group_by("CLAIM_CONTS_ANAL_GROUP_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True).head(10)
        return {r["CLAIM_CONTS_ANAL_GROUP_NM"]: r["qty"] for r in agg.iter_rows(named=True)}

    curr_map = _agg(curr_df)
    prev_map = _agg(prev_df)
    all_keys = list(dict.fromkeys(list(curr_map.keys()) + list(prev_map.keys())))

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=all_keys, y=[prev_map.get(k, 0) for k in all_keys],
        name=prev_season, marker_color="#9ca3af",
        text=[f"{prev_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.add_trace(go.Bar(
        x=all_keys, y=[curr_map.get(k, 0) for k in all_keys],
        name=season, marker_color="#3b82f6",
        text=[f"{curr_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.update_layout(
        title=dict(text=f"불량유형별 클레임 비교 ({season} vs {prev_season})", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        barmode="group",
        xaxis=dict(title="불량유형", tickangle=-30), yaxis=dict(title="클레임 수량", gridcolor=tc["gridcolor"]),
        height=400, margin=dict(l=60, r=20, t=60, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


def _build_supplier_comparison(curr_df: pl.DataFrame, prev_df: pl.DataFrame, season: str, prev_season: str) -> go.Figure:
    """협력사별 당시즌 vs 전년 비교 (TOP 10)"""
    tc = PLOTLY_TEMPLATE_CONFIG

    def _agg(df: pl.DataFrame) -> dict[str, float]:
        if df.is_empty() or "MFAC_COMPY_NM" not in df.columns:
            return {}
        agg = (df.filter(pl.col("MFAC_COMPY_NM").is_not_null())
               .group_by("MFAC_COMPY_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty"))
               .sort("qty", descending=True).head(10))
        return {r["MFAC_COMPY_NM"]: r["qty"] for r in agg.iter_rows(named=True)}

    curr_map = _agg(curr_df)
    prev_map = _agg(prev_df)
    # 당시즌 TOP 10 기준 정렬
    top_keys = list(curr_map.keys())[:10] if curr_map else list(prev_map.keys())[:10]
    top_keys.reverse()  # 가로 막대 위→아래 순서

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=[prev_map.get(k, 0) for k in top_keys], y=top_keys,
        orientation="h", name=prev_season, marker_color="#9ca3af",
        text=[f"{prev_map.get(k, 0):,.0f}" for k in top_keys], textposition="outside",
    ))
    fig.add_trace(go.Bar(
        x=[curr_map.get(k, 0) for k in top_keys], y=top_keys,
        orientation="h", name=season, marker_color="#f59e0b",
        text=[f"{curr_map.get(k, 0):,.0f}" for k in top_keys], textposition="outside",
    ))
    fig.update_layout(
        title=dict(text=f"협력사별 클레임 TOP 10 ({season} vs {prev_season})", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        barmode="group",
        xaxis=dict(title="클레임 수량", gridcolor=tc["gridcolor"]),
        height=450, margin=dict(l=150, r=40, t=60, b=60),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


def _build_err_cls_donut(df: pl.DataFrame, season: str) -> go.Figure:
    """과실구분별 도넛 차트"""
    if df.is_empty() or "CLAIM_ERR_CLS_NM" not in df.columns:
        return go.Figure()
    agg = df.group_by("CLAIM_ERR_CLS_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True)
    tc = PLOTLY_TEMPLATE_CONFIG
    colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#6b7280"]
    fig = go.Figure(data=[go.Pie(
        labels=agg["CLAIM_ERR_CLS_NM"].to_list(),
        values=agg["qty"].to_list(),
        hole=0.5,
        textinfo="label+percent+value",
        textfont=dict(size=11),
        marker=dict(colors=colors[:len(agg)]),
    )])
    fig.update_layout(
        title=dict(text=f"과실구분 비율 ({season})", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        height=400, margin=dict(l=20, r=20, t=60, b=20),
        legend=dict(orientation="h", yanchor="bottom", y=-0.15, xanchor="center", x=0.5),
    )
    return fig


def _build_category_comparison(curr_df: pl.DataFrame, prev_df: pl.DataFrame, season: str, prev_season: str) -> go.Figure:
    """카테고리(ITEM_GROUP)별 당시즌 vs 전년 비교"""
    tc = PLOTLY_TEMPLATE_CONFIG

    def _agg(df: pl.DataFrame) -> dict[str, float]:
        if df.is_empty() or "ITEM_GROUP" not in df.columns:
            return {}
        agg = df.group_by("ITEM_GROUP").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True)
        return {r["ITEM_GROUP"]: r["qty"] for r in agg.iter_rows(named=True)}

    curr_map = _agg(curr_df)
    prev_map = _agg(prev_df)
    all_keys = list(dict.fromkeys(list(curr_map.keys()) + list(prev_map.keys())))

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=all_keys, y=[prev_map.get(k, 0) for k in all_keys],
        name=prev_season, marker_color="#9ca3af",
        text=[f"{prev_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.add_trace(go.Bar(
        x=all_keys, y=[curr_map.get(k, 0) for k in all_keys],
        name=season, marker_color="#8b5cf6",
        text=[f"{curr_map.get(k, 0):,.0f}" for k in all_keys], textposition="outside",
    ))
    fig.update_layout(
        title=dict(text=f"카테고리별 클레임 비교 ({season} vs {prev_season})", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        barmode="group",
        xaxis=dict(title="카테고리"), yaxis=dict(title="클레임 수량", gridcolor=tc["gridcolor"]),
        height=400, margin=dict(l=60, r=20, t=60, b=60),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


def render():
    st.markdown("## 클레임 현황 대시보드")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    season = st.session_state.get("global_season", CURRENT_SEASON)
    prev_season = get_prev_season(season)

    df_all = _load_claims(brd_cd)
    if df_all.is_empty():
        st.warning(f"{brand_name} 클레임 데이터가 없습니다.")
        return

    # 시즌 필터
    curr_df = df_all.filter(pl.col("SESN") == season)
    prev_df = df_all.filter(pl.col("SESN") == prev_season)

    # KPI 계산
    curr_qty = float(curr_df["CLAIM_QTY"].sum()) if not curr_df.is_empty() else 0
    prev_qty = float(prev_df["CLAIM_QTY"].sum()) if not prev_df.is_empty() else 0
    curr_styles = curr_df["PRDT_CD"].n_unique() if not curr_df.is_empty() and "PRDT_CD" in curr_df.columns else 0
    prev_styles = prev_df["PRDT_CD"].n_unique() if not prev_df.is_empty() and "PRDT_CD" in prev_df.columns else 0
    curr_suppliers = curr_df["MFAC_COMPY_NM"].n_unique() if not curr_df.is_empty() and "MFAC_COMPY_NM" in curr_df.columns else 0
    prev_suppliers = prev_df["MFAC_COMPY_NM"].n_unique() if not prev_df.is_empty() and "MFAC_COMPY_NM" in prev_df.columns else 0

    # 시즌별 입고/판매/판매율 요약
    curr_summary = _get_season_summary(brd_cd, season)
    prev_summary = _get_season_summary(brd_cd, prev_season)
    curr_stor = curr_summary["stor_qty"]
    prev_stor = prev_summary["stor_qty"]
    curr_sale = curr_summary["sale_qty"]
    prev_sale = prev_summary["sale_qty"]
    curr_sale_rate = curr_summary["sale_rate"]
    prev_sale_rate = prev_summary["sale_rate"]
    # 클레임율 = 클레임수량 / 판매수량
    curr_claim_rate = _claim_rate(curr_qty, curr_sale)
    prev_claim_rate = _claim_rate(prev_qty, prev_sale)

    # 과실구분별 건수
    curr_err = {}
    if not curr_df.is_empty() and "CLAIM_ERR_CLS_NM" in curr_df.columns:
        err_agg = curr_df.group_by("CLAIM_ERR_CLS_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True)
        curr_err = {r["CLAIM_ERR_CLS_NM"]: r["qty"] for r in err_agg.iter_rows(named=True)}
    prev_err = {}
    if not prev_df.is_empty() and "CLAIM_ERR_CLS_NM" in prev_df.columns:
        err_agg = prev_df.group_by("CLAIM_ERR_CLS_NM").agg(pl.col("CLAIM_QTY").sum().alias("qty")).sort("qty", descending=True)
        prev_err = {r["CLAIM_ERR_CLS_NM"]: r["qty"] for r in err_agg.iter_rows(named=True)}

    st.caption(
        f"{brand_name} | {season} vs {prev_season} 비교 | "
        f"당시즌 클레임 {curr_qty:,.0f}건 (판매 {curr_sale:,}pcs) / "
        f"전년 클레임 {prev_qty:,.0f}건 (판매 {prev_sale:,}pcs)"
    )

    # ── KPI 카드 7개 (1행) ──
    kpi_cols = st.columns(7)
    qty_delta, qty_color = _delta_str(curr_qty, prev_qty)
    rate_delta, rate_color = _delta_rate_str(curr_claim_rate, prev_claim_rate)
    sty_delta, sty_color = _delta_str(curr_styles, prev_styles)
    sup_delta, sup_color = _delta_str(curr_suppliers, prev_suppliers)
    stor_delta, stor_color = _delta_pct_str(curr_stor, prev_stor)
    sale_delta, sale_color = _delta_pct_str(curr_sale, prev_sale)
    sale_rate_diff = curr_sale_rate - prev_sale_rate
    sr_sign = "+" if sale_rate_diff >= 0 else ""
    sr_color = "#059669" if sale_rate_diff >= 0 else "#dc2626"

    with kpi_cols[0]:
        _render_kpi_card("클레임 건수", f"{curr_qty:,.0f}건", qty_delta, qty_color, "#ef4444")
    with kpi_cols[1]:
        rate_label = f"{curr_claim_rate:.2f}%" if curr_sale > 0 else "-"
        _render_kpi_card("클레임율 (판매대비)", rate_label, rate_delta if curr_sale > 0 else "", rate_color, "#dc2626")
    with kpi_cols[2]:
        _render_kpi_card("입고수량", f"{curr_stor:,}", f"전년 {prev_stor:,} ({stor_delta})" if prev_stor > 0 else "", stor_color, "#10b981")
    with kpi_cols[3]:
        sale_val = f"{curr_sale:,}" if curr_sale > 0 else "-"
        _render_kpi_card("판매수량", sale_val, f"전년 {prev_sale:,} ({sale_delta})" if prev_sale > 0 else "", sale_color, "#6366f1")
    with kpi_cols[4]:
        sr_val = f"{curr_sale_rate}%" if curr_sale_rate > 0 else "-"
        _render_kpi_card("판매율", sr_val, f"전년 {prev_sale_rate}% ({sr_sign}{sale_rate_diff}%p)" if prev_sale_rate > 0 else "", sr_color, "#0891b2")
    with kpi_cols[5]:
        _render_kpi_card("관련 스타일", f"{curr_styles}개", sty_delta, sty_color, "#3b82f6")
    with kpi_cols[6]:
        _render_kpi_card("관련 협력사", f"{curr_suppliers}개", sup_delta, sup_color, "#f59e0b")

    if curr_df.is_empty():
        st.info(f"{season} 시즌 클레임 데이터가 아직 없습니다.")
        return

    # ── 과실구분 분석 섹션 ──
    st.markdown("### 과실구분별 분석")
    col1, col2 = st.columns(2)
    with col1:
        st.plotly_chart(_build_err_cls_donut(curr_df, season), use_container_width=True)
    with col2:
        st.plotly_chart(_build_err_cls_comparison(curr_df, prev_df, season, prev_season), use_container_width=True)

    # 과실구분별 상세 테이블 (판매수량 대비 클레임율 포함)
    if "CLAIM_ERR_CLS_NM" in curr_df.columns:
        all_err_keys = list(dict.fromkeys(list(curr_err.keys()) + list(prev_err.keys())))
        err_table = []
        for k in all_err_keys:
            c = curr_err.get(k, 0)
            p = prev_err.get(k, 0)
            diff = c - p
            rate = ((c / p - 1) * 100) if p > 0 else 0
            c_rate = (c / curr_sale * 100) if curr_sale > 0 else 0
            p_rate = (p / prev_sale * 100) if prev_sale > 0 else 0
            err_table.append({
                "과실구분": k,
                f"{season} 건수": int(c),
                f"{season} 클레임율(%)": round(c_rate, 2),
                f"{prev_season} 건수": int(p),
                f"{prev_season} 클레임율(%)": round(p_rate, 2),
                "증감": int(diff),
                "증감률(%)": round(rate, 1),
            })
        if err_table:
            st.dataframe(pl.DataFrame(err_table).to_pandas(), use_container_width=True, hide_index=True)

    st.markdown("---")

    # ── 불량유형 + 카테고리 비교 ──
    st.markdown("### 불량유형 · 카테고리별 비교")
    col1, col2 = st.columns(2)
    with col1:
        st.plotly_chart(_build_defect_type_comparison(curr_df, prev_df, season, prev_season), use_container_width=True)
    with col2:
        st.plotly_chart(_build_category_comparison(curr_df, prev_df, season, prev_season), use_container_width=True)

    st.markdown("---")

    # ── 협력사별 비교 ──
    st.plotly_chart(_build_supplier_comparison(curr_df, prev_df, season, prev_season), use_container_width=True)

    st.markdown("---")

    # ── 스타일별 클레임 상세 ──
    st.markdown("### 스타일별 클레임 상세")
    style_agg = (
        curr_df.group_by(["PRDT_CD", "PRDT_NM", "ITEM_GROUP"])
        .agg([
            pl.col("CLAIM_QTY").sum().alias("클레임수량"),
            pl.col("MFAC_COMPY_NM").first().alias("협력사"),
            pl.col("CLAIM_ERR_CLS_NM").first().alias("과실구분"),
            pl.col("CLAIM_CONTS_ANAL_GROUP_NM").first().alias("불량유형"),
        ])
        .sort("클레임수량", descending=True).head(30)
    )
    if not style_agg.is_empty():
        st.dataframe(style_agg.to_pandas(), use_container_width=True, hide_index=True)
    else:
        st.info("해당 시즌 스타일별 클레임 데이터가 없습니다.")
