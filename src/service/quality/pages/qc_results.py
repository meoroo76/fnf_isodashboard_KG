"""
Cat.3 품질 - 품질검사 결과 (Google Sheets 입력 기반)
"""

import streamlit as st
import plotly.graph_objects as go
import polars as pl
from datetime import date, timedelta
import random

from src.core.config import (
    DEFECT_TYPE_COLORS,
    DEFECT_TYPE_ICONS,
    PLOTLY_TEMPLATE_CONFIG,
    GSHEET_SHEETS,
    get_status,
    calc_yoy,
    calc_delta,
)
from src.core.gsheet_client import get_gsheet_client
from src.service.common.components import (
    season_filter,
    render_kpi_cards,
    render_status_badge,
    format_number,
)


def _apply_plotly_template(fig: go.Figure) -> go.Figure:
    """Plotly 차트에 공통 테마 적용"""
    cfg = PLOTLY_TEMPLATE_CONFIG
    fig.update_layout(
        font_family=cfg["font_family"],
        font_color=cfg["font_color"],
        paper_bgcolor=cfg["paper_bgcolor"],
        plot_bgcolor=cfg["plot_bgcolor"],
        margin=dict(l=40, r=40, t=40, b=40),
    )
    fig.update_xaxes(gridcolor=cfg["gridcolor"], linecolor=cfg["linecolor"])
    fig.update_yaxes(gridcolor=cfg["gridcolor"], linecolor=cfg["linecolor"])
    return fig


# ──────────────────────────────────────────
# 샘플 검사 이력 데이터
# ──────────────────────────────────────────
_DEFECT_TYPES = list(DEFECT_TYPE_COLORS.keys())
_RESULTS = ["합격", "불합격", "조건부"]

random.seed(99)


def _generate_sample_qc(n: int = 10) -> pl.DataFrame:
    """샘플 검사 이력 10건"""
    styles = [
        "DV26S-JK01", "DV26S-CT01", "ST26S-TS01", "DV26S-VT01", "ST26S-JK01",
        "DV26S-JP01", "ST26S-PT01", "DV26S-PT01", "ST26S-PK01", "DV26S-JK02",
    ]
    inspectors = ["김검사", "이품질", "박관리", "최검수", "정평가"]
    rows = []
    base_date = date(2026, 1, 10)
    for i in range(n):
        insp_date = base_date + timedelta(days=random.randint(0, 150))
        total_qty = random.choice([100, 200, 300, 500])
        result = random.choices(_RESULTS, weights=[60, 20, 20], k=1)[0]
        defect_qty = 0 if result == "합격" else random.randint(1, int(total_qty * 0.1))
        defect_type = "" if result == "합격" else random.choice(_DEFECT_TYPES)
        rows.append({
            "PO": f"PO-2026-{1000 + i}",
            "스타일": styles[i % len(styles)],
            "검사일": insp_date.isoformat(),
            "결과": result,
            "불량유형": defect_type,
            "불량수량": defect_qty,
            "총검사수량": total_qty,
            "검사자": random.choice(inspectors),
            "메모": f"검사 메모 #{i + 1}",
        })
    return pl.DataFrame(rows).sort("검사일", descending=True)


def _load_qc_history() -> pl.DataFrame:
    """Google Sheets에서 검사 이력 로드, 없으면 샘플 데이터"""
    client = get_gsheet_client()
    sheet_name = GSHEET_SHEETS["qc_result"]
    df = client.read_sheet(sheet_name)
    if df.height == 0:
        return _generate_sample_qc(10)
    return df


def render():
    """품질검사 결과 페이지 렌더링"""
    st.header("🔍 품질검사 결과")

    # ── 브랜드/시즌 필터 ──
    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")

    # ── KPI 카드 ──
    fpy_curr = 94.2
    fpy_prev = 92.5
    aql_curr = 96.1
    aql_prev = 95.0
    dhu_curr = 3.8
    dhu_prev = 4.5

    kpi_data = [
        {"id": "fpy", "current": fpy_curr, "prev": fpy_prev},
        {"id": "aql_rate", "current": aql_curr, "prev": aql_prev},
        {"id": "dhu", "current": dhu_curr, "prev": dhu_prev},
    ]
    render_kpi_cards(kpi_data, "quality")

    # 상태 뱃지
    badge_cols = st.columns(3)
    for idx, (name, val, metric, rev) in enumerate([
        ("FPY", fpy_curr, "fpy", False),
        ("AQL", aql_curr, "aql", False),
        ("DHU", dhu_curr, "dhu", True),
    ]):
        status = get_status(val, metric, reverse=rev)
        with badge_cols[idx]:
            st.markdown(
                f"**{name}** {format_number(val, '%')}: {render_status_badge(status)}",
                unsafe_allow_html=True,
            )

    st.divider()

    # ── 검사 결과 입력 폼 ──
    st.subheader("📝 검사 결과 입력")

    with st.form("qc_input_form", clear_on_submit=True):
        form_cols = st.columns(3)
        with form_cols[0]:
            po_no = st.text_input("PO 번호", placeholder="PO-2026-XXXX")
            style = st.text_input("스타일", placeholder="DV26S-JK01")
            insp_date = st.date_input("검사일", value=date.today())
        with form_cols[1]:
            result = st.selectbox("결과", ["합격", "불합격", "조건부"])
            defect_type = st.selectbox(
                "불량유형",
                [""] + list(DEFECT_TYPE_COLORS.keys()),
                format_func=lambda x: f"{DEFECT_TYPE_ICONS.get(x, '')} {x}" if x else "선택안함",
            )
            defect_qty = st.number_input("불량수량", min_value=0, value=0)
        with form_cols[2]:
            total_qty = st.number_input("총검사수량", min_value=1, value=100)
            inspector = st.text_input("검사자", placeholder="이름")
            memo = st.text_area("메모", height=68)

        submitted = st.form_submit_button("💾 저장", use_container_width=True)

        if submitted:
            if not po_no or not style or not inspector:
                st.error("PO 번호, 스타일, 검사자는 필수 입력입니다.")
            else:
                new_row = pl.DataFrame([{
                    "PO": po_no,
                    "스타일": style,
                    "검사일": insp_date.isoformat(),
                    "결과": result,
                    "불량유형": defect_type,
                    "불량수량": defect_qty,
                    "총검사수량": total_qty,
                    "검사자": inspector,
                    "메모": memo,
                }])
                try:
                    client = get_gsheet_client()
                    sheet_name = GSHEET_SHEETS["qc_result"]
                    client.write_sheet(sheet_name, new_row, append=True)
                    st.success("검사 결과가 저장되었습니다.")
                    st.rerun()
                except Exception as e:
                    st.error(f"저장 실패: {e}")

    st.divider()

    # ── 검사 이력 테이블 ──
    st.subheader("📋 검사 이력")
    qc_df = _load_qc_history()

    if qc_df.height > 0:
        # 결과 아이콘 매핑
        result_icons = {"합격": "🟢 합격", "불합격": "🔴 불합격", "조건부": "🟡 조건부"}
        display_df = qc_df.clone()
        if "결과" in display_df.columns:
            display_df = display_df.with_columns(
                pl.col("결과").replace_strict(
                    result_icons,
                    default=pl.col("결과"),
                ).alias("결과상태"),
            )

        st.dataframe(display_df.to_pandas(), use_container_width=True, height=350)
    else:
        st.info("검사 이력이 없습니다.")

    st.divider()

    # ── 합격률 추이 Line 차트 (월별) ──
    st.subheader("📈 월별 합격률 추이")
    months = ["1월", "2월", "3월", "4월", "5월", "6월"]
    pass_rates = [92.0, 93.5, 94.0, 93.0, 95.2, 94.2]  # 당년
    pass_rates_prev = [90.0, 91.0, 92.5, 91.5, 93.0, 92.5]  # 전년

    fig_pass = go.Figure()
    fig_pass.add_trace(go.Scatter(
        x=months, y=pass_rates_prev,
        name="전년(25S)",
        mode="lines+markers",
        line=dict(color="#9ca3af", width=2, dash="dot"),
        marker=dict(size=6),
    ))
    fig_pass.add_trace(go.Scatter(
        x=months, y=pass_rates,
        name="당년(26S)",
        mode="lines+markers",
        line=dict(color="#4f46e5", width=3),
        marker=dict(size=8),
    ))
    # 목표선
    fig_pass.add_hline(
        y=95, line_dash="dash", line_color="#ef4444",
        annotation_text="목표 95%", annotation_position="top left",
    )
    fig_pass.update_layout(
        height=350,
        yaxis_title="합격률 (%)",
        yaxis_range=[85, 100],
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    fig_pass = _apply_plotly_template(fig_pass)
    st.plotly_chart(fig_pass, use_container_width=True)
