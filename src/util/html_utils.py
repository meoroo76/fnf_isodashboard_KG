"""HTML 리포트 유틸리티 — White Minimal 테마 기반 HTML/CSS/Chart.js 헬퍼"""

from __future__ import annotations

import html
import json
from pathlib import Path


# ── 색상 상수 (pptx_utils.py THEME_LIGHT 동기화) ─────────────
HTML_COLORS = {
    "bg": "#FAFAFC",
    "primary": "#006AE6",
    "accent": "#FFA000",
    "positive": "#00B894",
    "negative": "#FF6352",
    "purple": "#6C5CE7",
    "teal": "#009688",
    "card": "#F0F2F5",
    "card_blue": "#E3F0FF",
    "card_green": "#E3F8F0",
    "card_orange": "#FFF3E0",
    "text": "#2D2D2D",
    "text_sub": "#8A8A9A",
    "divider": "#C0C4CC",
    "divider_light": "#E8EAEE",
    "table_header": "#006AE6",
    "table_row1": "#FFFFFF",
    "table_row2": "#F0F2F5",
    "white": "#FFFFFF",
}

CHART_COLORS = [
    "#006AE6", "#00B894", "#FFA000", "#6C5CE7",
    "#009688", "#FF6352", "#4BACC6", "#F79646",
]


# ── CSS ──────────────────────────────────────────────────────

def get_white_minimal_css() -> str:
    """White Minimal 테마 CSS 문자열 반환."""
    c = HTML_COLORS
    return f"""
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        font-family: 'Malgun Gothic', Arial, sans-serif;
        background: {c['bg']};
        color: {c['text']};
        line-height: 1.6;
        padding: 0;
    }}
    .report-container {{
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 32px;
        position: relative;
    }}
    .report-container::before {{
        content: '';
        position: fixed;
        left: 0; top: 0;
        width: 6px; height: 100%;
        background: {c['primary']};
        z-index: 100;
    }}
    .hero {{
        padding: 48px 0 32px;
        border-bottom: 1px solid {c['divider_light']};
        margin-bottom: 32px;
    }}
    .hero .brand {{
        font-size: 13px; font-weight: 700;
        color: {c['text_sub']}; letter-spacing: 1px;
        margin-bottom: 8px;
    }}
    .hero h1 {{
        font-size: 32px; font-weight: 700;
        color: {c['text']}; margin-bottom: 8px;
    }}
    .hero .subtitle {{
        font-size: 14px; color: {c['text_sub']};
    }}
    .hero .key-metrics {{
        float: right; background: {c['card_blue']};
        border-radius: 8px; padding: 16px 20px;
        margin-top: -80px; min-width: 280px;
    }}
    .hero .key-metrics h4 {{
        font-size: 11px; font-weight: 700;
        color: {c['primary']}; margin-bottom: 6px;
    }}
    .hero .key-metrics p {{
        font-size: 12px; color: {c['text']};
        margin: 2px 0; line-height: 1.5;
    }}
    .section {{
        margin-bottom: 40px;
    }}
    .section-header {{
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid {c['divider_light']};
    }}
    .section-header h2 {{
        font-size: 22px; font-weight: 700;
        color: {c['text']}; margin-bottom: 4px;
    }}
    .section-header .sub {{
        font-size: 12px; color: {c['text_sub']};
    }}
    .kpi-row {{
        display: flex; gap: 16px;
        margin-bottom: 24px; flex-wrap: wrap;
    }}
    .kpi-card {{
        flex: 1; min-width: 200px;
        border-radius: 10px; padding: 18px 20px;
        position: relative;
    }}
    .kpi-card .accent-bar {{
        position: absolute; top: 10px; left: 16px;
        width: 40px; height: 4px; border-radius: 2px;
    }}
    .kpi-card .label {{
        font-size: 11px; color: {c['text_sub']};
        margin-top: 14px; margin-bottom: 4px;
    }}
    .kpi-card .value {{
        font-size: 26px; font-weight: 700;
        color: {c['text']}; margin-bottom: 4px;
    }}
    .kpi-card .sub-text {{
        font-size: 11px; font-weight: 600;
    }}
    .styled-table {{
        width: 100%; border-collapse: collapse;
        font-size: 13px; border-radius: 8px;
        overflow: hidden;
    }}
    .styled-table thead th {{
        background: {c['table_header']};
        color: {c['white']}; padding: 10px 14px;
        text-align: center; font-weight: 600;
        font-size: 12px;
    }}
    .styled-table thead th:first-child {{ text-align: left; }}
    .styled-table tbody td {{
        padding: 8px 14px; text-align: center;
        border-bottom: 1px solid {c['divider_light']};
    }}
    .styled-table tbody td:first-child {{ text-align: left; font-weight: 500; }}
    .styled-table tbody tr:nth-child(odd) {{ background: {c['table_row1']}; }}
    .styled-table tbody tr:nth-child(even) {{ background: {c['table_row2']}; }}
    .styled-table tbody tr:hover {{ background: {c['card_blue']}; }}
    .chart-container {{
        background: {c['white']};
        border-radius: 10px; padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }}
    .flex-row {{
        display: flex; gap: 24px; align-items: flex-start;
        flex-wrap: wrap;
    }}
    .flex-row .chart-col {{ flex: 3; min-width: 400px; }}
    .flex-row .table-col {{ flex: 2; min-width: 280px; }}
    .insight-box {{
        border-radius: 10px; padding: 20px 24px;
        position: relative; margin-bottom: 16px;
    }}
    .insight-box::before {{
        content: '';
        position: absolute; left: 0; top: 0;
        width: 5px; height: 100%;
        border-radius: 10px 0 0 10px;
    }}
    .insight-box.positive {{ background: {c['card_green']}; }}
    .insight-box.positive::before {{ background: {c['positive']}; }}
    .insight-box.watch {{ background: {c['card_orange']}; }}
    .insight-box.watch::before {{ background: {c['negative']}; }}
    .insight-box h3 {{
        font-size: 14px; font-weight: 700;
        margin-bottom: 10px;
    }}
    .insight-box.positive h3 {{ color: {c['positive']}; }}
    .insight-box.watch h3 {{ color: {c['negative']}; }}
    .insight-box ul {{
        list-style: none; padding: 0;
    }}
    .insight-box ul li {{
        font-size: 13px; color: {c['text']};
        padding: 4px 0; padding-left: 16px;
        position: relative;
    }}
    .insight-box ul li::before {{
        content: '\\2022';
        position: absolute; left: 0;
        font-weight: 700;
    }}
    .insight-box.positive ul li::before {{ color: {c['positive']}; }}
    .insight-box.watch ul li::before {{ color: {c['negative']}; }}
    .footer {{
        text-align: center; padding: 24px 0;
        font-size: 11px; color: {c['text_sub']};
        border-top: 1px solid {c['divider_light']};
        margin-top: 40px;
    }}
    .product-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 16px;
    }}
    .product-card {{
        background: {c['white']};
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        transition: transform 0.15s, box-shadow 0.15s;
        position: relative;
    }}
    .product-card:hover {{
        transform: translateY(-4px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }}
    .product-card .rank-badge {{
        position: absolute; top: 10px; left: 10px;
        width: 30px; height: 30px;
        border-radius: 50%;
        background: {c['primary']};
        color: {c['white']};
        font-size: 13px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        z-index: 2;
    }}
    .product-card .rank-badge.top3 {{
        background: {c['accent']};
        width: 34px; height: 34px;
        font-size: 15px;
    }}
    .product-card .img-wrap {{
        width: 100%; aspect-ratio: 1;
        background: {c['card']};
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
    }}
    .product-card .img-wrap img {{
        width: 85%; height: 85%;
        object-fit: contain;
    }}
    .product-card .info {{
        padding: 12px 14px;
    }}
    .product-card .category-tag {{
        display: inline-block;
        font-size: 10px; font-weight: 600;
        color: {c['primary']};
        background: {c['card_blue']};
        border-radius: 4px;
        padding: 2px 8px;
        margin-bottom: 6px;
    }}
    .product-card .prdt-name {{
        font-size: 13px; font-weight: 600;
        color: {c['text']};
        line-height: 1.4;
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }}
    .product-card .prdt-code {{
        font-size: 10px; color: {c['text_sub']};
        margin-bottom: 8px;
    }}
    .product-card .metrics {{
        display: flex; justify-content: space-between;
        border-top: 1px solid {c['divider_light']};
        padding-top: 8px; margin-top: 4px;
    }}
    .product-card .metric {{
        text-align: center; flex: 1;
    }}
    .product-card .metric .m-label {{
        font-size: 9px; color: {c['text_sub']};
        margin-bottom: 2px;
    }}
    .product-card .metric .m-value {{
        font-size: 12px; font-weight: 700;
        color: {c['text']};
    }}
    .product-card .price-tag {{
        font-size: 14px; font-weight: 700;
        color: {c['text']}; margin-bottom: 2px;
    }}
    @media (max-width: 768px) {{
        .hero .key-metrics {{ float: none; margin-top: 16px; }}
        .flex-row {{ flex-direction: column; }}
        .kpi-card {{ min-width: 140px; }}
        .product-grid {{ grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }}
    }}
    """


# ── 컴포넌트 렌더 함수 ───────────────────────────────────────

def render_kpi_card(
    label: str, value: str, sub_text: str,
    accent_color: str = HTML_COLORS["primary"],
    bg_color: str = HTML_COLORS["card_blue"],
    sub_color: str | None = None,
) -> str:
    """KPI 카드 HTML 반환."""
    sc = sub_color or accent_color
    return f"""
    <div class="kpi-card" style="background:{bg_color}">
        <div class="accent-bar" style="background:{accent_color}"></div>
        <div class="label">{html.escape(str(label))}</div>
        <div class="value">{html.escape(str(value))}</div>
        <div class="sub-text" style="color:{sc}">{html.escape(str(sub_text))}</div>
    </div>"""


def render_table(data: list[list[str]]) -> str:
    """스타일 테이블 HTML. data[0]은 헤더."""
    if not data:
        return ""
    headers = data[0]
    rows = data[1:]
    ths = "".join(f"<th>{html.escape(str(h))}</th>" for h in headers)
    tbody = ""
    for row in rows:
        tds = "".join(f"<td>{html.escape(str(v))}</td>" for v in row)
        tbody += f"<tr>{tds}</tr>\n"
    return f"""
    <table class="styled-table">
        <thead><tr>{ths}</tr></thead>
        <tbody>{tbody}</tbody>
    </table>"""


def render_bullet_box(
    items: list[str], title: str = "",
    positive: bool = True,
) -> str:
    """인사이트 박스 HTML."""
    cls = "positive" if positive else "watch"
    title_html = f"<h3>{title}</h3>" if title else ""
    lis = "".join(f"<li>{html.escape(str(item))}</li>" for item in items)
    return f"""
    <div class="insight-box {cls}">
        {title_html}
        <ul>{lis}</ul>
    </div>"""


def render_section_header(title: str, subtitle: str = "") -> str:
    """섹션 타이틀 HTML."""
    sub = f'<div class="sub">{html.escape(str(subtitle))}</div>' if subtitle else ""
    return f"""
    <div class="section-header">
        <h2>{html.escape(str(title))}</h2>
        {sub}
    </div>"""


def render_chart_placeholder(
    chart_id: str, width: str = "100%", height: str = "400px",
) -> str:
    """Chart.js canvas placeholder HTML."""
    return f"""
    <div class="chart-container">
        <canvas id="{chart_id}" style="width:{width};height:{height}"></canvas>
    </div>"""


def render_product_ranking_grid(
    products: list[dict],
    img_key: str = "PRDT_IMG_URL",
    name_key: str = "PRDT_NM",
    code_key: str = "PRDT_CD",
    category_key: str = "ITEM_GROUP",
    price_key: str = "TAG_PRICE",
    metrics_config: list[tuple[str, str, str]] | None = None,
) -> str:
    """상품 랭킹 그리드 HTML 반환.

    Args:
        products: 상품 데이터 리스트 (dict). 순위순으로 정렬되어 있어야 함.
        img_key: 이미지 URL 키
        name_key: 상품명 키
        code_key: 상품코드 키
        category_key: 카테고리 키
        price_key: 가격 키
        metrics_config: [(데이터키, 라벨, 포맷)] 리스트.
            포맷: "amt"→억/만원, "qty"→천단위콤마, "pct"→%, "raw"→그대로
    """
    if metrics_config is None:
        metrics_config = [
            ("AC_SALE_AMT", "누적판매액", "amt"),
            ("AC_SALE_QTY", "판매Qty", "qty"),
            ("SALE_RT", "판매율", "pct"),
        ]

    cards = []
    for i, p in enumerate(products):
        rank = i + 1
        badge_cls = "rank-badge top3" if rank <= 3 else "rank-badge"
        img_url = html.escape(str(p.get(img_key, "")))
        name = html.escape(str(p.get(name_key, "")))
        code = html.escape(str(p.get(code_key, "")))
        category = html.escape(str(p.get(category_key, "")))
        price = p.get(price_key, 0)
        price_str = f"{int(price):,}원" if price else ""

        metrics_html = ""
        for data_key, label, fmt in metrics_config:
            val = p.get(data_key, 0)
            if fmt == "amt":
                v = float(val)
                abs_v = abs(v)
                if abs_v >= 1_0000_0000:
                    val_str = f"{v / 1_0000_0000:,.1f}억"
                elif abs_v >= 1_0000:
                    val_str = f"{v / 1_0000:,.0f}만"
                else:
                    val_str = f"{v:,.0f}"
            elif fmt == "qty":
                val_str = f"{int(val):,}"
            elif fmt == "pct":
                val_str = f"{float(val) * 100:.0f}%" if float(val) < 1 else f"{float(val):.0f}%"
            else:
                val_str = str(val)
            metrics_html += f"""
                <div class="metric">
                    <div class="m-label">{label}</div>
                    <div class="m-value">{val_str}</div>
                </div>"""

        cards.append(f"""
        <div class="product-card">
            <div class="{badge_cls}">{rank}</div>
            <div class="img-wrap">
                <img src="{img_url}" alt="{name}" loading="lazy"
                     onerror="this.style.display='none'">
            </div>
            <div class="info">
                <span class="category-tag">{category}</span>
                <div class="prdt-name" title="{name}">{name}</div>
                <div class="prdt-code">{code}</div>
                <div class="price-tag">{price_str}</div>
                <div class="metrics">{metrics_html}</div>
            </div>
        </div>""")

    return f'<div class="product-grid">{"".join(cards)}</div>'


# ── Chart.js 설정 ────────────────────────────────────────────

def get_chartjs_config(
    chart_type: str,
    data: dict,
    options: dict | None = None,
) -> str:
    """Chart.js 설정 JSON 문자열 반환.

    Args:
        chart_type: 'bar', 'line', 'doughnut', 'pie' 등
        data: Chart.js data 객체 (labels, datasets)
        options: Chart.js options 객체
    """
    config = {
        "type": chart_type,
        "data": data,
        "options": options or {},
    }
    return json.dumps(config, ensure_ascii=False)


# ── HTML 파일 저장 ───────────────────────────────────────────

def save_html(
    filepath: str | Path,
    title: str,
    body_html: str,
    charts_js: str = "",
) -> None:
    """전체 HTML 파일 저장 (CSS + Chart.js CDN + body + script).

    Args:
        filepath: 저장 경로
        title: HTML <title>
        body_html: <body> 내부 HTML
        charts_js: Chart.js 초기화 JavaScript 코드
    """
    css = get_white_minimal_css()
    html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(str(title))}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <style>{css}</style>
</head>
<body>
    <div class="report-container">
{body_html}
    </div>
    <script>
{charts_js}
    </script>
</body>
</html>"""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_content, encoding="utf-8")
    print(f"HTML 저장 완료: {filepath}")
