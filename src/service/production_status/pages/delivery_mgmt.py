"""
Cat.1 납기 관리 페이지
납기준수율, D-7 임박건, 지연건, 평균 리드타임 KPI 및 협력사별 분석
"""
import datetime

import polars as pl
import plotly.graph_objects as go
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CHART_COLORS,
    CURRENT_SEASON,
    PLOTLY_TEMPLATE_CONFIG,
    STATUS_COLORS,
)

try:
    from src.service.common.components import (
        season_filter,
        render_status_badge,
        format_number,
    )
except ImportError:
    from src.core.config import BRANDS as _B

    def season_filter(current: str, options=None, key="season_filter") -> str:
        if options is None:
            options = [current]
        if key in st.session_state and st.session_state[key] not in options:
            del st.session_state[key]
        return st.selectbox("운용시즌", options, index=0, key=key)

    def render_status_badge(status_dict: dict) -> str:
        return f'{status_dict.get("icon", "")} {status_dict.get("label", "")}'

    def format_number(value: float, unit: str = "") -> str:
        if unit == "억":
            return f"{value / 1e8:,.1f}억"
        if unit == "천":
            return f"{value / 1000:,.1f}천"
        return f"{value:,.0f}{unit}"


# ──────────────────────────────────────────
# 샘플 데이터 (order_dashboard.py 와 동일 구조 재활용)
# ──────────────────────────────────────────
def _generate_sample_data() -> pl.DataFrame:
    """납기 관리용 샘플 데이터 (20개 PO)"""
    today = datetime.date(2026, 4, 7)
    rows = [
        ("PO26V-001", "V26S-OT001", "KAPPA 다운 자켓",       "DOWN JK",     "OUTER",   "동진텍스타일", "중국",       "2026-04-15", "2026-04-14", "본오더", 3000, 4500000000, 2400),
        ("PO26V-002", "V26S-OT002", "DUVETICA 구스다운 베스트", "DOWN VEST",  "OUTER",   "성원어패럴",   "베트남",     "2026-04-20", "2026-04-22", "본오더", 2500, 3750000000, 1800),
        ("PO26V-003", "V26S-OT003", "라이트 윈드브레이커",     "WIND BK",     "OUTER",   "한세실업",     "베트남",     "2026-04-10", "2026-04-10", "본오더", 4000, 3200000000, 3800),
        ("PO26V-004", "V26S-OT004", "나일론 봄버 자켓",       "BOMBER JK",   "OUTER",   "동진텍스타일", "중국",       "2026-04-05", "2026-04-06", "본오더", 1800, 2700000000, 1800),
        ("PO26V-005", "V26S-OT005", "테크 쉘 파카",           "PARKA",       "OUTER",   "에스앤케이",   "인도네시아", "2026-05-01", "2026-05-03", "본오더", 1200, 2400000000, 0),
        ("PO26V-006", "V26S-IN001", "에센셜 라운드 티셔츠",   "T-SHIRT",     "INNER",   "한세실업",     "베트남",     "2026-04-12", "2026-04-12", "본오더", 8000, 2400000000, 7200),
        ("PO26V-007", "V26S-IN002", "쿨맥스 폴로 셔츠",       "POLO",        "INNER",   "성원어패럴",   "베트남",     "2026-04-08", "2026-04-09", "본오더", 5000, 2000000000, 4500),
        ("PO26V-008", "V26S-IN003", "오버핏 스웻셔츠",         "SWEAT",       "INNER",   "동진텍스타일", "중국",       "2026-04-18", "2026-04-20", "본오더", 3500, 1750000000, 1000),
        ("PO26V-009", "V26S-IN004", "그래픽 후디",             "HOODIE",      "INNER",   "에스앤케이",   "인도네시아", "2026-03-30", "2026-04-02", "본오더", 2000, 1200000000, 2000),
        ("PO26V-010", "V26S-IN005", "린넨 블렌드 셔츠",       "SHIRT",       "INNER",   "한세실업",     "베트남",     "2026-04-25", "2026-04-25", "리오더", 1500, 900000000,  0),
        ("PO26V-011", "V26S-BT001", "와이드 카고 팬츠",       "CARGO",       "BOTTOM",  "세아상역",     "중국",       "2026-04-10", "2026-04-11", "본오더", 6000, 2400000000, 5500),
        ("PO26V-012", "V26S-BT002", "슬림핏 치노 팬츠",       "CHINO",       "BOTTOM",  "에스앤케이",   "인도네시아", "2026-04-14", "2026-04-15", "본오더", 4500, 1800000000, 3200),
        ("PO26V-013", "V26S-BT003", "조거 트레이닝 팬츠",     "JOGGER",      "BOTTOM",  "세아상역",     "중국",       "2026-04-06", "2026-04-06", "본오더", 3000, 1200000000, 3000),
        ("PO26V-014", "V26S-BT004", "데님 스트레이트 진",     "DENIM",       "BOTTOM",  "동진텍스타일", "중국",       "2026-04-22", "2026-04-24", "리오더", 2000, 1000000000, 500),
        ("PO26V-015", "V26S-AC001", "로고 볼캡",             "CAP",         "ACC_ETC", "태광실업",     "한국",       "2026-04-08", "2026-04-08", "본오더", 10000, 800000000, 9500),
        ("PO26V-016", "V26S-AC002", "스포츠 백팩",           "BAG",         "ACC_ETC", "태광실업",     "한국",       "2026-04-15", "2026-04-16", "본오더", 3000, 1500000000, 2000),
        ("PO26V-017", "V26S-AC003", "로고 양말 3팩",         "SOCKS",       "ACC_ETC", "성원어패럴",   "베트남",     "2026-04-03", "2026-04-03", "본오더", 15000, 450000000, 15000),
        ("PO26V-018", "V26S-AC004", "유틸리티 벨트",         "BELT",        "ACC_ETC", "태광실업",     "한국",       "2026-05-10", "2026-05-12", "리오더", 2000, 400000000,  0),
        ("PO26V-019", "V26S-OT006", "리버서블 패딩 베스트",   "PADDING VEST","OUTER",   "한세실업",     "베트남",     "2026-04-03", "2026-04-05", "본오더", 2200, 2200000000, 2200),
        ("PO26V-020", "V26S-IN006", "드라이핏 탱크탑",       "TANK TOP",    "INNER",   "세아상역",     "중국",       "2026-04-11", "2026-04-11", "리오더", 4000, 800000000,  3600),
    ]

    return pl.DataFrame(
        {
            "PO_NO":        [r[0] for r in rows],
            "PRDT_CD":      [r[1] for r in rows],
            "PRDT_NM":      [r[2] for r in rows],
            "ITEM":         [r[3] for r in rows],
            "ITEM_GROUP":   [r[4] for r in rows],
            "MFAC_COMPY_NM":[r[5] for r in rows],
            "ORIGIN_NM":    [r[6] for r in rows],
            "INDC_DT_REQ":  [r[7] for r in rows],
            "INDC_DT_CNFM": [r[8] for r in rows],
            "ORD_TYPE":     [r[9] for r in rows],
            "ORD_QTY":      [r[10] for r in rows],
            "ORD_TAG_AMT":  [r[11] for r in rows],
            "STOR_QTY":     [r[12] for r in rows],
        },
    )


# ──────────────────────────────────────────
# 납기 상태 판정
# ──────────────────────────────────────────
def _calc_delivery_status(row: dict, today: datetime.date) -> str:
    """납기확정일 기준 상태 판정: good / warn / danger"""
    cnfm = row.get("INDC_DT_CNFM") or row.get("INDC_DT_REQ")
    if not cnfm:
        return "good"
    try:
        cnfm_date = datetime.date.fromisoformat(str(cnfm))
    except (ValueError, TypeError):
        return "good"

    stor_qty = row.get("STOR_QTY", 0) or 0
    ord_qty = row.get("ORD_QTY", 1) or 1
    progress = stor_qty / ord_qty

    if progress >= 1.0:
        return "good"

    diff = (cnfm_date - today).days
    if diff < 0:
        return "danger"
    elif diff <= 7:
        return "warn"
    return "good"


def _calc_d_day(row: dict, today: datetime.date) -> tuple[str, int | None]:
    """D-Day 문자열과 정수 반환"""
    cnfm = row.get("INDC_DT_CNFM") or row.get("INDC_DT_REQ")
    try:
        cnfm_date = datetime.date.fromisoformat(str(cnfm))
        diff = (cnfm_date - today).days
        label = f"D{diff:+d}" if diff != 0 else "D-Day"
        return label, diff
    except (ValueError, TypeError):
        return "-", None


# ──────────────────────────────────────────
# 협력사별 납기준수율 Horizontal Bar
# ──────────────────────────────────────────
def _build_supplier_otd_chart(df: pl.DataFrame, statuses: list[str]) -> go.Figure:
    """협력사별 납기준수율(=정상 비율) Horizontal Bar"""
    df_with_status = df.with_columns(pl.Series("_status", statuses))

    supplier_total = df_with_status.group_by("MFAC_COMPY_NM").agg(pl.len().alias("total"))
    supplier_good = (
        df_with_status
        .filter(pl.col("_status") == "good")
        .group_by("MFAC_COMPY_NM")
        .agg(pl.len().alias("good_cnt"))
    )

    merged = supplier_total.join(supplier_good, on="MFAC_COMPY_NM", how="left").with_columns(
        pl.col("good_cnt").fill_null(0)
    ).with_columns(
        (pl.col("good_cnt") / pl.col("total") * 100).round(1).alias("otd_rate")
    ).sort("otd_rate", descending=False)

    names = merged["MFAC_COMPY_NM"].to_list()
    rates = merged["otd_rate"].to_list()

    fig = go.Figure()
    fig.add_trace(go.Bar(
        y=names,
        x=rates,
        orientation="h",
        marker_color=[CHART_COLORS[i % len(CHART_COLORS)] for i in range(len(names))],
        text=[f"{r:.1f}%" for r in rates],
        textposition="outside",
        textfont=dict(size=12),
    ))

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="협력사별 납기준수율 (%)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="준수율 (%)", range=[0, 110], gridcolor=tc["gridcolor"], showgrid=True),
        yaxis=dict(autorange="reversed"),
        height=max(300, len(names) * 60 + 100),
        margin=dict(l=120, r=80, t=60, b=40),
    )
    return fig


# ──────────────────────────────────────────
# 납기일 기준 타임라인 차트 (향후 30일)
# ──────────────────────────────────────────
def _build_timeline_chart(df: pl.DataFrame, today: datetime.date) -> go.Figure:
    """향후 30일 입고 예정 scatter 차트"""
    future_limit = today + datetime.timedelta(days=30)
    records = df.to_dicts()

    dates, names, qtys, colors = [], [], [], []
    color_map = {"danger": "#EF4444", "warn": "#F59E0B", "good": "#16A34A"}

    for row in records:
        cnfm = row.get("INDC_DT_CNFM") or row.get("INDC_DT_REQ")
        try:
            cnfm_date = datetime.date.fromisoformat(str(cnfm))
        except (ValueError, TypeError):
            continue
        if cnfm_date < today - datetime.timedelta(days=7) or cnfm_date > future_limit:
            continue

        status = _calc_delivery_status(row, today)
        remaining = max(0, (row.get("ORD_QTY", 0) or 0) - (row.get("STOR_QTY", 0) or 0))
        dates.append(str(cnfm_date))
        names.append(f"{row['PO_NO']} {row['PRDT_NM']}")
        qtys.append(remaining)
        colors.append(color_map.get(status, "#16A34A"))

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=dates,
        y=qtys,
        mode="markers+text",
        marker=dict(size=[max(10, min(40, q / 100)) for q in qtys], color=colors, opacity=0.8),
        text=[n.split(" ")[0] for n in names],
        textposition="top center",
        textfont=dict(size=9),
        hovertext=names,
        hoverinfo="text+x+y",
    ))

    # 오늘 라인
    fig.add_vline(x=today.isoformat(), line_dash="dash", line_color="#6b7280", annotation_text="오늘")

    tc = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        title=dict(text="납기일 기준 입고 예정 타임라인 (향후 30일)", font=dict(size=16)),
        font=dict(family=tc["font_family"], color=tc["font_color"]),
        paper_bgcolor=tc["paper_bgcolor"],
        plot_bgcolor=tc["plot_bgcolor"],
        xaxis=dict(title="납기확정일", gridcolor=tc["gridcolor"], showgrid=True),
        yaxis=dict(title="잔여수량", gridcolor=tc["gridcolor"], showgrid=True),
        height=400,
        margin=dict(l=60, r=40, t=60, b=40),
    )
    return fig


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.1 납기 관리 페이지"""
    st.markdown("## 📅 납기 관리")
    st.markdown("---")

    # ── 1) 필터 ──
    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")

    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    st.caption(f"📌 {brand_name} | 시즌: {season}")

    # ── 2) 데이터 로드 ──
    df = _generate_sample_data()
    if df.height == 0:
        st.warning("조회된 데이터가 없습니다.")
        return

    today = datetime.date(2026, 4, 7)

    # ── 3) 상태 판정 ──
    records = df.to_dicts()
    statuses = [_calc_delivery_status(row, today) for row in records]

    danger_count = sum(1 for s in statuses if s == "danger")
    warn_count = sum(1 for s in statuses if s == "warn")
    good_count = sum(1 for s in statuses if s == "good")

    # OTD Rate: 완료(입고 >= 발주) 중 납기 내 입고 비율
    completed = [(r, s) for r, s in zip(records, statuses) if (r.get("STOR_QTY", 0) or 0) >= (r.get("ORD_QTY", 1) or 1)]
    on_time = sum(1 for _, s in completed if s != "danger")
    otd_rate = (on_time / len(completed) * 100) if completed else 0.0

    # 평균 리드타임 (요청일 ~ 확정일 차이)
    leadtimes = []
    for row in records:
        try:
            req = datetime.date.fromisoformat(str(row["INDC_DT_REQ"]))
            cnfm = datetime.date.fromisoformat(str(row["INDC_DT_CNFM"]))
            leadtimes.append(abs((cnfm - req).days))
        except (ValueError, TypeError):
            pass
    avg_leadtime = sum(leadtimes) / len(leadtimes) if leadtimes else 0

    # ── 4) KPI 카드 ──
    kpi_cols = st.columns(4)
    kpi_items = [
        ("⏱️ 납기준수율(OTD)", f"{otd_rate:.1f}%"),
        ("🟡 D-7 임박건수", f"{warn_count}건"),
        ("🔴 지연건수", f"{danger_count}건"),
        ("📅 평균 리드타임", f"{avg_leadtime:.1f}일"),
    ]
    for col, (label, value) in zip(kpi_cols, kpi_items):
        with col:
            st.metric(label=label, value=value)

    st.markdown("")

    # ── 5) 납기 현황 요약 카드 3개 ──
    st.markdown("### 납기 현황 요약")
    col_d, col_w, col_g = st.columns(3)

    danger_rows = [r for r, s in zip(records, statuses) if s == "danger"]
    warn_rows = [r for r, s in zip(records, statuses) if s == "warn"]

    with col_d:
        cfg = STATUS_COLORS["danger"]
        st.markdown(
            f"""
            <div style="background:{cfg['bg']}; border:1px solid {cfg['border']};
                        border-radius:8px; padding:16px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:{cfg['color']};">
                    {cfg['icon']} {danger_count}건
                </div>
                <div style="color:{cfg['color']}; font-size:14px;">납기 지연</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        if danger_rows:
            for r in danger_rows:
                st.markdown(f"- **{r['PO_NO']}** {r['PRDT_NM']} | 납기: {r.get('INDC_DT_CNFM', '-')} | {r['MFAC_COMPY_NM']}")

    with col_w:
        cfg = STATUS_COLORS["warn"]
        st.markdown(
            f"""
            <div style="background:{cfg['bg']}; border:1px solid {cfg['border']};
                        border-radius:8px; padding:16px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:{cfg['color']};">
                    {cfg['icon']} {warn_count}건
                </div>
                <div style="color:{cfg['color']}; font-size:14px;">D-7 임박</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        if warn_rows:
            for r in warn_rows:
                st.markdown(f"- **{r['PO_NO']}** {r['PRDT_NM']} | 납기: {r.get('INDC_DT_CNFM', '-')} | {r['MFAC_COMPY_NM']}")

    with col_g:
        cfg = STATUS_COLORS["good"]
        st.markdown(
            f"""
            <div style="background:{cfg['bg']}; border:1px solid {cfg['border']};
                        border-radius:8px; padding:16px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:{cfg['color']};">
                    {cfg['icon']} {good_count}건
                </div>
                <div style="color:{cfg['color']}; font-size:14px;">정상</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("---")

    # ── 6) 협력사별 납기준수율 차트 ──
    fig_otd = _build_supplier_otd_chart(df, statuses)
    st.plotly_chart(fig_otd, use_container_width=True)

    st.markdown("---")

    # ── 7) 납기일 기준 타임라인 차트 ──
    fig_timeline = _build_timeline_chart(df, today)
    st.plotly_chart(fig_timeline, use_container_width=True)

    st.markdown("---")

    # ── 8) 상세 테이블 ──
    st.markdown("### 📋 납기 상세")

    d_day_labels = []
    d_day_ints = []
    status_badges = []
    for row, status_key in zip(records, statuses):
        label, diff = _calc_d_day(row, today)
        d_day_labels.append(label)
        d_day_ints.append(diff if diff is not None else 9999)
        badge_cfg = STATUS_COLORS.get(status_key, STATUS_COLORS["good"])
        status_badges.append(f"{badge_cfg['icon']} {badge_cfg['label']}")

    display_df = df.select([
        "PO_NO", "PRDT_CD", "MFAC_COMPY_NM", "INDC_DT_REQ", "INDC_DT_CNFM",
    ]).with_columns([
        pl.Series("D-Day", d_day_labels),
        pl.Series("상태", status_badges),
    ])

    display_df = display_df.rename({
        "PO_NO": "PO번호",
        "PRDT_CD": "스타일",
        "MFAC_COMPY_NM": "협력사",
        "INDC_DT_REQ": "납기요청일",
        "INDC_DT_CNFM": "납기확정일",
    })

    st.dataframe(
        display_df.to_pandas(),
        use_container_width=True,
        height=min(600, 40 + display_df.height * 35),
    )
