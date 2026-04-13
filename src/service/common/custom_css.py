"""
DUVETICA 디자인 시스템 CSS — Streamlit 주입
Google Fonts + 사이드바 + KPI 카드 + 뱃지 + 테이블 + 버튼
"""

import streamlit as st


def inject_custom_css() -> None:
    """Streamlit 페이지에 커스텀 CSS를 주입한다."""
    css = """
    <style>
    /* ── Google Fonts ── */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    /* ── 전체 배경 ── */
    .stApp {
        background-color: #f9fafb;
        font-family: 'Noto Sans KR', sans-serif;
    }

    /* ── 상단 빈 공간 제거 ── */
    .stMainBlockContainer { padding-top: 1rem !important; }
    header[data-testid="stHeader"] { height: 0 !important; min-height: 0 !important; }
    #MainMenu, footer { display: none !important; }
    .block-container { padding-top: 1rem !important; padding-bottom: 1rem !important; }

    /* ── Streamlit 위젯 간격 축소 ── */
    .stSelectbox, .stMultiSelect { margin-bottom: 0 !important; }
    [data-testid="stExpander"] { margin-bottom: 0.25rem !important; }
    .stMarkdown hr { margin: 0.5rem 0 !important; }

    /* ── 사이드바: 다크 네이비 ── */
    [data-testid="stSidebar"] {
        background-color: #0f172a;
        color: #ffffff;
    }
    [data-testid="stSidebar"] * {
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] .stSelectbox label,
    [data-testid="stSidebar"] .stRadio label,
    [data-testid="stSidebar"] .stCheckbox label {
        color: #e2e8f0 !important;
    }
    [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] {
        background-color: #1e293b !important;
        border-color: #334155 !important;
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] * {
        color: #ffffff !important;
        background-color: transparent !important;
    }
    [data-testid="stSidebar"] .stSelectbox [data-baseweb="popover"] {
        background-color: #1e293b !important;
    }
    [data-testid="stSidebar"] .stSelectbox [data-baseweb="popover"] li {
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] .stSelectbox [data-baseweb="popover"] li:hover {
        background-color: #334155 !important;
    }
    /* 사이드바 expander 배경/텍스트 수정 */
    [data-testid="stSidebar"] [data-testid="stExpander"] {
        background-color: transparent !important;
        border: none !important;
    }
    [data-testid="stSidebar"] [data-testid="stExpander"] summary {
        background-color: transparent !important;
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] [data-testid="stExpander"] summary span,
    [data-testid="stSidebar"] [data-testid="stExpander"] summary p {
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] [data-testid="stExpander"] details {
        background-color: transparent !important;
        border: none !important;
    }
    [data-testid="stSidebar"] [data-testid="stExpander"] [data-testid="stExpanderDetails"] {
        background-color: transparent !important;
        border: none !important;
    }
    /* expander header 영역 전체 투명 */
    [data-testid="stSidebar"] details[data-testid="stExpander"] > summary {
        background-color: #1e293b !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
        margin-bottom: 4px !important;
    }
    [data-testid="stSidebar"] details[data-testid="stExpander"] > summary:hover {
        background-color: #334155 !important;
    }
    /* expander 내부 svg 아이콘 색상 */
    [data-testid="stSidebar"] [data-testid="stExpander"] svg {
        fill: #ffffff !important;
        color: #ffffff !important;
    }

    /* ── KPI 카드 ── */
    .kpi-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 16px 20px;
        transition: box-shadow 0.2s ease;
        min-height: 160px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .kpi-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .kpi-card.selected {
        border-color: #4f46e5;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    }

    .kpi-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;
    }

    .kpi-label {
        font-size: 12px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
    }

    .kpi-delta {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        font-weight: 600;
    }
    .kpi-delta.positive {
        color: #059669;
    }
    .kpi-delta.negative {
        color: #dc2626;
    }

    .kpi-prev {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 2px;
    }

    /* ── KPI 진행률 바 ── */
    .kpi-progress-bar {
        width: 100%;
        height: 6px;
        background-color: #e5e7eb;
        border-radius: 3px;
        overflow: hidden;
        margin-top: 8px;
    }
    .kpi-progress-bar .fill {
        height: 100%;
        background-color: #4f46e5;
        border-radius: 3px;
        transition: width 0.4s ease;
    }

    .kpi-progress-label {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 2px;
    }

    /* ── 뱃지 ── */
    .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.6;
    }
    .badge-success {
        background-color: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
    }
    .badge-warning {
        background-color: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
    }
    .badge-danger {
        background-color: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
    }
    .badge-info {
        background-color: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
    }

    /* ── 테이블 ── */
    .dataframe th {
        background-color: #f9fafb !important;
        font-weight: 600;
        font-size: 13px;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
    }
    .dataframe td {
        border-bottom: 1px solid #f3f4f6;
        font-size: 13px;
        color: #1f2937;
    }
    .dataframe tr:hover td {
        background-color: #f9fafb;
    }

    /* ── 타이포그래피 ── */
    h1 {
        font-size: 24px !important;
        font-weight: 700 !important;
        color: #111827 !important;
        font-family: 'Noto Sans KR', sans-serif !important;
    }
    h2 {
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #1f2937 !important;
        font-family: 'Noto Sans KR', sans-serif !important;
    }
    h3 {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #374151 !important;
        font-family: 'Noto Sans KR', sans-serif !important;
    }

    /* ── 버튼 ── */
    .stButton > button {
        background-color: #4f46e5;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        padding: 8px 20px;
        transition: background-color 0.2s ease;
    }
    .stButton > button:hover {
        background-color: #4338ca;
        color: #ffffff;
        border: none;
    }
    .stButton > button:active {
        background-color: #3730a3;
        color: #ffffff;
    }

    /* ── 브랜드 탭 ── */
    .brand-tab {
        display: inline-block;
        padding: 8px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
        border: 1px solid #e5e7eb;
        background-color: #ffffff;
        color: #6b7280;
    }
    .brand-tab.active {
        background-color: #4f46e5;
        color: #ffffff;
        border-color: #4f46e5;
    }
    .brand-tab:hover:not(.active) {
        background-color: #f3f4f6;
        color: #374151;
    }
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
