"""matplotlib 시각화 유틸리티 — 차트 생성, 한글 폰트, 테마"""

from __future__ import annotations

import os
import platform
from io import BytesIO
from typing import Any

import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import matplotlib.ticker as ticker
import numpy as np


# ── 색상 상수 ────────────────────────────────────────────────

# 기준: FNF_AI_Native_OptA_WhiteMinimal.pptx
CHART_COLORS_CY = [
    "#006AE6", "#00B894", "#FFA000", "#6C5CE7",
    "#009688", "#FF6352", "#4BACC6", "#F79646",
]
CHART_COLORS_PY = [
    "#90B8F0", "#A5D6C8", "#FFCC80", "#B8AEF0",
    "#80CBC4", "#FF9E97", "#A0D4E0", "#FBCBA0",
]
DARK_CHART_COLORS = [
    "#006AE6", "#00B894", "#FFA000", "#FF6352",
    "#6C5CE7", "#009688", "#4BACC6", "#F79646",
]

FONT_NAME = "Arial"

# OS별 폰트 경로
_FONT_PATHS = {
    "Windows": {
        "arial": "C:/Windows/Fonts/arial.ttf",
        "korean": "C:/Windows/Fonts/malgun.ttf",
        "fallback": ["Arial", "Malgun Gothic", "sans-serif"],
    },
    "Darwin": {
        "arial": "/System/Library/Fonts/Supplemental/Arial.ttf",
        "korean": "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "fallback": ["Arial", "AppleGothic", "sans-serif"],
    },
    "Linux": {
        "arial": "",
        "korean": "",
        "fallback": ["DejaVu Sans", "NanumGothic", "sans-serif"],
    },
}


# ── 폰트 설정 ────────────────────────────────────────────────

def setup_korean_font() -> None:
    """matplotlib 폰트 설정 (OS 자동 감지)."""
    paths = _FONT_PATHS.get(platform.system(), _FONT_PATHS["Linux"])
    for key in ("arial", "korean"):
        p = paths[key]
        if p and os.path.exists(p):
            fm.fontManager.addfont(p)
    plt.rcParams["font.family"] = paths["fallback"]
    plt.rcParams["axes.unicode_minus"] = False


# ── Y축 천 단위 콤마 포맷 ────────────────────────────────────

def apply_comma_format(ax: plt.Axes, axis: str = "y") -> None:
    """축 숫자에 1,000 단위 콤마를 적용한다.

    Args:
        ax: matplotlib Axes 객체
        axis: "y", "x", "both" 중 하나
    """
    fmt = ticker.FuncFormatter(lambda v, _: f"{v:,.0f}")
    if axis in ("y", "both"):
        ax.yaxis.set_major_formatter(fmt)
    if axis in ("x", "both"):
        ax.xaxis.set_major_formatter(fmt)


# ── 차트 → 이미지 변환 ──────────────────────────────────────

def chart_to_image(
    fig: plt.Figure, dpi: int = 150, bg_color: str = "white",
) -> BytesIO:
    """matplotlib Figure → BytesIO (PNG)."""
    buf = BytesIO()
    fig.savefig(
        buf, format="png", dpi=dpi,
        bbox_inches="tight", facecolor=bg_color, edgecolor="none",
    )
    plt.close(fig)
    buf.seek(0)
    return buf


# ── 차트 생성 헬퍼 ───────────────────────────────────────────

def create_bar_chart(
    categories: list[str],
    series_data: dict[str, list[float]],
    title: str = "",
    figsize: tuple[float, float] = (8, 5),
    colors: list[str] | None = None,
    ylabel: str = "",
    show_labels: bool = True,
    label_fmt: str = "{:.0f}",
    **kwargs: Any,
) -> plt.Figure:
    """묶은 세로 막대 차트.

    Args:
        categories: X축 카테고리
        series_data: {"시리즈명": [값, ...]} 딕셔너리
        title: 차트 제목
    """
    setup_korean_font()
    colors = colors or CHART_COLORS_CY
    n_series = len(series_data)
    x = np.arange(len(categories))
    bar_width = 0.8 / max(n_series, 1)

    fig, ax = plt.subplots(figsize=figsize)
    for idx, (label, values) in enumerate(series_data.items()):
        offset = (idx - n_series / 2 + 0.5) * bar_width
        bars = ax.bar(
            x + offset, values, bar_width,
            label=label, color=colors[idx % len(colors)],
        )
        if show_labels:
            add_bar_labels(ax, bars, fmt=label_fmt)

    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    if title:
        ax.set_title(title, fontweight="bold", pad=12)
    if ylabel:
        ax.set_ylabel(ylabel)
    ax.legend()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    apply_comma_format(ax)
    fig.tight_layout()
    return fig


def create_horizontal_bar(
    categories: list[str],
    values: list[float],
    title: str = "",
    figsize: tuple[float, float] = (8, 5),
    color: str | None = None,
    show_labels: bool = True,
    label_fmt: str = "{:.0f}",
    **kwargs: Any,
) -> plt.Figure:
    """가로 막대 차트."""
    setup_korean_font()
    color = color or CHART_COLORS_CY[0]
    fig, ax = plt.subplots(figsize=figsize)
    y = np.arange(len(categories))
    bars = ax.barh(y, values, color=color)
    ax.set_yticks(y)
    ax.set_yticklabels(categories)
    if title:
        ax.set_title(title, fontweight="bold", pad=12)
    if show_labels:
        for bar in bars:
            w = bar.get_width()
            ax.text(
                w, bar.get_y() + bar.get_height() / 2,
                f" {label_fmt.format(w)}", va="center", fontsize=9,
            )
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    apply_comma_format(ax, axis="x")
    fig.tight_layout()
    return fig


def create_pie_chart(
    labels: list[str],
    values: list[float],
    title: str = "",
    figsize: tuple[float, float] = (6, 6),
    colors: list[str] | None = None,
    donut: bool = False,
    text_color: str = "#333",
    label_fontsize: int = 11,
    pct_fontsize: int = 10,
    **kwargs: Any,
) -> plt.Figure:
    """파이/도넛 차트.

    Args:
        text_color: 라벨 및 퍼센트 텍스트 색상 (다크 배경 시 "white" 사용)
        label_fontsize: 카테고리 라벨 폰트 크기
        pct_fontsize: 퍼센트 텍스트 폰트 크기
    """
    setup_korean_font()
    colors = colors or CHART_COLORS_CY
    fig, ax = plt.subplots(figsize=figsize)
    wedge_kwargs = {"width": 0.4} if donut else {}
    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors[:len(labels)],
        autopct="%1.1f%%", startangle=90, wedgeprops=wedge_kwargs,
    )
    for t in texts:
        t.set_color(text_color)
        t.set_fontsize(label_fontsize)
    for t in autotexts:
        t.set_color(text_color)
        t.set_fontsize(pct_fontsize)
        t.set_fontweight("bold")
    if title:
        ax.set_title(title, fontweight="bold", pad=12, color=text_color)
    fig.tight_layout()
    return fig


def create_line_chart(
    categories: list[str],
    series_data: dict[str, list[float]],
    title: str = "",
    figsize: tuple[float, float] = (8, 5),
    colors: list[str] | None = None,
    ylabel: str = "",
    show_labels: bool = False,
    label_fmt: str = "{:.0f}",
    marker: str = "o",
    **kwargs: Any,
) -> plt.Figure:
    """시계열 라인 차트.

    Args:
        categories: X축 카테고리 (예: 날짜, 주차)
        series_data: {"시리즈명": [값, ...]} 딕셔너리
        title: 차트 제목
        marker: 마커 스타일 (기본: "o")
    """
    setup_korean_font()
    colors = colors or CHART_COLORS_CY
    fig, ax = plt.subplots(figsize=figsize)
    x = np.arange(len(categories))

    for idx, (label, values) in enumerate(series_data.items()):
        ax.plot(
            x, values, label=label,
            color=colors[idx % len(colors)],
            marker=marker, linewidth=2, markersize=5,
        )
        if show_labels:
            for xi, v in zip(x, values):
                ax.text(
                    xi, v, f" {label_fmt.format(v)}",
                    ha="center", va="bottom", fontsize=8,
                    color=colors[idx % len(colors)],
                )

    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    if title:
        ax.set_title(title, fontweight="bold", pad=12)
    if ylabel:
        ax.set_ylabel(ylabel)
    ax.legend()
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    apply_comma_format(ax)
    fig.tight_layout()
    return fig


def create_comparison_bars(
    categories: list[str],
    cur_vals: list[float],
    prev_vals: list[float],
    labels: tuple[str, str] = ("당해", "전년"),
    title: str = "",
    figsize: tuple[float, float] = (8, 5),
    colors: tuple[str, str] | None = None,
    show_labels: bool = True,
    label_fmt: str = "{:.0f}",
    **kwargs: Any,
) -> plt.Figure:
    """당해 vs 전년 비교 막대 차트."""
    series = {labels[0]: cur_vals, labels[1]: prev_vals}
    c = colors or (CHART_COLORS_CY[0], CHART_COLORS_PY[0])
    return create_bar_chart(
        categories, series, title=title, figsize=figsize,
        colors=list(c), show_labels=show_labels, label_fmt=label_fmt,
        **kwargs,
    )


# ── 테마 적용 ────────────────────────────────────────────────

def apply_dark_theme(fig: plt.Figure, ax: plt.Axes) -> None:
    """다크 테마 적용."""
    bg = "#1E293B"
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)
    ax.tick_params(colors="white")
    ax.xaxis.label.set_color("white")
    ax.yaxis.label.set_color("white")
    ax.title.set_color("white")
    for spine in ax.spines.values():
        spine.set_color("#444")


def apply_light_theme(fig: plt.Figure, ax: plt.Axes) -> None:
    """라이트 테마 적용."""
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    ax.tick_params(colors="#333")
    for spine in ax.spines.values():
        spine.set_color("#ccc")


# ── 데이터 라벨 ──────────────────────────────────────────────

def add_bar_labels(
    ax: plt.Axes,
    bars,
    fmt: str = "{:.0f}",
    fontsize: int = 8,
    color: str = "#333",
    **kwargs: Any,
) -> None:
    """막대 위에 데이터 라벨 추가."""
    for bar in bars:
        h = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2, h,
            fmt.format(h), ha="center", va="bottom" if h >= 0 else "top",
            fontsize=fontsize, color=color, **kwargs,
        )
