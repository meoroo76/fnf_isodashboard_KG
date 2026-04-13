"""
ISO AI Agent - 전역 설정
브랜드/시즌/KPI/색상/임계값/원가 계산식 등
"""

# ──────────────────────────────────────────
# 브랜드
# ──────────────────────────────────────────
BRANDS = {
    "DUVETICA": {"code": "V", "icon": "🦆", "color": "#4f46e5"},
    "SERGIO TACCHINI": {"code": "ST", "icon": "🎾", "color": "#7c3aed"},
}

BRAND_CODE_MAP = {v["code"]: k for k, v in BRANDS.items()}

# ──────────────────────────────────────────
# 시즌
# ──────────────────────────────────────────
def get_prev_season(season: str) -> str:
    """26S -> 25S, 26F -> 25F"""
    year = int(season[:2])
    suffix = season[2:]
    return f"{year - 1:02d}{suffix}"

CURRENT_SEASON = "26S"
PREV_SEASON = get_prev_season(CURRENT_SEASON)

# ──────────────────────────────────────────
# KPI 카드 레지스트리 (동적 3~5개)
# ──────────────────────────────────────────
KPI_MIN_CARDS = 3
KPI_MAX_CARDS = 5

KPI_CARD_REGISTRY = {
    # === Cat.1 생산진행 ===
    "production": [
        {"id": "ord_amt",      "label": "발주액",      "icon": "📦", "unit": "억",  "default": True},
        {"id": "ord_qty",      "label": "발주수량",     "icon": "📊", "unit": "천",  "default": True},
        {"id": "sku_count",    "label": "SKU수",       "icon": "🏷️", "unit": "건",  "default": True},
        {"id": "otd_rate",     "label": "납기준수율",   "icon": "⏱️", "unit": "%",   "default": False},
        {"id": "fulfill_rate", "label": "선적이행률",   "icon": "🚢", "unit": "%",   "default": False},
        {"id": "style_count",  "label": "스타일수",     "icon": "👗", "unit": "건",  "default": False},
        {"id": "avg_leadtime", "label": "평균리드타임",  "icon": "📅", "unit": "일",  "default": False},
    ],
    # === Cat.2 원가관리 ===
    "cost": [
        {"id": "cost_rate",    "label": "전체원가율(USD)", "icon": "📈", "unit": "%",  "default": True},
        {"id": "ord_qty",      "label": "총발주수량",      "icon": "📊", "unit": "천", "default": True},
        {"id": "avg_tag",      "label": "평균TAG(KRW)",   "icon": "🏷️", "unit": "원", "default": True},
        {"id": "avg_cost",     "label": "평균원가(USD)",   "icon": "💵", "unit": "$",  "default": False},
        {"id": "markup",       "label": "M/U",            "icon": "📐", "unit": "x",  "default": False},
        {"id": "exchange",     "label": "환율",            "icon": "💱", "unit": "",   "default": False},
        {"id": "nego_rate",    "label": "네고절감율",       "icon": "🤝", "unit": "%",  "default": False},
    ],
    # === Cat.3 품질 ===
    "quality": [
        {"id": "claim_count",  "label": "클레임건수",   "icon": "🔔", "unit": "건",  "default": True},
        {"id": "claim_rate",   "label": "클레임율",     "icon": "📉", "unit": "%",   "default": True},
        {"id": "fpy",          "label": "FPY합격률",    "icon": "✅", "unit": "%",   "default": True},
        {"id": "aql_rate",     "label": "AQL합격률",    "icon": "🔍", "unit": "%",   "default": False},
        {"id": "dhu",          "label": "DHU",          "icon": "📋", "unit": "점",  "default": False},
        {"id": "return_rate",  "label": "반품율",       "icon": "↩️",  "unit": "%",  "default": False},
        {"id": "pending_cnt",  "label": "미조치건수",    "icon": "⚠️", "unit": "건",  "default": False},
    ],
    # === Cat.4 협력사 ===
    "supplier": [
        {"id": "active_cnt",   "label": "활성협력사",    "icon": "🏭", "unit": "개",  "default": True},
        {"id": "avg_otd",      "label": "평균OTD",      "icon": "⏱️", "unit": "%",   "default": True},
        {"id": "avg_claim",    "label": "평균클레임율",   "icon": "📉", "unit": "%",   "default": True},
        {"id": "avg_fulfill",  "label": "평균이행률",     "icon": "🚢", "unit": "%",   "default": False},
        {"id": "grade_dist",   "label": "종합등급",      "icon": "🏆", "unit": "",    "default": False},
        {"id": "avg_leadtime", "label": "평균리드타임",   "icon": "📅", "unit": "일",  "default": False},
        {"id": "a_grade_cnt",  "label": "A등급협력사",   "icon": "🟢", "unit": "개",  "default": False},
    ],
}

# ──────────────────────────────────────────
# 색상
# ──────────────────────────────────────────
CHART_COLORS = [
    '#4f46e5', '#7c3aed', '#2563eb', '#059669',
    '#d97706', '#dc2626', '#8b5cf6', '#0891b2',
    '#65a30d', '#be185d',
]

COMPARE_COLORS = {
    "prev_season": "#9ca3af",
    "curr_season": "#4f46e5",
    "next_season": "#9333ea",
}

CATEGORY_COLORS = {
    "OUTER": "#3b82f6", "INNER": "#10b981", "BOTTOM": "#f59e0b",
    "ACC_ETC": "#ef4444", "WEAR_ETC": "#f97316", "SHOES": "#8b5cf6",
    "BAG": "#06b6d4", "HEADWEAR": "#ec4899",
}

COST_ITEM_COLORS = {
    "원부자재": "#3b82f6", "아트웍": "#8b5cf6", "공임": "#f59e0b",
    "정상마진": "#10b981", "경비": "#6b7280", "본사공급": "#06b6d4",
}

COST_ITEM_ICONS = {
    "원부자재": "📦", "아트웍": "🎨", "공임": "👷",
    "정상마진": "💰", "경비": "📊",
}

DEFECT_TYPE_COLORS = {
    "봉제불량": "#ef4444", "원단불량": "#3b82f6", "부자재불량": "#f59e0b",
    "재단불량": "#8b5cf6", "기타불량": "#6b7280",
}

DEFECT_TYPE_ICONS = {
    "봉제불량": "🧵", "원단불량": "🧶", "부자재불량": "🔩",
    "재단불량": "✂️", "기타불량": "📐",
}

SUPPLIER_SCORE_COLORS = {
    "납기": "#3b82f6", "품질": "#10b981", "원가": "#f59e0b",
    "대응력": "#8b5cf6", "준법": "#6b7280",
}

SUPPLIER_SCORE_ICONS = {
    "납기": "⏱️", "품질": "🔍", "원가": "💰", "대응력": "💬", "준법": "📋",
}

SUPPLIER_SCORE_WEIGHTS = {
    "납기": 0.30, "품질": 0.30, "원가": 0.20, "대응력": 0.10, "준법": 0.10,
}

# ──────────────────────────────────────────
# 상태 판정 임계값
# ──────────────────────────────────────────
STATUS_THRESHOLDS = {
    "markup":       {"good": 0,    "warn": -0.5},   # delta 기준
    "otd":          {"good": 95,   "warn": 85},      # % 기준
    "claim_rate":   {"good": 1,    "warn": 2},       # % (역방향: 낮을수록 좋음)
    "fpy":          {"good": 95,   "warn": 90},
    "aql":          {"good": 95,   "warn": 90},
    "dhu":          {"good": 3,    "warn": 5},       # 역방향
    "fulfill":      {"good": 95,   "warn": 85},
}

STATUS_COLORS = {
    "good":    {"label": "양호", "icon": "🟢", "color": "#16A34A", "bg": "#ecfdf5", "border": "#a7f3d0"},
    "warn":    {"label": "주의", "icon": "🟡", "color": "#F59E0B", "bg": "#fffbeb", "border": "#fde68a"},
    "danger":  {"label": "위험", "icon": "🔴", "color": "#EF4444", "bg": "#fef2f2", "border": "#fecaca"},
}

GRADE_MAP = {
    "A": {"min": 90, "icon": "🟢", "color": "#16A34A", "label": "우수"},
    "B": {"min": 80, "icon": "🟡", "color": "#F59E0B", "label": "양호"},
    "C": {"min": 70, "icon": "🟠", "color": "#f97316", "label": "보통"},
    "D": {"min": 0,  "icon": "🔴", "color": "#EF4444", "label": "개선필요"},
}


def get_status(value: float, metric: str, reverse: bool = False) -> dict:
    """값과 메트릭 기준으로 상태 판정 (양호/주의/위험)"""
    th = STATUS_THRESHOLDS.get(metric)
    if th is None:
        return STATUS_COLORS["good"]
    if reverse:  # 낮을수록 좋은 지표 (claim_rate, dhu)
        if value <= th["good"]:
            return STATUS_COLORS["good"]
        elif value <= th["warn"]:
            return STATUS_COLORS["warn"]
        else:
            return STATUS_COLORS["danger"]
    else:
        if value >= th["good"]:
            return STATUS_COLORS["good"]
        elif value >= th["warn"]:
            return STATUS_COLORS["warn"]
        else:
            return STATUS_COLORS["danger"]


def get_markup_verdict(delta: float, threshold: float = 0.5) -> dict:
    """마크업 전년 대비 상태 판정"""
    if delta >= 0:
        return STATUS_COLORS["good"]
    elif abs(delta) < threshold:
        return STATUS_COLORS["warn"]
    else:
        return STATUS_COLORS["danger"]


def get_supplier_grade(score: float) -> dict:
    """협력사 종합 등급 판정"""
    for grade, info in GRADE_MAP.items():
        if score >= info["min"]:
            return {"grade": grade, **info}
    return {"grade": "D", **GRADE_MAP["D"]}


# ──────────────────────────────────────────
# 원가 계산식
# ──────────────────────────────────────────
def calc_cost_rate(avg_cost_usd: float, avg_tag_krw: float, exchange_rate: float) -> float:
    """원가율 (VAT 제외 기준) — F&F 표준"""
    if avg_tag_krw == 0 or exchange_rate == 0:
        return 0.0
    return (avg_cost_usd / (avg_tag_krw / 1.1 / exchange_rate)) * 100


def calc_markup(avg_tag_krw: float, avg_cost_usd: float, exchange_rate: float) -> float:
    """마크업 배율"""
    cost_krw = avg_cost_usd * exchange_rate
    if cost_krw == 0:
        return 0.0
    return avg_tag_krw / cost_krw


def calc_yoy(curr: float, prev: float) -> float:
    """전년 대비 증감률 (%)"""
    if prev == 0:
        return 0.0
    return (curr / prev - 1) * 100


def calc_delta(curr: float, prev: float) -> float:
    """전년 대비 차이 (%p 또는 절대값)"""
    return curr - prev


# ──────────────────────────────────────────
# Plotly 테마
# ──────────────────────────────────────────
PLOTLY_TEMPLATE_CONFIG = {
    "font_family": "Noto Sans KR, sans-serif",
    "font_color": "#1f2937",
    "paper_bgcolor": "#ffffff",
    "plot_bgcolor": "#ffffff",
    "colorway": CHART_COLORS,
    "gridcolor": "#f3f4f6",
    "linecolor": "#e5e7eb",
}

# ──────────────────────────────────────────
# Google Sheets 시트명
# ──────────────────────────────────────────
GSHEET_SHEETS = {
    "production_input":   "생산진행입력",
    "delivery_adj":       "납기조정이력",
    "target_cost":        "목표원가",
    "cost_adj_memo":      "원가조정메모",
    "exchange_rate":      "환율설정",
    "qc_result":          "품질검사결과",
    "defect_master":      "불량유형마스터",
    "quality_target":     "품질목표",
    "supplier_master":    "협력사마스터",
    "supplier_eval":      "협력사평가",
    "supplier_memo":      "협력사메모",
}
