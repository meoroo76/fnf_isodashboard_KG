"""
공통 Streamlit UI 컴포넌트
브랜드 필터 · 시즌 필터 · KPI 카드 · 상태 뱃지 · 숫자 포맷
"""

import streamlit as st
from src.core.config import (
    BRANDS,
    KPI_CARD_REGISTRY,
    KPI_MIN_CARDS,
    KPI_MAX_CARDS,
    STATUS_COLORS,
)


# ──────────────────────────────────────────
# 브랜드 필터
# ──────────────────────────────────────────
def brand_filter(brands_config: dict = BRANDS) -> str:
    """브랜드 탭을 렌더링하고 선택된 BRD_CD를 반환한다."""
    if "selected_brand" not in st.session_state:
        first_brand = next(iter(brands_config))
        st.session_state["selected_brand"] = brands_config[first_brand]["code"]

    cols = st.columns(len(brands_config))
    for idx, (name, info) in enumerate(brands_config.items()):
        with cols[idx]:
            is_active = st.session_state["selected_brand"] == info["code"]
            if st.button(
                f'{info["icon"]} {name}',
                key=f"brand_btn_{info['code']}",
                use_container_width=True,
                type="primary" if is_active else "secondary",
            ):
                st.session_state["selected_brand"] = info["code"]
                st.rerun()

    return st.session_state["selected_brand"]


# ──────────────────────────────────────────
# 시즌 필터
# ──────────────────────────────────────────
def season_filter(current: str, options: list[str] | None = None, key: str = "season_selectbox") -> str:
    """운용시즌 selectbox를 렌더링하고 선택된 SESN_RUNNING을 반환한다."""
    if options is None:
        options = [current]

    # session_state에 이전 값이 남아있고, 현재 options에 없는 경우 초기화
    if key in st.session_state and st.session_state[key] not in options:
        del st.session_state[key]

    idx = options.index(current) if current in options else 0
    selected = st.selectbox(
        "운용시즌",
        options=options,
        index=idx,
        key=key,
    )
    return selected


# ──────────────────────────────────────────
# 숫자 포맷
# ──────────────────────────────────────────
def format_number(value: float, unit: str) -> str:
    """값과 단위에 따라 표시 문자열을 반환한다."""
    if value is None:
        return "-"
    if unit == "억":
        return f"{value / 1e8:,.0f}억"
    if unit == "천":
        return f"{value / 1e3:,.0f}천"
    if unit == "%":
        return f"{value:.1f}%"
    if unit == "$":
        return f"${value:,.2f}"
    if unit == "x":
        return f"{value:.2f}x"
    if unit == "원":
        return f"{value:,.0f}원"
    if unit == "일":
        return f"{value:.0f}일"
    # 일반 (건, 개 등)
    return f"{value:,.0f}{unit}" if unit else f"{value:,.0f}"


# ──────────────────────────────────────────
# 상태 뱃지
# ──────────────────────────────────────────
_BADGE_CLASS_MAP = {
    "good": "badge-success",
    "warn": "badge-warning",
    "danger": "badge-danger",
}


def render_status_badge(status_dict_or_key) -> str:
    """상태 딕셔너리 또는 키 문자열("good"/"warn"/"danger")을 HTML 뱃지 문자열로 반환한다."""
    if isinstance(status_dict_or_key, str):
        status_dict = STATUS_COLORS.get(status_dict_or_key, STATUS_COLORS["good"])
    else:
        status_dict = status_dict_or_key

    badge_cls = "badge-info"
    for key, style in STATUS_COLORS.items():
        if style["label"] == status_dict.get("label"):
            badge_cls = _BADGE_CLASS_MAP.get(key, "badge-info")
            break

    icon = status_dict.get("icon", "")
    label = status_dict.get("label", "")
    return f'<span class="badge {badge_cls}">{icon} {label}</span>'


# ──────────────────────────────────────────
# KPI 카드
# ──────────────────────────────────────────
def _build_kpi_card_html(
    card_meta: dict,
    data: dict,
    is_selected: bool,
) -> str:
    """단일 KPI 카드의 HTML을 생성한다."""
    icon = card_meta.get("icon", "")
    label = card_meta.get("label", "")
    unit = card_meta.get("unit", "")

    current = data.get("current", 0)
    prev = data.get("prev", 0)
    progress = data.get("progress")
    progress_label = data.get("progress_label", "")

    # 포맷된 값
    formatted_current = format_number(current, unit)
    formatted_prev = format_number(prev, unit)

    # 증감
    if prev and prev != 0:
        delta = current - prev
        delta_pct = (delta / abs(prev)) * 100
        if delta >= 0:
            delta_class = "positive"
            delta_arrow = "▲"
        else:
            delta_class = "negative"
            delta_arrow = "▼"
        delta_html = (
            f'<div class="kpi-delta {delta_class}">'
            f"{delta_arrow} {abs(delta_pct):.1f}%"
            f"</div>"
        )
    else:
        delta_html = ""

    # 진행률 바
    progress_html = ""
    if progress is not None:
        fill = max(0, min(100, progress))
        progress_html = (
            f'<div class="kpi-progress-bar"><div class="fill" style="width:{fill}%"></div></div>'
            f'<div class="kpi-progress-label">{progress_label}</div>'
        )

    selected_cls = " selected" if is_selected else ""

    return f"""
    <div class="kpi-card{selected_cls}">
        <div class="kpi-label">{icon} {label}</div>
        <div class="kpi-value">{formatted_current}</div>
        <div class="kpi-prev">전년 {formatted_prev}</div>
        {delta_html}
        {progress_html}
    </div>
    """


def render_kpi_cards(cards_data: list[dict], category: str) -> None:
    """KPI 카드를 렌더링한다.

    Parameters
    ----------
    cards_data : list[dict]
        각 항목은 {"id", "current", "prev", "unit"(옵션), "progress"(옵션), "progress_label"(옵션)}
    category : str
        KPI_CARD_REGISTRY 키 (production, cost, quality, supplier)
    """
    registry = KPI_CARD_REGISTRY.get(category, [])
    if not registry:
        st.warning(f"KPI 카드 레지스트리에 '{category}' 카테고리가 없습니다.")
        return

    # 카드 메타 맵 (id -> meta)
    meta_map = {item["id"]: item for item in registry}

    # ── 세션 스테이트: 선택된 카드 ID 관리 ──
    state_key = f"kpi_selected_{category}"
    if state_key not in st.session_state:
        st.session_state[state_key] = [
            item["id"] for item in registry if item.get("default")
        ]

    selected_ids: list[str] = st.session_state[state_key]

    # ── KPI 카드 선택 (checkbox → session_state에서 직접 읽기) ──
    _popover_ctx = getattr(st, "popover", None)
    if _popover_ctx is None:
        _popover_ctx = st.expander
    with _popover_ctx("⚙️ KPI 카드 선택"):
        for item in registry:
            chk_key = f"kpi_chk_{category}_{item['id']}"
            # 초기값 설정 (최초 렌더링 시)
            if chk_key not in st.session_state:
                st.session_state[chk_key] = item["id"] in selected_ids
            st.checkbox(
                f'{item["icon"]} {item["label"]}',
                key=chk_key,
            )

    # checkbox session_state에서 현재 선택 상태 수집
    new_selected = [
        item["id"] for item in registry
        if st.session_state.get(f"kpi_chk_{category}_{item['id']}", False)
    ]
    if KPI_MIN_CARDS <= len(new_selected) <= KPI_MAX_CARDS:
        st.session_state[state_key] = new_selected
        selected_ids = new_selected

    # ── 데이터 맵 (id -> data) ──
    data_map = {d["id"]: d for d in cards_data}

    # ── 카드 렌더링 ──
    visible_ids = [sid for sid in selected_ids if sid in data_map]
    if not visible_ids:
        st.info("표시할 KPI 카드가 없습니다.")
        return

    cols = st.columns(len(visible_ids))
    for idx, card_id in enumerate(visible_ids):
        meta = meta_map.get(card_id, {})
        data = data_map[card_id]
        # 카드 메타의 unit 을 기본으로, 데이터가 override 가능
        if "unit" not in data:
            data["unit"] = meta.get("unit", "")
        html = _build_kpi_card_html(meta, data, is_selected=True)
        with cols[idx]:
            st.markdown(html, unsafe_allow_html=True)
