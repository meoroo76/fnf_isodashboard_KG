"""
ISO AI Agent - Streamlit 멀티페이지 메인 앱
프로젝트 루트에서 실행:
  PYTHONPATH=. .venv/Scripts/python -m streamlit run src/service/production_status/app.py
"""
import streamlit as st

st.set_page_config(page_title="ISO AI Agent", page_icon="🏭", layout="wide")

# ── CSS 주입 ──
try:
    from src.service.common.custom_css import inject_custom_css
    inject_custom_css()
except ImportError:
    pass

# ── Streamlit 자동 페이지 감지 비활성화 (pages/ 폴더 무시) ──
# hide default nav + pages sidebar
st.markdown(
    """<style>
    [data-testid="stSidebarNav"] { display: none !important; }
    section[data-testid="stSidebar"] > div:first-child { padding-top: 1rem; }
    </style>""",
    unsafe_allow_html=True,
)

from src.core.config import BRANDS

# ──────────────────────────────────────────
# 메뉴 구조
# ──────────────────────────────────────────
MENU = {
    "📊 생산": {
        "key": "production",
        "pages": [
            {"label": "오더 현황", "key": "order_dashboard"},
            {"label": "납기 관리", "key": "delivery_mgmt"},
            {"label": "데이터 입력", "key": "supplier_input"},
            {"label": "리포트", "key": "report_gen"},
        ],
    },
    "💰 원가": {
        "key": "cost",
        "pages": [
            {"label": "원가 총괄", "key": "cost_overview"},
            {"label": "원가 구성", "key": "cost_breakdown"},
            {"label": "마크업 분석", "key": "markup_analysis"},
            {"label": "시즌 비교", "key": "season_compare"},
        ],
    },
    "🔍 품질": {
        "key": "quality",
        "pages": [
            {"label": "클레임 현황", "key": "claim_dashboard"},
            {"label": "불량 분석", "key": "defect_analysis"},
            {"label": "검사 결과", "key": "qc_results"},
            {"label": "매장 VOC", "key": "voc_analysis"},
        ],
    },
    "🏭 협력사": {
        "key": "supplier",
        "pages": [
            {"label": "스코어카드", "key": "scorecard"},
            {"label": "랭킹", "key": "ranking"},
            {"label": "상세 분석", "key": "detail_panel"},
            {"label": "평가 입력", "key": "evaluation"},
        ],
    },
}

# ──────────────────────────────────────────
# 세션 상태 초기화
# ──────────────────────────────────────────
from src.core.config import CURRENT_SEASON, get_prev_season, BRAND_CODE_MAP

if "current_page" not in st.session_state:
    st.session_state.current_page = "order_dashboard"
if "selected_brand" not in st.session_state:
    first_brand = next(iter(BRANDS))
    st.session_state["selected_brand"] = BRANDS[first_brand]["code"]
if "global_season" not in st.session_state:
    st.session_state["global_season"] = CURRENT_SEASON

SEASON_OPTIONS = ["26F", CURRENT_SEASON, "25F", "25S", "24F"]
SEASON_SEL_KEY = "global_season_sel"
if SEASON_SEL_KEY in st.session_state and st.session_state[SEASON_SEL_KEY] not in SEASON_OPTIONS:
    del st.session_state[SEASON_SEL_KEY]

# ──────────────────────────────────────────
# 사이드바: 브랜드 선택 + 네비게이션
# ──────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🏭 ISO AI Agent")

    # ── 브랜드 선택 (사이드바 상단) ──
    st.markdown("#### 브랜드")
    for name, info in BRANDS.items():
        is_active = st.session_state["selected_brand"] == info["code"]
        if st.button(
            f'{info["icon"]} {name}',
            key=f"sidebar_brand_{info['code']}",
            use_container_width=True,
            type="primary" if is_active else "secondary",
        ):
            st.session_state["selected_brand"] = info["code"]
            st.rerun()

    # ── 운용시즌 선택 (사이드바) ──
    st.markdown("#### 운용시즌")
    st.session_state["global_season"] = st.selectbox(
        "시즌", SEASON_OPTIONS, index=0, key=SEASON_SEL_KEY, label_visibility="collapsed"
    )

    st.markdown("---")

    # ── 카테고리 메뉴 ──
    for category_label, category_info in MENU.items():
        with st.expander(category_label, expanded=(category_info["key"] == "production")):
            for page in category_info["pages"]:
                is_active = st.session_state.current_page == page["key"]
                btn_type = "primary" if is_active else "secondary"
                if st.button(
                    page["label"],
                    key=f"nav_{page['key']}",
                    use_container_width=True,
                    type=btn_type,
                ):
                    st.session_state.current_page = page["key"]
                    st.rerun()

    st.markdown("---")
    st.caption("v0.1.0 | F&F ISO AI Agent")

# ──────────────────────────────────────────
# 글로벌 탑바 (컴팩트 한 줄)
# ──────────────────────────────────────────
brand_name = next((k for k, v in BRANDS.items() if v["code"] == st.session_state["selected_brand"]), "DUVETICA")
brand_info = BRANDS.get(brand_name, list(BRANDS.values())[0])

# 히어로 바 (풀폭, 확장)
selected_season = st.session_state.get("global_season", CURRENT_SEASON)
st.markdown(f"""
<div style="
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 12px;
    display: flex; align-items: center; justify-content: space-between;
    position: relative; overflow: hidden;
">
    <div style="display: flex; align-items: center; gap: 16px;">
        <div style="
            width: 48px; height: 48px;
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px;
        ">🏭</div>
        <div>
            <div style="font-size: 11px; font-weight: 700; color: #818cf8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">ISO AI AGENT</div>
            <div style="font-size: 20px; font-weight: 700; color: #ffffff;">{brand_info['icon']} {brand_name} SCM Dashboard</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Season {selected_season} | Sourcing & Production Management</div>
        </div>
    </div>
    <div style="display: flex; gap: 24px; align-items: center;">
        <div style="display: flex; gap: 24px;">
            <div style="text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: #a5b4fc; font-family: 'JetBrains Mono', monospace;">16</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Pages</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: #a5b4fc; font-family: 'JetBrains Mono', monospace;">13</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">APIs</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 20px; font-weight: 700; color: #a5b4fc; font-family: 'JetBrains Mono', monospace;">27</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">KPIs</div>
            </div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ──────────────────────────────────────────
# 페이지 라우팅
# ──────────────────────────────────────────
page = st.session_state.current_page

# 직접 import로 페이지 로딩 (importlib 캐시 문제 회피)
from src.service.production_status.pages import order_dashboard, delivery_mgmt, supplier_input, report_gen
from src.service.cost_management.pages import cost_overview, cost_breakdown, markup_analysis, season_compare
from src.service.quality.pages import claim_dashboard, defect_analysis, qc_results, voc_analysis
from src.service.supplier.pages import scorecard, ranking, detail_panel, evaluation

PAGE_RENDERS = {
    "order_dashboard": order_dashboard.render,
    "delivery_mgmt":   delivery_mgmt.render,
    "supplier_input":  supplier_input.render,
    "report_gen":      report_gen.render,
    "cost_overview":   cost_overview.render,
    "cost_breakdown":  cost_breakdown.render,
    "markup_analysis": markup_analysis.render,
    "season_compare":  season_compare.render,
    "claim_dashboard": claim_dashboard.render,
    "defect_analysis": defect_analysis.render,
    "qc_results":      qc_results.render,
    "voc_analysis":    voc_analysis.render,
    "scorecard":       scorecard.render,
    "ranking":         ranking.render,
    "detail_panel":    detail_panel.render,
    "evaluation":      evaluation.render,
}

if page in PAGE_RENDERS:
    try:
        PAGE_RENDERS[page]()
    except Exception as e:
        st.error(f"페이지 로딩 오류: {e}")
        import traceback
        st.code(traceback.format_exc())
else:
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown(
            """
            <div style="text-align: center; padding: 80px 20px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🚧</div>
                <h2 style="color: #6b7280; margin-bottom: 8px;">준비 중</h2>
                <p style="color: #9ca3af;">이 페이지는 현재 개발 중입니다.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
