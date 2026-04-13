"""
Cat.3 매장 VOC 분석
매장별 VOC 텍스트 분석, 키워드 추출, 매장 활동 현황
데이터 소스: KG 캐시 (get_shop_voc)
"""

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CHART_COLORS,
    PLOTLY_TEMPLATE_CONFIG,
)
from src.core.data_loader import load_voc

# 품질 관련 키워드
_QUALITY_KEYWORDS = [
    "봉제", "원단", "불량", "수선", "재단", "부자재", "품질", "이염",
    "지퍼", "올풀림", "패딩", "프린트", "단추", "안감", "수축", "변색",
    "마감", "비틀림", "뭉침", "사이즈",
]

# VOC 텍스트 컬럼 (소싱 관련)
_VOC_TEXT_COLS = [
    "SHOP_VOC_SALE_TREND", "SHOP_VOC_REQ_SOUCING",
    "SHOP_VOC_REQ_STYLE", "SHOP_VOC_REQ_MD_TEAM",
    "SHOP_VOC_STYLE_BEST", "SHOP_VOC_STYLE_WORST",
    "SHOP_VOC_STYLE_REORD", "SHOP_VOC_ETC",
]


@st.cache_data(ttl=600)
def _load_voc(brd_cd: str) -> pl.DataFrame:
    return load_voc(brd_cd)


def _extract_keywords(df: pl.DataFrame) -> dict[str, int]:
    """VOC 텍스트에서 키워드 빈도 추출"""
    counts: dict[str, int] = {kw: 0 for kw in _QUALITY_KEYWORDS}
    for col in _VOC_TEXT_COLS:
        if col in df.columns:
            texts = df[col].drop_nulls().to_list()
            for text in texts:
                if not isinstance(text, str):
                    continue
                for kw in _QUALITY_KEYWORDS:
                    if kw in text:
                        counts[kw] += text.count(kw)
    return {k: v for k, v in sorted(counts.items(), key=lambda x: -x[1]) if v > 0}


def _build_keyword_bar(keyword_counts: dict[str, int]) -> go.Figure:
    """키워드 빈도 Horizontal Bar"""
    if not keyword_counts:
        return go.Figure()

    keywords = list(keyword_counts.keys())[:15]
    counts = [keyword_counts[k] for k in keywords]

    fig = go.Figure(data=[go.Bar(
        x=counts, y=keywords, orientation="h",
        marker_color="#8b5cf6",
        text=[f"{v}" for v in counts], textposition="outside",
    )])
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="품질 관련 키워드 빈도", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="언급 횟수", gridcolor=tc["gridcolor"]),
        yaxis=dict(autorange="reversed"),
        height=450, margin=dict(l=100, r=20, t=60, b=60),
    )
    return fig


def _build_shop_activity(df: pl.DataFrame) -> go.Figure:
    """매장별 VOC 건수"""
    if df.is_empty() or "SHOP_NM" not in df.columns:
        return go.Figure()

    agg = df.group_by("SHOP_NM").len().sort("len", descending=True).head(15)
    tc = PLOTLY_TEMPLATE_CONFIG
    fig = go.Figure(data=[go.Bar(
        x=agg["len"].to_list(), y=agg["SHOP_NM"].to_list(),
        orientation="h", marker_color="#06b6d4",
        text=[f"{v}" for v in agg["len"].to_list()], textposition="outside",
    )])
    fig.update_layout(
        title=dict(text="매장별 VOC 건수 TOP 15", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="VOC 건수", gridcolor=tc["gridcolor"]),
        yaxis=dict(autorange="reversed"),
        height=500, margin=dict(l=180, r=20, t=60, b=60),
    )
    return fig


def render():
    st.markdown("## 매장 VOC 분석")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    df = _load_voc(brd_cd)

    if df.is_empty():
        st.warning(f"{brand_name} 매장 VOC 데이터가 없습니다.")
        return

    total_voc = df.height
    total_shops = df["SHOP_NM"].n_unique() if "SHOP_NM" in df.columns else 0
    date_range = ""
    if "DT" in df.columns:
        dates = df["DT"].drop_nulls().sort()
        if dates.len() > 0:
            date_range = f"{dates[0]} ~ {dates[-1]}"

    st.caption(f"{brand_name} | 기간: {date_range} | 총 VOC: {total_voc}건 | 매장: {total_shops}개")

    # 키워드 분석
    keyword_counts = _extract_keywords(df)

    col1, col2 = st.columns(2)
    with col1:
        st.plotly_chart(_build_keyword_bar(keyword_counts), use_container_width=True)
    with col2:
        st.plotly_chart(_build_shop_activity(df), use_container_width=True)

    # 소싱 관련 VOC 상세
    st.markdown("---")
    st.markdown("### 소싱 관련 VOC 상세")

    if "SHOP_VOC_REQ_SOUCING" in df.columns:
        sourcing_voc = (
            df.filter(pl.col("SHOP_VOC_REQ_SOUCING").is_not_null() & (pl.col("SHOP_VOC_REQ_SOUCING") != ""))
            .select(["DT", "SHOP_NM", "SHOP_VOC_REQ_SOUCING"])
            .sort("DT", descending=True)
            .head(20)
            .rename({"DT": "날짜", "SHOP_NM": "매장", "SHOP_VOC_REQ_SOUCING": "소싱 요청사항"})
        )
        if not sourcing_voc.is_empty():
            st.dataframe(sourcing_voc.to_pandas(), use_container_width=True, hide_index=True)
        else:
            st.info("소싱 관련 VOC가 없습니다.")

    # 베스트/워스트 스타일 VOC
    st.markdown("---")
    col_best, col_worst = st.columns(2)

    with col_best:
        st.markdown("### 베스트 스타일 VOC")
        if "SHOP_VOC_STYLE_BEST" in df.columns:
            best = (
                df.filter(pl.col("SHOP_VOC_STYLE_BEST").is_not_null() & (pl.col("SHOP_VOC_STYLE_BEST") != ""))
                .select(["DT", "SHOP_NM", "SHOP_VOC_STYLE_BEST"])
                .sort("DT", descending=True).head(10)
                .rename({"DT": "날짜", "SHOP_NM": "매장", "SHOP_VOC_STYLE_BEST": "베스트 스타일"})
            )
            if not best.is_empty():
                st.dataframe(best.to_pandas(), use_container_width=True, hide_index=True)

    with col_worst:
        st.markdown("### 워스트 스타일 VOC")
        if "SHOP_VOC_STYLE_WORST" in df.columns:
            worst = (
                df.filter(pl.col("SHOP_VOC_STYLE_WORST").is_not_null() & (pl.col("SHOP_VOC_STYLE_WORST") != ""))
                .select(["DT", "SHOP_NM", "SHOP_VOC_STYLE_WORST"])
                .sort("DT", descending=True).head(10)
                .rename({"DT": "날짜", "SHOP_NM": "매장", "SHOP_VOC_STYLE_WORST": "워스트 스타일"})
            )
            if not worst.is_empty():
                st.dataframe(worst.to_pandas(), use_container_width=True, hide_index=True)
