"""Plotly 고급 차트 유틸리티 — treemap, sankey, funnel, heatmap, 복합 축 등"""

from __future__ import annotations

import platform
from io import BytesIO
from typing import Any

import plotly.graph_objects as go
import plotly.io as pio

from src.util.chart_utils import CHART_COLORS_CY, CHART_COLORS_PY

# ── 폰트 설정 ────────────────────────────────────────────────

_FONT_FAMILY = {
    "Windows": "Malgun Gothic, Arial, sans-serif",
    "Darwin": "AppleSDGothicNeo, Arial, sans-serif",
    "Linux": "NanumGothic, DejaVu Sans, sans-serif",
}

DEFAULT_FONT = _FONT_FAMILY.get(platform.system(), "Arial, sans-serif")


def _hex_to_rgba(hex_color: str, alpha: float = 1.0) -> str:
    """HEX 색상을 rgba() 문자열로 변환."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


# ── 테마 적용 ────────────────────────────────────────────────

def apply_theme(
    fig: go.Figure,
    theme: str = "light",
    font_family: str | None = None,
) -> go.Figure:
    """프로젝트 표준 테마 적용.

    Args:
        fig: Plotly Figure
        theme: "light" 또는 "dark"
        font_family: 폰트 (미지정 시 OS별 자동 선택)
    """
    font = font_family or DEFAULT_FONT

    if theme == "dark":
        fig.update_layout(
            paper_bgcolor="#1E293B",
            plot_bgcolor="#1E293B",
            font=dict(family=font, color="white"),
            title_font=dict(color="white"),
        )
    else:
        fig.update_layout(
            paper_bgcolor="white",
            plot_bgcolor="white",
            font=dict(family=font, color="#2D2D2D"),
        )
    return fig


# ── 차트 생성 ────────────────────────────────────────────────

def create_treemap(
    labels: list[str],
    parents: list[str],
    values: list[float],
    title: str = "",
    colors: list[str] | None = None,
    **kwargs: Any,
) -> go.Figure:
    """계층 구조 트리맵.

    Args:
        labels: 각 노드 이름
        parents: 각 노드의 부모 이름 (루트는 "")
        values: 각 노드 값
        title: 차트 제목
    """
    palette = colors or CHART_COLORS_CY
    fig = go.Figure(go.Treemap(
        labels=labels,
        parents=parents,
        values=values,
        marker=dict(colors=[palette[i % len(palette)] for i in range(len(labels))]),
        textinfo="label+value+percent parent",
        **kwargs,
    ))
    fig.update_layout(title=title, margin=dict(t=50, l=10, r=10, b=10))
    return apply_theme(fig)


def create_sankey(
    node_labels: list[str],
    source: list[int],
    target: list[int],
    value: list[float],
    title: str = "",
    colors: list[str] | None = None,
    **kwargs: Any,
) -> go.Figure:
    """흐름도 (Sankey diagram).

    Args:
        node_labels: 노드 라벨 리스트
        source: 소스 노드 인덱스 리스트
        target: 타겟 노드 인덱스 리스트
        value: 각 링크의 값
        title: 차트 제목
    """
    palette = colors or CHART_COLORS_CY
    node_colors = [palette[i % len(palette)] for i in range(len(node_labels))]
    # 링크 색상: 소스 노드 색상을 rgba 변환 (40% 투명도)
    link_colors = [_hex_to_rgba(palette[s % len(palette)], 0.4) for s in source]

    fig = go.Figure(go.Sankey(
        node=dict(label=node_labels, color=node_colors, pad=20, thickness=20),
        link=dict(source=source, target=target, value=value, color=link_colors),
        **kwargs,
    ))
    fig.update_layout(title=title, margin=dict(t=50, l=10, r=10, b=10))
    return apply_theme(fig)


def create_funnel(
    stages: list[str],
    values: list[float],
    title: str = "",
    colors: list[str] | None = None,
    **kwargs: Any,
) -> go.Figure:
    """퍼널 차트.

    Args:
        stages: 단계 이름 리스트
        values: 각 단계 값
        title: 차트 제목
    """
    palette = colors or CHART_COLORS_CY
    fig = go.Figure(go.Funnel(
        y=stages,
        x=values,
        marker=dict(color=[palette[i % len(palette)] for i in range(len(stages))]),
        textinfo="value+percent initial",
        **kwargs,
    ))
    fig.update_layout(title=title, margin=dict(t=50, l=10, r=10, b=10))
    return apply_theme(fig)


def create_heatmap(
    z: list[list[float]],
    x_labels: list[str] | None = None,
    y_labels: list[str] | None = None,
    title: str = "",
    colorscale: str = "Blues",
    show_text: bool = True,
    text_fmt: str = ".0f",
    **kwargs: Any,
) -> go.Figure:
    """히트맵.

    Args:
        z: 2D 데이터 배열
        x_labels: X축 라벨
        y_labels: Y축 라벨
        title: 차트 제목
        colorscale: 색상 스케일 (기본: "Blues")
        show_text: 셀 내 값 표시 여부
        text_fmt: 텍스트 포맷 (기본: ".0f")
    """
    text_template = f"%{{z:{text_fmt}}}" if show_text else None
    fig = go.Figure(go.Heatmap(
        z=z,
        x=x_labels,
        y=y_labels,
        colorscale=colorscale,
        texttemplate=text_template,
        **kwargs,
    ))
    fig.update_layout(title=title, margin=dict(t=50, l=80, r=10, b=50))
    return apply_theme(fig)


def create_multi_axis(
    categories: list[str],
    series_left: dict[str, list[float]],
    series_right: dict[str, list[float]],
    title: str = "",
    ylabel_left: str = "",
    ylabel_right: str = "",
    left_type: str = "bar",
    right_type: str = "scatter",
    colors: list[str] | None = None,
    **kwargs: Any,
) -> go.Figure:
    """복합 축 차트 (좌: bar/line, 우: line/scatter 등).

    Args:
        categories: X축 카테고리
        series_left: 좌측 Y축 시리즈 {"시리즈명": [값, ...]}
        series_right: 우측 Y축 시리즈 {"시리즈명": [값, ...]}
        title: 차트 제목
        ylabel_left: 좌측 Y축 라벨
        ylabel_right: 우측 Y축 라벨
        left_type: 좌측 차트 타입 ("bar" 또는 "scatter")
        right_type: 우측 차트 타입 ("bar" 또는 "scatter")
    """
    from plotly.subplots import make_subplots

    palette = colors or CHART_COLORS_CY
    fig = make_subplots(specs=[[{"secondary_y": True}]])

    color_idx = 0
    for name, values in series_left.items():
        color = palette[color_idx % len(palette)]
        if left_type == "bar":
            fig.add_trace(
                go.Bar(x=categories, y=values, name=name, marker_color=color),
                secondary_y=False,
            )
        else:
            fig.add_trace(
                go.Scatter(x=categories, y=values, name=name,
                           line=dict(color=color, width=2), mode="lines+markers"),
                secondary_y=False,
            )
        color_idx += 1

    for name, values in series_right.items():
        color = palette[color_idx % len(palette)]
        if right_type == "bar":
            fig.add_trace(
                go.Bar(x=categories, y=values, name=name, marker_color=color),
                secondary_y=True,
            )
        else:
            fig.add_trace(
                go.Scatter(x=categories, y=values, name=name,
                           line=dict(color=color, width=2, dash="dot"),
                           mode="lines+markers"),
                secondary_y=True,
            )
        color_idx += 1

    fig.update_layout(title=title, margin=dict(t=50, l=60, r=60, b=50))
    fig.update_yaxes(title_text=ylabel_left, secondary_y=False)
    fig.update_yaxes(title_text=ylabel_right, secondary_y=True)
    return apply_theme(fig)


# ── 출력 변환 ────────────────────────────────────────────────

def chart_to_html_plotly(
    fig: go.Figure,
    include_plotlyjs: str = "cdn",
    full_html: bool = False,
    div_id: str | None = None,
) -> str:
    """Plotly Figure -> HTML div 문자열.

    Args:
        fig: Plotly Figure
        include_plotlyjs: "cdn", True, False, "require" 등
        full_html: True면 전체 HTML 문서, False면 div만
        div_id: div 요소 id
    """
    return pio.to_html(
        fig,
        include_plotlyjs=include_plotlyjs,
        full_html=full_html,
        div_id=div_id,
    )


def chart_to_image_plotly(
    fig: go.Figure,
    fmt: str = "png",
    width: int = 1200,
    height: int = 700,
    scale: int = 2,
) -> BytesIO:
    """Plotly Figure -> BytesIO (PNG/SVG). PPTX 삽입 호환.

    Args:
        fig: Plotly Figure
        fmt: 이미지 포맷 ("png", "svg", "jpeg", "webp")
        width: 이미지 너비 (px)
        height: 이미지 높이 (px)
        scale: 해상도 배율
    """
    img_bytes = pio.to_image(
        fig, format=fmt, width=width, height=height, scale=scale,
    )
    buf = BytesIO(img_bytes)
    buf.seek(0)
    return buf
