"""
Cat.4 정기 평가 입력
5대 항목 점수 입력, 자동 추천값, Composite Score 실시간 계산, 저장
"""

import datetime

import polars as pl
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    GRADE_MAP,
    GSHEET_SHEETS,
    PLOTLY_TEMPLATE_CONFIG,
    SUPPLIER_SCORE_COLORS,
    SUPPLIER_SCORE_ICONS,
    SUPPLIER_SCORE_WEIGHTS,
    get_supplier_grade,
)
from src.core.gsheet_client import get_gsheet_client
from src.service.common.components import (
    format_number,
)

# ──────────────────────────────────────────
# 샘플 데이터: 8개 협력사 자동 추천값 + 과거 평가 이력
# ──────────────────────────────────────────
_SUPPLIER_AUTO_SCORES = {
    "동진텍스타일": {"납기_추천": 92, "품질_추천": 88, "원가_추천": 85},
    "성원어패럴":   {"납기_추천": 87, "품질_추천": 91, "원가_추천": 78},
    "한세실업":     {"납기_추천": 95, "품질_추천": 93, "원가_추천": 82},
    "에스앤케이":   {"납기_추천": 78, "품질_추천": 72, "원가_추천": 90},
    "세아상역":     {"납기_추천": 82, "품질_추천": 85, "원가_추천": 88},
    "태광실업":     {"납기_추천": 90, "품질_추천": 86, "원가_추천": 75},
    "신성통상":     {"납기_추천": 68, "품질_추천": 74, "원가_추천": 82},
    "영원무역":     {"납기_추천": 96, "품질_추천": 94, "원가_추천": 80},
}

_SAMPLE_EVAL_HISTORY = [
    # 동진텍스타일
    {"협력사": "동진텍스타일", "평가일": "2025-04-15", "시즌": "25S", "납기": 88, "품질": 85, "원가": 83, "대응력": 87, "준법": 93, "종합": 86.4, "등급": "B"},
    {"협력사": "동진텍스타일", "평가일": "2025-10-20", "시즌": "25F", "납기": 90, "품질": 87, "원가": 84, "대응력": 89, "준법": 94, "종합": 88.1, "등급": "B"},
    {"협력사": "동진텍스타일", "평가일": "2026-04-01", "시즌": "26S", "납기": 92, "품질": 88, "원가": 85, "대응력": 90, "준법": 95, "종합": 89.7, "등급": "B"},
    # 성원어패럴
    {"협력사": "성원어패럴", "평가일": "2025-04-15", "시즌": "25S", "납기": 84, "품질": 88, "원가": 75, "대응력": 82, "준법": 90, "종합": 83.6, "등급": "B"},
    {"협력사": "성원어패럴", "평가일": "2025-10-20", "시즌": "25F", "납기": 86, "품질": 90, "원가": 76, "대응력": 84, "준법": 91, "종합": 85.2, "등급": "B"},
    {"협력사": "성원어패럴", "평가일": "2026-04-01", "시즌": "26S", "납기": 87, "품질": 91, "원가": 78, "대응력": 85, "준법": 92, "종합": 86.5, "등급": "B"},
    # 한세실업
    {"협력사": "한세실업", "평가일": "2025-04-15", "시즌": "25S", "납기": 93, "품질": 91, "원가": 80, "대응력": 86, "준법": 88, "종합": 89.0, "등급": "B"},
    {"협력사": "한세실업", "평가일": "2025-10-20", "시즌": "25F", "납기": 94, "품질": 92, "원가": 81, "대응력": 87, "준법": 89, "종합": 89.8, "등급": "B"},
    {"협력사": "한세실업", "평가일": "2026-04-01", "시즌": "26S", "납기": 95, "품질": 93, "원가": 82, "대응력": 88, "준법": 90, "종합": 91.1, "등급": "A"},
    # 에스앤케이
    {"협력사": "에스앤케이", "평가일": "2025-04-15", "시즌": "25S", "납기": 72, "품질": 68, "원가": 88, "대응력": 65, "준법": 85, "종합": 74.6, "등급": "C"},
    {"협력사": "에스앤케이", "평가일": "2025-10-20", "시즌": "25F", "납기": 75, "품질": 70, "원가": 89, "대응력": 68, "준법": 86, "종합": 76.5, "등급": "C"},
    {"협력사": "에스앤케이", "평가일": "2026-04-01", "시즌": "26S", "납기": 78, "품질": 72, "원가": 90, "대응력": 70, "준법": 88, "종합": 78.4, "등급": "C"},
    # 세아상역
    {"협력사": "세아상역", "평가일": "2025-04-15", "시즌": "25S", "납기": 80, "품질": 83, "원가": 86, "대응력": 78, "준법": 83, "종합": 82.2, "등급": "B"},
    {"협력사": "세아상역", "평가일": "2025-10-20", "시즌": "25F", "납기": 81, "품질": 84, "원가": 87, "대응력": 79, "준법": 84, "종합": 83.1, "등급": "B"},
    {"협력사": "세아상역", "평가일": "2026-04-01", "시즌": "26S", "납기": 82, "품질": 85, "원가": 88, "대응력": 80, "준법": 85, "종합": 84.0, "등급": "B"},
    # 태광실업
    {"협력사": "태광실업", "평가일": "2025-04-15", "시즌": "25S", "납기": 88, "품질": 84, "원가": 73, "대응력": 90, "준법": 92, "종합": 84.5, "등급": "B"},
    {"협력사": "태광실업", "평가일": "2025-10-20", "시즌": "25F", "납기": 89, "품질": 85, "원가": 74, "대응력": 91, "준법": 93, "종합": 85.4, "등급": "B"},
    {"협력사": "태광실업", "평가일": "2026-04-01", "시즌": "26S", "납기": 90, "품질": 86, "원가": 75, "대응력": 92, "준법": 94, "종합": 86.3, "등급": "B"},
    # 신성통상
    {"협력사": "신성통상", "평가일": "2025-04-15", "시즌": "25S", "납기": 62, "품질": 70, "원가": 80, "대응력": 60, "준법": 75, "종합": 68.1, "등급": "D"},
    {"협력사": "신성통상", "평가일": "2025-10-20", "시즌": "25F", "납기": 65, "품질": 72, "원가": 81, "대응력": 63, "준법": 76, "종합": 70.3, "등급": "C"},
    {"협력사": "신성통상", "평가일": "2026-04-01", "시즌": "26S", "납기": 68, "품질": 74, "원가": 82, "대응력": 65, "준법": 78, "종합": 72.5, "등급": "C"},
    # 영원무역
    {"협력사": "영원무역", "평가일": "2025-04-15", "시즌": "25S", "납기": 94, "품질": 92, "원가": 78, "대응력": 89, "준법": 94, "종합": 89.9, "등급": "B"},
    {"협력사": "영원무역", "평가일": "2025-10-20", "시즌": "25F", "납기": 95, "품질": 93, "원가": 79, "대응력": 90, "준법": 95, "종합": 90.8, "등급": "A"},
    {"협력사": "영원무역", "평가일": "2026-04-01", "시즌": "26S", "납기": 96, "품질": 94, "원가": 80, "대응력": 91, "준법": 96, "종합": 92.0, "등급": "A"},
]


# ──────────────────────────────────────────
# 메인 렌더
# ──────────────────────────────────────────
def render():
    """Cat.4 정기 평가 입력"""
    st.markdown("## 📝 정기 평가 입력")
    st.markdown("---")

    # 필터
    brd_cd = st.session_state.get("selected_brand", "V")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    supplier_names = list(_SUPPLIER_AUTO_SCORES.keys())
    col_supplier, col_spacer = st.columns([3, 7])
    with col_supplier:
        selected = st.selectbox("평가 대상 협력사", supplier_names, index=0, key="eval_supplier_sel")

    st.caption(f"📌 {brand_name} | 평가 대상: {selected}")

    auto = _SUPPLIER_AUTO_SCORES[selected]
    axes = list(SUPPLIER_SCORE_WEIGHTS.keys())

    # ── 가중치 표시 ──
    weight_html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">'
    for ax in axes:
        icon = SUPPLIER_SCORE_ICONS[ax]
        w = SUPPLIER_SCORE_WEIGHTS[ax]
        color = SUPPLIER_SCORE_COLORS[ax]
        weight_html += (
            f'<div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px; '
            f'padding:6px 12px; font-size:13px;">'
            f'{icon} {ax}: <b style="color:{color};">{w*100:.0f}%</b></div>'
        )
    weight_html += '</div>'
    st.markdown("**가중치 배분**")
    st.markdown(weight_html, unsafe_allow_html=True)

    st.markdown("---")

    # ── 점수 입력 슬라이더 ──
    st.markdown("### 점수 입력")

    scores = {}
    col1, col2 = st.columns(2)

    # 납기 (자동 추천)
    with col1:
        st.markdown(f"**{SUPPLIER_SCORE_ICONS['납기']} 납기** (OTD Rate 기반 추천: `{auto['납기_추천']}`)")
        scores["납기"] = st.slider(
            "납기 점수", 0, 100, auto["납기_추천"],
            key=f"eval_납기_{selected}",
            label_visibility="collapsed",
        )

    # 품질 (자동 추천)
    with col2:
        st.markdown(f"**{SUPPLIER_SCORE_ICONS['품질']} 품질** (FPY/Claim 기반 추천: `{auto['품질_추천']}`)")
        scores["품질"] = st.slider(
            "품질 점수", 0, 100, auto["품질_추천"],
            key=f"eval_품질_{selected}",
            label_visibility="collapsed",
        )

    col3, col4 = st.columns(2)

    # 원가 (자동 추천)
    with col3:
        st.markdown(f"**{SUPPLIER_SCORE_ICONS['원가']} 원가** (마크업 기반 추천: `{auto['원가_추천']}`)")
        scores["원가"] = st.slider(
            "원가 점수", 0, 100, auto["원가_추천"],
            key=f"eval_원가_{selected}",
            label_visibility="collapsed",
        )

    # 대응력 (수동)
    with col4:
        st.markdown(f"**{SUPPLIER_SCORE_ICONS['대응력']} 대응력** (수동 입력)")
        scores["대응력"] = st.slider(
            "대응력 점수", 0, 100, 80,
            key=f"eval_대응력_{selected}",
            label_visibility="collapsed",
        )

    col5, _ = st.columns(2)

    # 준법 (수동)
    with col5:
        st.markdown(f"**{SUPPLIER_SCORE_ICONS['준법']} 준법** (수동 입력)")
        scores["준법"] = st.slider(
            "준법 점수", 0, 100, 85,
            key=f"eval_준법_{selected}",
            label_visibility="collapsed",
        )

    # ── Composite Score 실시간 계산 ──
    composite = sum(scores[ax] * SUPPLIER_SCORE_WEIGHTS[ax] for ax in axes)
    grade_info = get_supplier_grade(composite)

    st.markdown("---")

    # 결과 표시
    result_html = f"""
    <div style="display:flex; align-items:center; gap:24px; padding:16px;
                background:linear-gradient(135deg, #f8fafc, #eef2ff);
                border:2px solid {grade_info['color']}; border-radius:12px;">
        <div style="text-align:center;">
            <div style="font-size:14px; color:#64748b;">Composite Score</div>
            <div style="font-size:36px; font-weight:800; color:{grade_info['color']};
                        font-family:'JetBrains Mono', monospace;">{composite:.1f}</div>
        </div>
        <div style="text-align:center;">
            <div style="font-size:14px; color:#64748b;">등급</div>
            <div style="font-size:36px; font-weight:800;">
                {grade_info['icon']} {grade_info['grade']}
            </div>
            <div style="font-size:13px; color:{grade_info['color']};">{grade_info['label']}</div>
        </div>
        <div style="flex:1;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
    """
    for ax in axes:
        icon = SUPPLIER_SCORE_ICONS[ax]
        color = SUPPLIER_SCORE_COLORS[ax]
        val = scores[ax]
        w = SUPPLIER_SCORE_WEIGHTS[ax]
        weighted = val * w
        result_html += (
            f'<div style="background:white; border:1px solid #e2e8f0; border-radius:6px; '
            f'padding:8px 12px; text-align:center; min-width:80px;">'
            f'<div style="font-size:11px; color:#64748b;">{icon} {ax}</div>'
            f'<div style="font-size:16px; font-weight:700; color:{color}; '
            f'font-family:JetBrains Mono, monospace;">{val}</div>'
            f'<div style="font-size:10px; color:#94a3b8;">x{w:.0%} = {weighted:.1f}</div>'
            f'</div>'
        )
    result_html += """
            </div>
        </div>
    </div>
    """
    st.markdown(result_html, unsafe_allow_html=True)

    st.markdown("")

    # ── 저장 버튼 ──
    if st.button("💾 평가 저장", key="save_eval", type="primary"):
        try:
            eval_row = {
                "협력사": selected,
                "평가일": datetime.datetime.now().strftime("%Y-%m-%d"),
                "시즌": "26S",
                "납기": scores["납기"],
                "품질": scores["품질"],
                "원가": scores["원가"],
                "대응력": scores["대응력"],
                "준법": scores["준법"],
                "종합": round(composite, 1),
                "등급": grade_info["grade"],
            }
            eval_df = pl.DataFrame([eval_row])
            client = get_gsheet_client()
            client.write_sheet(GSHEET_SHEETS["supplier_eval"], eval_df, append=True)
            st.success(f"평가가 저장되었습니다. ({selected}: {grade_info['icon']} {grade_info['grade']} / {composite:.1f}점)")
        except Exception as e:
            st.error(f"저장 실패: {e}")

    st.markdown("---")

    # ── 평가 이력 테이블 ──
    st.markdown("### 📚 평가 이력")

    # 선택된 협력사 이력 필터
    history = [h for h in _SAMPLE_EVAL_HISTORY if h["협력사"] == selected]

    # gsheet에서 추가 이력 로드 시도
    try:
        client = get_gsheet_client()
        saved_df = client.read_sheet(GSHEET_SHEETS["supplier_eval"])
        if saved_df.height > 0:
            saved_records = saved_df.filter(pl.col("협력사") == selected).to_dicts()
            # 샘플과 중복 제거 (평가일+시즌 기준)
            existing_keys = {(h["평가일"], h["시즌"]) for h in history}
            for r in saved_records:
                key = (r.get("평가일", ""), r.get("시즌", ""))
                if key not in existing_keys:
                    history.append(r)
    except Exception:
        pass

    if history:
        hist_df = pl.DataFrame(history)
        # 등급에 아이콘 추가
        if "등급" in hist_df.columns:
            hist_df = hist_df.with_columns(
                pl.col("등급").map_elements(
                    lambda g: f'{GRADE_MAP.get(g, {}).get("icon", "")} {g}',
                    return_dtype=pl.Utf8,
                ).alias("등급")
            )

        display_cols = ["협력사", "평가일", "시즌", "납기", "품질", "원가", "대응력", "준법", "종합", "등급"]
        display_cols = [c for c in display_cols if c in hist_df.columns]

        st.dataframe(
            hist_df.select(display_cols).to_pandas(),
            use_container_width=True,
            hide_index=True,
            height=min(400, 40 + len(history) * 35),
        )
    else:
        st.info("평가 이력이 없습니다.")
