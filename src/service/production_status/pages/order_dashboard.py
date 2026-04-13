"""
Cat.1 오더 현황 대시보드
시즌 생산 현황 요약 — 주차별 유관부서 공유용 핵심 페이지
KPI 5개: 발주액, 스타일수, SKU수, 이행률(수량), PO건수
데이터 소스: KG 캐시 (get_order_inbound_status)
"""
import datetime

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CATEGORY_COLORS,
    CURRENT_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    STATUS_COLORS,
    get_prev_season,
)
from src.core.data_loader import load_order_inbound, load_season_sale


# ──────────────────────────────────────────
# 헬퍼
# ──────────────────────────────────────────
def _fmt_amt(v: float) -> str:
    """금액을 억 단위 문자열로"""
    return f"{v / 1e8:,.1f}억"


def _fmt_qty(v: float) -> str:
    """수량을 천 단위 문자열로"""
    if v >= 1000:
        return f"{v / 1000:,.1f}천"
    return f"{v:,.0f}"


def _fmt_pct(v: float) -> str:
    return f"{v:.1f}%"


def _delta_str(curr: float, prev: float, unit: str = "") -> str:
    """증감 문자열 생성"""
    if prev == 0:
        return ""
    diff = curr - prev
    rate = (curr / prev - 1) * 100
    sign = "+" if diff >= 0 else ""
    if unit == "억":
        return f"{sign}{diff / 1e8:,.1f}억 ({sign}{rate:.1f}%)"
    elif unit == "천":
        return f"{sign}{diff / 1000:,.1f}천 ({sign}{rate:.1f}%)"
    elif unit == "%":
        return f"{sign}{diff:.1f}%p"
    else:
        return f"{sign}{diff:,.0f} ({sign}{rate:.1f}%)"


def _is_reorder(po_no: str) -> bool:
    """PO번호 마지막 자리가 1이 아니면 리오더"""
    if not po_no:
        return False
    last = po_no.strip()[-1]
    return last != "1"


def _count_styles(df: pl.DataFrame) -> int:
    """중복 제거 스타일 수"""
    if df.is_empty() or "PRDT_CD" not in df.columns:
        return 0
    return df["PRDT_CD"].n_unique()


def _count_styles_with_stor(df: pl.DataFrame) -> int:
    """입고가 발생한 스타일 수"""
    if df.is_empty():
        return 0
    stored = df.filter(pl.col("STOR_QTY") > 0)
    if stored.is_empty() or "PRDT_CD" not in stored.columns:
        return 0
    return stored["PRDT_CD"].n_unique()


def _count_sku(df: pl.DataFrame) -> int:
    """SKU 수 (PRDT_CD × COLOR_CD × SIZE_CD 또는 행 수)"""
    if df.is_empty():
        return 0
    if "COLOR_CD" in df.columns and "SIZE_CD" in df.columns:
        return df.select(["PRDT_CD", "COLOR_CD", "SIZE_CD"]).unique().height
    return df.select("PRDT_CD").unique().height


def _count_sku_with_stor(df: pl.DataFrame) -> int:
    """입고 발생 SKU 수"""
    if df.is_empty():
        return 0
    stored = df.filter(pl.col("STOR_QTY") > 0)
    if stored.is_empty():
        return 0
    if "COLOR_CD" in stored.columns and "SIZE_CD" in stored.columns:
        return stored.select(["PRDT_CD", "COLOR_CD", "SIZE_CD"]).unique().height
    return stored.select("PRDT_CD").unique().height


def _count_po(df: pl.DataFrame) -> tuple[int, int, int]:
    """PO 건수: (전체, 이니셜, 리오더)"""
    if df.is_empty() or "PO_NO" not in df.columns:
        return 0, 0, 0
    unique_pos = df["PO_NO"].unique().to_list()
    total = len(unique_pos)
    reorder = sum(1 for po in unique_pos if _is_reorder(po))
    initial = total - reorder
    return total, initial, reorder


# ──────────────────────────────────────────
# KPI 카드 렌더링 (커스텀 HTML)
# ──────────────────────────────────────────
def _render_kpi_card(
    label: str,
    icon: str,
    main_value: str,
    sub_lines: list[str],
    color: str = "#4f46e5",
) -> None:
    """KPI 카드 HTML 렌더링"""
    subs_html = ""
    for line in sub_lines:
        # 증감 색상 처리
        if line.startswith("+") or "증가" in line:
            line_color = "#059669"
        elif line.startswith("-") or "감소" in line:
            line_color = "#dc2626"
        else:
            line_color = "#6b7280"
        subs_html += f'<div style="font-size:12px; color:{line_color}; margin-top:2px;">{line}</div>'

    st.markdown(
        f"""
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-left:4px solid {color};
                    border-radius:8px; padding:14px 16px; min-height:160px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em;">
                {icon} {label}
            </div>
            <div style="font-size:26px; font-weight:700; color:#1f2937; margin:6px 0 4px 0;
                        font-family:'JetBrains Mono',monospace;">
                {main_value}
            </div>
            {subs_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


# ──────────────────────────────────────────
# KG 스타일 마스터 조회
# ──────────────────────────────────────────
@st.cache_data(ttl=3600)
def _fetch_style_info(brd_cd: str, prdt_cd: str) -> dict:
    """KG API로 스타일 마스터 정보 조회 (이미지URL, 택가, 성별 등)"""
    import subprocess
    import json
    import tempfile
    import glob
    import os

    body = json.dumps({
        "filters": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
            {"system_code": prdt_cd, "system_field_name": "PRDT_CD"},
        ],
        "meta_info": {"data_size_only": False, "data_type": "list", "requested_record_rows": 5},
    })

    try:
        result = subprocess.run(
            ["dcs-ai-cli", "fetch",
             "--endpoint", "/api/v1/hq/search/product_codes_properties",
             "--method", "POST",
             "--body", body,
             "--name", f"style_{prdt_cd}"],
            capture_output=True, text=True, timeout=15,
        )
        # dcs-ai-cli가 저장한 파일에서 로드
        tmpdir = tempfile.gettempdir()
        files = sorted(glob.glob(os.path.join(tmpdir, "dcs-ai-cli", f"style_{prdt_cd}_*.json")))
        if files:
            raw = json.loads(open(files[-1], encoding="utf-8").read())
            data = raw.get("data", raw) if isinstance(raw, dict) else raw
            if isinstance(data, list) and data:
                return data[0]
    except Exception:
        pass
    return {}


# ──────────────────────────────────────────
# 데이터 로드
# ──────────────────────────────────────────
@st.cache_data(ttl=600)
def _load_data(brd_cd: str, season: str, _v: int = 2) -> pl.DataFrame:
    """발주/입고 데이터 로드 (_v: 캐시 무효화용 버전)"""
    df = load_order_inbound(brd_cd, season)
    if not df.is_empty():
        for col in ["STOR_QTY", "STOR_TAG_AMT", "ORD_QTY", "ORD_TAG_AMT"]:
            if col in df.columns:
                df = df.with_columns(pl.col(col).cast(pl.Int64, strict=False).fill_null(0))
    return df


# ──────────────────────────────────────────
# 주차별 입고 현황 (전년비)
# ──────────────────────────────────────────
SEASON_START_WEEK = 42  # SS 시즌 시작: 전년 42주차


def _is_fw_season(season: str) -> bool:
    """FW 시즌 여부 (시즌코드 끝이 F)"""
    return season.upper().endswith("F")


def _season_start_year(season: str) -> int:
    """시즌 코드 → 시즌 시작 연도
    SS: '26S' → 2025 (전년 10/1 시작)
    FW: '26F' → 2026 (당해 6/1 시작)
    """
    year = 2000 + int(season[:2])
    if _is_fw_season(season):
        return year
    return year - 1


def _to_season_week(dt: datetime.date, season: str) -> int:
    """날짜를 시즌 기준 상대 주차로 변환
    SS: 시즌 시작(전년 42주차) = 1주차
    FW: 시즌 시작(당해 6/1 기준 주차) = 1주차
    """
    iso_year, iso_week, _ = dt.isocalendar()
    start_year = _season_start_year(season)

    if _is_fw_season(season):
        start_week = _season_start_date(season).isocalendar()[1]
        if iso_year == start_year:
            rel = iso_week - start_week + 1
        else:
            rel = -1
    else:
        if iso_year == start_year:
            rel = iso_week - SEASON_START_WEEK + 1
        elif iso_year == start_year + 1:
            weeks_in_start_year = datetime.date(start_year, 12, 28).isocalendar()[1]
            rel = (weeks_in_start_year - SEASON_START_WEEK + 1) + iso_week
        else:
            rel = -1

    return rel


def _season_start_date(season: str) -> datetime.date:
    """시즌 시작 기준일
    SS 시즌 = 전년 12월 1일
    FW 시즌 = 당해 7월 1일
    """
    start_year = _season_start_year(season)
    if _is_fw_season(season):
        return datetime.date(start_year, 7, 1)
    return datetime.date(start_year, 12, 1)


def _season_end_date(season: str) -> datetime.date:
    """시즌 입고 진도율 차트 종료일
    SS 시즌 = 익년 5월 31일
    FW 시즌 = 당해 11월 30일
    """
    start = _season_start_date(season)
    if _is_fw_season(season):
        return datetime.date(start.year, 11, 30)
    return datetime.date(start.year + 1, 5, 31)


def _aggregate_weekly(
    df: pl.DataFrame,
    metric: str,
    season: str,
    item_group_filter: str | None = None,
) -> pl.DataFrame:
    """납기확정일 기준 입고율 집계 — X축은 시즌 시작일로부터 경과일 수

    Returns:
        DataFrame with columns: elapsed_days(경과일), ref_label(MM/DD), value(입고율%)
    """
    empty = pl.DataFrame({
        "elapsed_days": pl.Series([], dtype=pl.Int32),
        "ref_label": pl.Series([], dtype=pl.Utf8),
        "value": pl.Series([], dtype=pl.Float64),
    })

    if df.is_empty() or "INDC_DT_CNFM" not in df.columns:
        return empty

    work = df.filter(pl.col("STOR_QTY") > 0)
    if item_group_filter and "ITEM_GROUP" in work.columns:
        work = work.filter(pl.col("ITEM_GROUP") == item_group_filter)
    if work.is_empty():
        return empty

    work = work.with_columns(
        pl.col("INDC_DT_CNFM").str.to_date("%Y-%m-%d", strict=False).alias("_dt")
    ).filter(pl.col("_dt").is_not_null())
    if work.is_empty():
        return empty

    # 시즌 시작 기준일로부터 경과일 계산
    # 시작일 이전 입고분은 시작일(경과일=0)에 합산
    season_start = _season_start_date(season)
    end_date = _season_end_date(season)
    max_elapsed = (end_date - season_start).days

    dates = work["_dt"].to_list()
    elapsed = [max((d - season_start).days, 0) for d in dates]
    labels = [f"{max(d, season_start).month:02d}/{max(d, season_start).day:02d}" for d in dates]

    work = work.with_columns([
        pl.Series("elapsed_days", elapsed, dtype=pl.Int32),
        pl.Series("ref_label", labels),
    ])

    # 시즌 범위 제한 (종료일 이후만 제외, 시작일 이전은 0으로 합산됨)
    work = work.filter(pl.col("elapsed_days") <= max_elapsed)
    if work.is_empty():
        return empty

    # 발주 기준값
    total_df = df
    if item_group_filter and "ITEM_GROUP" in df.columns:
        total_df = df.filter(pl.col("ITEM_GROUP") == item_group_filter)

    total_styles = total_df["PRDT_CD"].n_unique() if "PRDT_CD" in total_df.columns else 1
    total_qty = float(total_df["ORD_QTY"].sum()) if "ORD_QTY" in total_df.columns else 1
    total_amt = float(total_df["ORD_TAG_AMT"].sum()) / 1e8 if "ORD_TAG_AMT" in total_df.columns else 1

    # 경과일별 집계
    if metric == "styles":
        weekly = (
            work.group_by(["elapsed_days", "ref_label"])
            .agg(pl.col("PRDT_CD").n_unique().cast(pl.Float64).alias("value"))
            .sort("elapsed_days")
        )
        denom = max(total_styles, 1)
    elif metric == "qty":
        weekly = (
            work.group_by(["elapsed_days", "ref_label"])
            .agg(pl.col("STOR_QTY").sum().cast(pl.Float64).alias("value"))
            .sort("elapsed_days")
        )
        denom = max(total_qty, 1)
    elif metric == "amt":
        weekly = (
            work.group_by(["elapsed_days", "ref_label"])
            .agg((pl.col("STOR_TAG_AMT").sum().cast(pl.Float64) / 1e8).alias("value"))
            .sort("elapsed_days")
        )
        denom = max(total_amt, 0.01)
    else:
        return empty

    # 누적 → 진도율(%)
    weekly = weekly.with_columns(
        (pl.col("value").cum_sum() / denom * 100).alias("value")
    )

    return weekly


def _build_weekly_chart(
    curr_weekly: pl.DataFrame,
    prev_weekly: pl.DataFrame,
    season: str,
    prev_season: str,
    metric: str,
) -> go.Figure:
    """입고율 꺾은선 그래프 (당시즌 vs 전년, elapsed_days 기반 동기간 비교)"""
    fig = go.Figure()

    metric_labels = {"styles": "스타일 수 기준 입고율", "qty": "수량 기준 입고율", "amt": "금액 기준 입고율"}
    y_title = metric_labels.get(metric, metric)

    # 시즌 종료일까지만 표시
    season_start = _season_start_date(season)
    end_date = _season_end_date(season)
    max_elapsed = (end_date - season_start).days
    if not prev_weekly.is_empty():
        prev_weekly = prev_weekly.filter(pl.col("elapsed_days") <= max_elapsed)
    if not curr_weekly.is_empty():
        curr_weekly = curr_weekly.filter(pl.col("elapsed_days") <= max_elapsed)

    # 전년 라인 (회색, 점선)
    if not prev_weekly.is_empty():
        fig.add_trace(go.Scatter(
            x=prev_weekly["elapsed_days"].to_list(),
            y=prev_weekly["value"].to_list(),
            mode="lines+markers",
            name=f"{prev_season}",
            line=dict(color="#9ca3af", width=2, dash="dot"),
            marker=dict(size=4, color="#9ca3af"),
            customdata=prev_weekly["ref_label"].to_list(),
            hovertemplate=f"{prev_season} %{{customdata}}: %{{y:.1f}}%<extra></extra>",
        ))

    # 당시즌 라인 (진한 보라, 부드러운 곡선)
    if not curr_weekly.is_empty():
        fig.add_trace(go.Scatter(
            x=curr_weekly["elapsed_days"].to_list(),
            y=curr_weekly["value"].to_list(),
            mode="lines+markers",
            name=f"{season}",
            line=dict(color="#4f46e5", width=3, shape="spline"),
            marker=dict(size=5, color="#4f46e5"),
            fill="tozeroy",
            fillcolor="rgba(79, 70, 229, 0.08)",
            customdata=curr_weekly["ref_label"].to_list(),
            hovertemplate=f"{season} %{{customdata}}: %{{y:.1f}}%<extra></extra>",
        ))

    # X축 tick: 경과일을 월/일 라벨로 변환 (15일 간격, 5/15까지)
    tick_vals = []
    tick_texts = []
    for offset in range(0, max_elapsed + 1, 15):
        d = season_start + datetime.timedelta(days=offset)
        tick_vals.append(offset)
        tick_texts.append(f"{d.month}/{d.day}")

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text=f"입고율 추이 (전년비) — {y_title}", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(
            title="기준일",
            gridcolor=tc["gridcolor"],
            tickvals=tick_vals,
            ticktext=tick_texts,
            tickangle=-45,
        ),
        yaxis=dict(title="입고율 (%)", gridcolor=tc["gridcolor"], range=[0, 110]),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=420,
        margin=dict(l=60, r=20, t=60, b=80),
        hovermode="x unified",
    )
    return fig


def _render_weekly_inbound_section(
    df: pl.DataFrame,
    prev_df: pl.DataFrame,
    season: str,
    prev_season: str,
) -> None:
    """주차별 입고 현황 섹션 — 메트릭 선택 + 복종 필터"""
    st.markdown("### 주차별 입고 현황 (전년비)")

    metric = st.radio(
        "기준 선택",
        options=["styles", "qty", "amt"],
        format_func=lambda x: {"styles": "스타일 수", "qty": "입고 수량", "amt": "입고 금액 (억)"}[x],
        horizontal=True,
        key="weekly_metric",
    )

    # 주차별 집계 (시즌별 상대 주차)
    curr_weekly = _aggregate_weekly(df, metric, season)
    prev_weekly = _aggregate_weekly(prev_df, metric, prev_season)

    # 차트
    fig = _build_weekly_chart(curr_weekly, prev_weekly, season, prev_season, metric)
    st.plotly_chart(fig, use_container_width=True)


# ──────────────────────────────────────────
# 차트: 아이템그룹별 발주/입고 진행률
# ──────────────────────────────────────────
def _build_progress_chart(df: pl.DataFrame, metric: str = "qty") -> go.Figure:
    """아이템그룹별 발주/입고 진행률 (metric: styles, qty, amt)"""
    if metric == "styles":
        group_df = (
            df.group_by("ITEM_GROUP")
            .agg([
                pl.col("PRDT_CD").n_unique().alias("ord_val"),
                pl.col("PRDT_CD").filter(pl.col("STOR_QTY") > 0).n_unique().alias("stor_val"),
            ])
            .sort("ord_val", descending=False)
        )
        ord_label, stor_label, x_title = "발주 스타일", "입고 스타일", "스타일 수"
        fmt = lambda v: f"{v:,.0f}"
    elif metric == "amt":
        group_df = (
            df.group_by("ITEM_GROUP")
            .agg([
                (pl.col("ORD_TAG_AMT").sum() / 1e8).alias("ord_val"),
                (pl.col("STOR_TAG_AMT").sum() / 1e8).alias("stor_val"),
            ])
            .sort("ord_val", descending=False)
        )
        ord_label, stor_label, x_title = "발주금액", "입고금액", "금액 (억)"
        fmt = lambda v: f"{v:,.1f}"
    else:  # qty
        group_df = (
            df.group_by("ITEM_GROUP")
            .agg([
                pl.col("ORD_QTY").sum().alias("ord_val"),
                pl.col("STOR_QTY").sum().alias("stor_val"),
            ])
            .sort("ord_val", descending=False)
        )
        ord_label, stor_label, x_title = "발주수량", "입고수량", "수량"
        fmt = lambda v: f"{v:,.0f}"

    groups = group_df["ITEM_GROUP"].to_list()
    ord_vals = group_df["ord_val"].to_list()
    stor_vals = group_df["stor_val"].to_list()

    # 입고율 계산
    fulfill_rates = [(s / o * 100) if o > 0 else 0.0 for o, s in zip(ord_vals, stor_vals)]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        y=groups, x=ord_vals, orientation="h",
        name=ord_label, marker_color="#d1d5db",
        text=[f"{fmt(v)}  ({r:.1f}%)" for v, r in zip(ord_vals, fulfill_rates)],
        textposition="outside", textfont=dict(size=11),
    ))
    bar_colors = [CATEGORY_COLORS.get(g, "#4f46e5") for g in groups]
    fig.add_trace(go.Bar(
        y=groups, x=stor_vals, orientation="h",
        name=stor_label, marker_color=bar_colors,
        text=[fmt(v) for v in stor_vals], textposition="inside", textfont=dict(size=11, color="white"),
    ))

    metric_title = {"styles": "스타일 수 기준", "qty": "수량 기준", "amt": "금액 기준"}
    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        barmode="overlay",
        title=dict(text=f"아이템그룹별 발주 / 입고 진행률 — {metric_title.get(metric, '')}", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"], plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title=x_title, gridcolor=tc["gridcolor"]),
        yaxis=dict(categoryorder="array", categoryarray=groups),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=max(300, len(groups) * 70 + 100),
        margin=dict(l=120, r=120, t=60, b=40),
    )
    return fig


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    st.markdown("## 오더 현황 대시보드")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", CURRENT_SEASON)
    prev_season = get_prev_season(season)
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    today = datetime.date.today()

    # ── 데이터 로드 ──
    df = _load_data(brd_cd, season)
    prev_df = _load_data(brd_cd, prev_season)

    if df.is_empty():
        st.warning(f"{brand_name} {season} 시즌 발주 데이터가 없습니다.")
        return

    # ── KPI 계산: 당시즌 ──
    ord_amt = df["ORD_TAG_AMT"].sum() if "ORD_TAG_AMT" in df.columns else 0
    stor_amt = df["STOR_TAG_AMT"].sum() if "STOR_TAG_AMT" in df.columns else 0
    ord_qty = df["ORD_QTY"].sum() if "ORD_QTY" in df.columns else 0
    stor_qty = df["STOR_QTY"].sum() if "STOR_QTY" in df.columns else 0

    style_count = _count_styles(df)
    style_stor = _count_styles_with_stor(df)
    sku_count = _count_sku(df)
    sku_stor = _count_sku_with_stor(df)
    po_total, po_initial, po_reorder = _count_po(df)

    fulfill_qty_pct = (stor_qty / ord_qty * 100) if ord_qty > 0 else 0
    fulfill_amt_pct = (stor_amt / ord_amt * 100) if ord_amt > 0 else 0
    style_progress = (style_stor / style_count * 100) if style_count > 0 else 0
    sku_progress = (sku_stor / sku_count * 100) if sku_count > 0 else 0

    # ── KPI 계산: 전년 동시즌 ──
    if not prev_df.is_empty() and "ORD_TAG_AMT" in prev_df.columns:
        prev_ord_amt = prev_df["ORD_TAG_AMT"].sum()
        prev_stor_amt = prev_df["STOR_TAG_AMT"].sum() if "STOR_TAG_AMT" in prev_df.columns else 0
        prev_ord_qty = prev_df["ORD_QTY"].sum() if "ORD_QTY" in prev_df.columns else 0
        prev_stor_qty = prev_df["STOR_QTY"].sum() if "STOR_QTY" in prev_df.columns else 0
        prev_style = _count_styles(prev_df)
        prev_style_stor = _count_styles_with_stor(prev_df)
        prev_sku = _count_sku(prev_df)
        prev_sku_stor = _count_sku_with_stor(prev_df)
        prev_po_total, prev_po_initial, prev_po_reorder = _count_po(prev_df)
        prev_fulfill_qty = (prev_stor_qty / prev_ord_qty * 100) if prev_ord_qty > 0 else 0
    else:
        prev_ord_amt = prev_stor_amt = prev_ord_qty = prev_stor_qty = 0
        prev_style = prev_style_stor = prev_sku = prev_sku_stor = 0
        prev_po_total = prev_po_initial = prev_po_reorder = 0
        prev_fulfill_qty = 0

    st.caption(
        f"{brand_name} | 시즌: {season} | 기준일: {today.strftime('%Y-%m-%d')} | "
        f"전년 비교: {prev_season} | 공통/대리상/마케팅/면세점/홀세일 오더 전체 포함"
    )

    # ── KPI 6개 카드 ──
    cols = st.columns(6)

    with cols[0]:
        _render_kpi_card(
            label="발주액",
            icon="📦",
            main_value=_fmt_amt(ord_amt),
            sub_lines=[
                f"입고액: {_fmt_amt(stor_amt)} (진도 {_fmt_pct(fulfill_amt_pct)})",
                f"전년 발주: {_fmt_amt(prev_ord_amt)}" if prev_ord_amt > 0 else "",
                f"전년 입고: {_fmt_amt(prev_stor_amt)}" if prev_stor_amt > 0 else "",
                _delta_str(stor_amt, prev_stor_amt, "억") if prev_stor_amt > 0 else "",
            ],
            color="#4f46e5",
        )

    with cols[1]:
        _render_kpi_card(
            label="발주 스타일",
            icon="👗",
            main_value=f"{style_count} sty",
            sub_lines=[
                f"입고: {style_stor} sty (진도 {_fmt_pct(style_progress)})",
                f"전년: {prev_style} sty" if prev_style > 0 else "",
                f"전년 입고: {prev_style_stor} sty" if prev_style_stor > 0 else "",
                _delta_str(style_count, prev_style) if prev_style > 0 else "",
            ],
            color="#7c3aed",
        )

    with cols[2]:
        _render_kpi_card(
            label="발주 SKU",
            icon="🏷️",
            main_value=f"{sku_count:,} SKU",
            sub_lines=[
                f"입고: {sku_stor:,} SKU (진도 {_fmt_pct(sku_progress)})",
                f"전년: {prev_sku:,} SKU" if prev_sku > 0 else "",
                f"전년 입고: {prev_sku_stor:,} SKU" if prev_sku_stor > 0 else "",
                _delta_str(sku_count, prev_sku) if prev_sku > 0 else "",
            ],
            color="#2563eb",
        )

    with cols[3]:
        _render_kpi_card(
            label="발주 수량",
            icon="📊",
            main_value=f"{ord_qty:,.0f} PCS",
            sub_lines=[
                f"입고: {stor_qty:,.0f} PCS (진도 {_fmt_pct(fulfill_qty_pct)})",
                f"전년 발주: {prev_ord_qty:,.0f} PCS" if prev_ord_qty > 0 else "",
                f"전년 입고: {prev_stor_qty:,.0f} PCS" if prev_stor_qty > 0 else "",
                _delta_str(stor_qty, prev_stor_qty) if prev_stor_qty > 0 else "",
            ],
            color="#059669",
        )

    with cols[4]:
        _render_kpi_card(
            label="PO 건수",
            icon="📋",
            main_value=f"{po_total}건",
            sub_lines=[
                f"이니셜: {po_initial}건 / 리오더: {po_reorder}건",
                f"전년: {prev_po_total}건 (이니셜 {prev_po_initial} / 리오더 {prev_po_reorder})" if prev_po_total > 0 else "",
                _delta_str(po_total, prev_po_total) if prev_po_total > 0 else "",
                "",  # 높이 맞추기용 빈 줄
            ],
            color="#d97706",
        )

    with cols[5]:
        sale_data = load_season_sale(brd_cd)
        if sale_data:
            curr_sale = sale_data.get("당해누적판매액", 0)
            prev_sale = sale_data.get("전년누적판매액", 0)
            prev_end_sale = sale_data.get("전년마감판매액", 0)
            sale_rate = sale_data.get("당해판매율", 0)
            prev_sale_rate = sale_data.get("전년판매율", 0)
            _render_kpi_card(
                label="판매금액 (누적)",
                icon="💰",
                main_value=_fmt_amt(curr_sale),
                sub_lines=[
                    f"판매율: {sale_rate}%",
                    f"전년 동기: {_fmt_amt(prev_sale)} (판매율 {prev_sale_rate}%)" if prev_sale > 0 else "",
                    f"전년 마감: {_fmt_amt(prev_end_sale)}" if prev_end_sale > 0 else "",
                    _delta_str(curr_sale, prev_sale, "억") if prev_sale > 0 else "",
                ],
                color="#dc2626",
            )
        else:
            _render_kpi_card(
                label="판매금액",
                icon="💰",
                main_value="-",
                sub_lines=["판매 데이터 없음"],
                color="#dc2626",
            )

    st.markdown("")
    st.markdown("---")

    # ── 주차별 입고 현황 (전년비) ──
    _render_weekly_inbound_section(df, prev_df, season, prev_season)

    st.markdown("---")

    # ── 아이템그룹별 진행률 차트 ──
    progress_metric = st.radio(
        "기준 선택",
        options=["styles", "qty", "amt"],
        format_func=lambda x: {"styles": "스타일 수", "qty": "수량", "amt": "금액 (억)"}[x],
        horizontal=True,
        key="progress_metric",
    )
    fig = _build_progress_chart(df, progress_metric)
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # ── 오더 상세 테이블 ──
    st.markdown("### 오더 상세")

    # PO×스타일 단위로 집계 (SKU 레벨 → 스타일 레벨)
    group_cols = [c for c in [
        "PO_NO", "PRDT_CD", "PRDT_NM", "ITEM", "ITEM_GROUP",
        "MFAC_COMPY_NM", "ORIGIN_NM", "INDC_DT_REQ", "INDC_DT_CNFM", "ORD_TYPE",
    ] if c in df.columns]

    table_df = (
        df.group_by(group_cols)
        .agg([
            pl.col("ORD_QTY").sum().alias("ORD_QTY"),
            pl.col("STOR_QTY").sum().alias("STOR_QTY"),
            pl.col("ORD_TAG_AMT").sum().alias("ORD_TAG_AMT"),
            pl.col("STOR_TAG_AMT").sum().alias("STOR_TAG_AMT") if "STOR_TAG_AMT" in df.columns else pl.lit(0).alias("STOR_TAG_AMT"),
        ])
        .with_columns(
            (pl.col("STOR_QTY") / pl.col("ORD_QTY") * 100).round(1).alias("진행률(%)"),
        )
        .sort("ORD_TAG_AMT", descending=True)
    )

    # style_code 열 추가 (브랜드1자+시즌3자 = 4자 제거: V26S → VDWJ10661)
    if "PRDT_CD" in table_df.columns:
        table_df = table_df.with_columns(
            pl.col("PRDT_CD").str.slice(4).alias("style_code")
        )

    # 리오더 구분 열
    if "PO_NO" in table_df.columns:
        table_df = table_df.with_columns(
            pl.col("PO_NO").map_elements(
                lambda po: "리오더" if _is_reorder(po) else "이니셜", return_dtype=pl.Utf8
            ).alias("오더구분")
        )

    # 열 이름 매핑
    col_rename = {
        "PO_NO": "PO번호", "PRDT_CD": "스타일코드(풀)", "PRDT_NM": "품명",
        "ITEM": "아이템", "ITEM_GROUP": "카테고리",
        "MFAC_COMPY_NM": "협력사", "ORIGIN_NM": "생산국",
        "INDC_DT_REQ": "납기요청일", "INDC_DT_CNFM": "납기확정일",
        "ORD_QTY": "발주수량", "STOR_QTY": "입고수량",
        "ORD_TAG_AMT": "발주액", "STOR_TAG_AMT": "입고액",
        "style_code": "스타일",
    }
    table_df = table_df.rename({k: v for k, v in col_rename.items() if k in table_df.columns})

    # ── 필터: 미입고/입고 + 스타일 검색 ──
    filter_cols = st.columns([1, 2, 3])

    with filter_cols[0]:
        stor_filter = st.radio(
            "입고 상태",
            options=["전체", "미입고", "입고"],
            horizontal=True,
            key="order_detail_stor_filter",
        )

    with filter_cols[1]:
        style_search = st.text_input(
            "스타일 검색 (예: VDWJ31261)",
            key="order_detail_style_search",
            placeholder="스타일 코드 입력...",
        )

    # 필터 적용
    filtered_df = table_df

    if stor_filter == "미입고":
        filtered_df = filtered_df.filter(pl.col("입고수량") == 0)
    elif stor_filter == "입고":
        filtered_df = filtered_df.filter(pl.col("입고수량") > 0)

    if style_search.strip():
        search_term = style_search.strip().upper()
        filtered_df = filtered_df.filter(
            pl.col("스타일").str.to_uppercase().str.contains(search_term)
        )

    # 표시 열 순서
    display_order = [
        "PO번호", "스타일", "품명", "카테고리", "협력사", "생산국",
        "오더구분", "납기확정일",
        "발주수량", "입고수량", "진행률(%)",
    ]
    display_order = [c for c in display_order if c in filtered_df.columns]

    st.caption(f"총 {filtered_df.height}건")

    # column_config로 필터 기능 제공
    display_pd = filtered_df.select(display_order).to_pandas()

    col_config = {}
    for col_name in display_order:
        if col_name in ("발주수량", "입고수량"):
            col_config[col_name] = st.column_config.NumberColumn(col_name, format="%,.0f")
        elif col_name == "진행률(%)":
            col_config[col_name] = st.column_config.ProgressColumn(
                col_name, min_value=0, max_value=100, format="%.1f%%"
            )
        elif col_name == "카테고리":
            categories = sorted(display_pd[col_name].dropna().unique().tolist()) if col_name in display_pd.columns else []
            col_config[col_name] = st.column_config.SelectboxColumn(col_name, options=categories)
        elif col_name == "협력사":
            suppliers = sorted(display_pd[col_name].dropna().unique().tolist()) if col_name in display_pd.columns else []
            col_config[col_name] = st.column_config.SelectboxColumn(col_name, options=suppliers)
        elif col_name == "오더구분":
            col_config[col_name] = st.column_config.SelectboxColumn(col_name, options=["이니셜", "리오더"])

    # 테이블에서 행 클릭 → 세션에 저장
    event = st.dataframe(
        display_pd,
        use_container_width=True,
        height=min(600, 40 + filtered_df.height * 35),
        column_config=col_config,
        on_select="rerun",
        selection_mode="single-row",
        key="order_detail_table",
    )

    # 행 선택 감지 → dialog 호출
    if event and event.selection and event.selection.rows:
        sel_idx = event.selection.rows[0]
        sel_row = display_pd.iloc[sel_idx]
        show_style_detail(
            brd_cd=brd_cd,
            season=season,
            sel_style=sel_row.get("스타일", ""),
            sel_po=sel_row.get("PO번호", ""),
            row_info=sel_row.to_dict(),
            raw_df=df,
        )


# ──────────────────────────────────────────
# 입고 상세 팝업 (모듈 레벨 dialog)
# ──────────────────────────────────────────
@st.dialog("입고 상세", width="large")
def show_style_detail(brd_cd: str, season: str, sel_style: str, sel_po: str, row_info: dict, raw_df: pl.DataFrame):
    """스타일 입고 상세 팝업 — 테이블 행 클릭 시 호출"""
    import pandas as pd

    sel_prdt_nm = row_info.get("품명", "-")
    sel_category = row_info.get("카테고리", "-")
    sel_supplier = row_info.get("협력사", "-")
    sel_origin = row_info.get("생산국", "-")
    sel_cnfm = row_info.get("납기확정일", "-")

    # ── KG에서 스타일 마스터 정보 조회 ──
    prdt_cd_full = f"{brd_cd}{season}{sel_style}"
    style_info = _fetch_style_info(brd_cd, prdt_cd_full)

    img_url = style_info.get("PRDT_IMG_URL", "")
    kg_prdt_nm = style_info.get("PRDT_NM", sel_prdt_nm)
    tag_price = style_info.get("TAG_PRICE", 0)
    sex_nm = style_info.get("SEX_NM", "-")
    item_nm = style_info.get("ITEM_NM", "-")
    stor_dt_1st = style_info.get("STOR_DT_1ST", "-")
    sale_dt_1st = style_info.get("SALE_DT_1ST", "-")

    # ── 상단: 대표 이미지 + 기본 정보 ──
    top_cols = st.columns([1, 3])
    with top_cols[0]:
        if img_url:
            st.image(img_url, width=200, caption=sel_style)
        else:
            st.markdown(
                '<div style="width:200px;height:240px;background:#f3f4f6;border-radius:8px;'
                'display:flex;align-items:center;justify-content:center;color:#9ca3af;'
                'font-size:14px;">이미지 없음</div>',
                unsafe_allow_html=True,
            )

    with top_cols[1]:
        st.markdown(f"""
        <div style="padding: 8px 0;">
            <div style="font-size: 22px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">{sel_style}</div>
            <div style="font-size: 16px; color: #4b5563; margin-bottom: 12px;">{kg_prdt_nm}</div>
            <table style="font-size: 13px; color: #374151; border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280; width:100px;">PO번호</td><td>{sel_po}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">카테고리</td><td>{sel_category} / {item_nm}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">성별</td><td>{sex_nm}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">택가</td><td>{tag_price:,.0f}원</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">협력사</td><td>{sel_supplier}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">생산국</td><td>{sel_origin}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">납기확정일</td><td>{sel_cnfm}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">최초입고</td><td>{stor_dt_1st}</td></tr>
                <tr><td style="padding: 4px 20px 4px 0; font-weight:600; color:#6b7280;">최초판매</td><td>{sale_dt_1st}</td></tr>
            </table>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("---")

    # SKU 데이터 필터
    work_df = raw_df.filter(pl.col("PRDT_CD").str.ends_with(sel_style))
    if sel_po and not work_df.is_empty():
        work_df = work_df.filter(pl.col("PO_NO") == sel_po)

    # ── 컬러별 × 사이즈별 오더/입고/Balance 피벗 ──
    st.markdown("**컬러 / 사이즈별 오더 · 입고 · Balance**")

    if work_df.is_empty() or "COLOR_CD" not in work_df.columns or "SIZE_CD" not in work_df.columns:
        st.info("SKU 상세 데이터가 없습니다.")
        return

    sizes = sorted(work_df["SIZE_CD"].unique().to_list())
    colors = sorted(work_df["COLOR_CD"].unique().to_list())

    pivot_rows = []
    color_totals = {}
    for color in colors:
        color_data = work_df.filter(pl.col("COLOR_CD") == color)
        ord_row = {"컬러": color, "구분": "오더"}
        stor_row = {"컬러": color, "구분": "입고"}
        bal_row = {"컬러": color, "구분": "Balance"}
        c_ord_total = c_stor_total = 0

        for size in sizes:
            size_data = color_data.filter(pl.col("SIZE_CD") == size)
            o = int(size_data["ORD_QTY"].sum()) if not size_data.is_empty() else 0
            s = int(size_data["STOR_QTY"].sum()) if not size_data.is_empty() else 0
            ord_row[size] = o
            stor_row[size] = s
            bal_row[size] = o - s
            c_ord_total += o
            c_stor_total += s

        ord_row["합계"] = c_ord_total
        stor_row["합계"] = c_stor_total
        bal_row["합계"] = c_ord_total - c_stor_total
        pivot_rows.extend([ord_row, stor_row, bal_row])
        color_totals[color] = (c_ord_total, c_stor_total)

    total_ord = {"컬러": "합계", "구분": "오더"}
    total_stor = {"컬러": "합계", "구분": "입고"}
    total_bal = {"컬러": "합계", "구분": "Balance"}
    grand_ord = grand_stor = 0
    for size in sizes:
        s_ord = sum(r[size] for r in pivot_rows if r["구분"] == "오더" and r["컬러"] != "합계")
        s_stor = sum(r[size] for r in pivot_rows if r["구분"] == "입고" and r["컬러"] != "합계")
        total_ord[size] = s_ord
        total_stor[size] = s_stor
        total_bal[size] = s_ord - s_stor
        grand_ord += s_ord
        grand_stor += s_stor
    total_ord["합계"] = grand_ord
    total_stor["합계"] = grand_stor
    total_bal["합계"] = grand_ord - grand_stor
    pivot_rows.extend([total_ord, total_stor, total_bal])

    pivot_df = pd.DataFrame(pivot_rows, columns=["컬러", "구분"] + sizes + ["합계"])
    st.dataframe(pivot_df, use_container_width=True, hide_index=True)

    st.markdown("---")

    # ── 납기확정일별 입고 내역 ──
    st.markdown("**납기확정일별 입고 내역**")
    inbound_data = work_df.filter(pl.col("STOR_QTY") > 0) if "STOR_QTY" in work_df.columns else pl.DataFrame()

    if not inbound_data.is_empty():
        date_rows = []
        for row in inbound_data.sort("INDC_DT_CNFM").iter_rows(named=True):
            o, s = row.get("ORD_QTY", 0), row.get("STOR_QTY", 0)
            date_rows.append({
                "납기확정일": row.get("INDC_DT_CNFM", "-"),
                "컬러": row.get("COLOR_CD", "-"),
                "사이즈": row.get("SIZE_CD", "-"),
                "오더수량": o, "입고수량": s,
                "Balance": o - s,
                "입고율(%)": round(s / max(o, 1) * 100, 1),
            })
        st.dataframe(pd.DataFrame(date_rows), use_container_width=True, hide_index=True)
    else:
        st.info("아직 입고 내역이 없습니다. (미입고 상태)")

    st.markdown("---")

    # ── 컬러별 요약 ──
    st.markdown("**컬러별 요약**")
    summary_rows = []
    for color in colors:
        c_ord, c_stor = color_totals[color]
        summary_rows.append({
            "컬러": color, "오더수량": c_ord, "입고수량": c_stor,
            "Balance": c_ord - c_stor,
            "입고율(%)": round(c_stor / max(c_ord, 1) * 100, 1),
        })
    summary_rows.append({
        "컬러": "합계", "오더수량": grand_ord, "입고수량": grand_stor,
        "Balance": grand_ord - grand_stor,
        "입고율(%)": round(grand_stor / max(grand_ord, 1) * 100, 1),
    })
    st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)
