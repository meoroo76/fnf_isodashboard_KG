"""
Cat.1 리포트 생성 페이지
주간 생산현황 HTML 리포트 생성 및 다운로드
"""
import datetime
import subprocess
import sys
from pathlib import Path

import polars as pl
import streamlit as st

from src.core.config import (
    BRANDS,
    BRAND_CODE_MAP,
    CATEGORY_COLORS,
    CURRENT_SEASON,
    STATUS_COLORS,
)

try:
    from src.service.common.components import (
        season_filter,
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

    def format_number(value: float, unit: str = "") -> str:
        if unit == "억":
            return f"{value / 1e8:,.1f}억"
        if unit == "천":
            return f"{value / 1000:,.1f}천"
        return f"{value:,.0f}{unit}"


# ──────────────────────────────────────────
# 출력 디렉토리
# ──────────────────────────────────────────
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────
# 샘플 데이터 (order_dashboard.py 재활용)
# ──────────────────────────────────────────
def _generate_sample_data() -> pl.DataFrame:
    """리포트용 샘플 데이터 (20개 PO)"""
    rows = [
        ("PO26V-001", "V26S-OT001", "KAPPA 다운 자켓",       "OUTER",   "동진텍스타일", "2026-04-15", "2026-04-14", 3000, 4500000000, 2400),
        ("PO26V-002", "V26S-OT002", "DUVETICA 구스다운 베스트", "OUTER",  "성원어패럴",   "2026-04-20", "2026-04-22", 2500, 3750000000, 1800),
        ("PO26V-003", "V26S-OT003", "라이트 윈드브레이커",     "OUTER",   "한세실업",     "2026-04-10", "2026-04-10", 4000, 3200000000, 3800),
        ("PO26V-004", "V26S-OT004", "나일론 봄버 자켓",       "OUTER",   "동진텍스타일", "2026-04-05", "2026-04-06", 1800, 2700000000, 1800),
        ("PO26V-005", "V26S-OT005", "테크 쉘 파카",           "OUTER",   "에스앤케이",   "2026-05-01", "2026-05-03", 1200, 2400000000, 0),
        ("PO26V-006", "V26S-IN001", "에센셜 라운드 티셔츠",   "INNER",   "한세실업",     "2026-04-12", "2026-04-12", 8000, 2400000000, 7200),
        ("PO26V-007", "V26S-IN002", "쿨맥스 폴로 셔츠",       "INNER",   "성원어패럴",   "2026-04-08", "2026-04-09", 5000, 2000000000, 4500),
        ("PO26V-008", "V26S-IN003", "오버핏 스웻셔츠",         "INNER",   "동진텍스타일", "2026-04-18", "2026-04-20", 3500, 1750000000, 1000),
        ("PO26V-009", "V26S-IN004", "그래픽 후디",             "INNER",   "에스앤케이",   "2026-03-30", "2026-04-02", 2000, 1200000000, 2000),
        ("PO26V-010", "V26S-IN005", "린넨 블렌드 셔츠",       "INNER",   "한세실업",     "2026-04-25", "2026-04-25", 1500, 900000000,  0),
        ("PO26V-011", "V26S-BT001", "와이드 카고 팬츠",       "BOTTOM",  "세아상역",     "2026-04-10", "2026-04-11", 6000, 2400000000, 5500),
        ("PO26V-012", "V26S-BT002", "슬림핏 치노 팬츠",       "BOTTOM",  "에스앤케이",   "2026-04-14", "2026-04-15", 4500, 1800000000, 3200),
        ("PO26V-013", "V26S-BT003", "조거 트레이닝 팬츠",     "BOTTOM",  "세아상역",     "2026-04-06", "2026-04-06", 3000, 1200000000, 3000),
        ("PO26V-014", "V26S-BT004", "데님 스트레이트 진",     "BOTTOM",  "동진텍스타일", "2026-04-22", "2026-04-24", 2000, 1000000000, 500),
        ("PO26V-015", "V26S-AC001", "로고 볼캡",             "ACC_ETC", "태광실업",     "2026-04-08", "2026-04-08", 10000, 800000000, 9500),
        ("PO26V-016", "V26S-AC002", "스포츠 백팩",           "ACC_ETC", "태광실업",     "2026-04-15", "2026-04-16", 3000, 1500000000, 2000),
        ("PO26V-017", "V26S-AC003", "로고 양말 3팩",         "ACC_ETC", "성원어패럴",   "2026-04-03", "2026-04-03", 15000, 450000000, 15000),
        ("PO26V-018", "V26S-AC004", "유틸리티 벨트",         "ACC_ETC", "태광실업",     "2026-05-10", "2026-05-12", 2000, 400000000,  0),
        ("PO26V-019", "V26S-OT006", "리버서블 패딩 베스트",   "OUTER",   "한세실업",     "2026-04-03", "2026-04-05", 2200, 2200000000, 2200),
        ("PO26V-020", "V26S-IN006", "드라이핏 탱크탑",       "INNER",   "세아상역",     "2026-04-11", "2026-04-11", 4000, 800000000,  3600),
    ]

    return pl.DataFrame(
        {
            "PO_NO":        [r[0] for r in rows],
            "PRDT_CD":      [r[1] for r in rows],
            "PRDT_NM":      [r[2] for r in rows],
            "ITEM_GROUP":   [r[3] for r in rows],
            "MFAC_COMPY_NM":[r[4] for r in rows],
            "INDC_DT_REQ":  [r[5] for r in rows],
            "INDC_DT_CNFM": [r[6] for r in rows],
            "ORD_QTY":      [r[7] for r in rows],
            "ORD_TAG_AMT":  [r[8] for r in rows],
            "STOR_QTY":     [r[9] for r in rows],
        },
    )


# ──────────────────────────────────────────
# 납기 상태 판정 (리포트용)
# ──────────────────────────────────────────
def _delivery_status(row: dict, today: datetime.date) -> str:
    cnfm = row.get("INDC_DT_CNFM") or row.get("INDC_DT_REQ")
    if not cnfm:
        return "good"
    try:
        cnfm_date = datetime.date.fromisoformat(str(cnfm))
    except (ValueError, TypeError):
        return "good"
    stor = row.get("STOR_QTY", 0) or 0
    qty = row.get("ORD_QTY", 1) or 1
    if stor / qty >= 1.0:
        return "good"
    diff = (cnfm_date - today).days
    if diff < 0:
        return "danger"
    if diff <= 7:
        return "warn"
    return "good"


# ──────────────────────────────────────────
# HTML 리포트 생성
# ──────────────────────────────────────────
def _generate_html_report(brand_name: str, season: str, df: pl.DataFrame) -> str:
    """주간 생산현황 HTML 리포트 생성"""
    today = datetime.date(2026, 4, 7)
    gen_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    # KPI 집계
    total_amt = df["ORD_TAG_AMT"].sum()
    total_qty = df["ORD_QTY"].sum()
    total_stor = df["STOR_QTY"].sum()
    fulfill_pct = (total_stor / total_qty * 100) if total_qty > 0 else 0

    # 아이템그룹별 진행률
    group_df = (
        df.group_by("ITEM_GROUP")
        .agg([
            pl.col("ORD_QTY").sum().alias("ord_qty"),
            pl.col("STOR_QTY").sum().alias("stor_qty"),
            pl.col("ORD_TAG_AMT").sum().alias("ord_amt"),
            pl.len().alias("po_count"),
        ])
        .with_columns(
            (pl.col("stor_qty") / pl.col("ord_qty") * 100).round(1).alias("progress")
        )
        .sort("ord_qty", descending=True)
    )

    group_rows_html = ""
    for row in group_df.to_dicts():
        color = CATEGORY_COLORS.get(row["ITEM_GROUP"], "#4f46e5")
        pct = row["progress"]
        bar_color = "#16A34A" if pct >= 80 else "#F59E0B" if pct >= 50 else "#EF4444"
        group_rows_html += f"""
        <tr>
            <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;
                background:{color};margin-right:6px;"></span>{row['ITEM_GROUP']}</td>
            <td style="text-align:right">{row['po_count']}</td>
            <td style="text-align:right">{row['ord_qty']:,}</td>
            <td style="text-align:right">{row['stor_qty']:,}</td>
            <td style="text-align:right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                    <div style="width:80px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
                        <div style="width:{pct}%;height:100%;background:{bar_color};border-radius:4px;"></div>
                    </div>
                    <span>{pct:.1f}%</span>
                </div>
            </td>
        </tr>
        """

    # 납기 알림 요약
    records = df.to_dicts()
    statuses = [_delivery_status(r, today) for r in records]
    danger_rows = [(r, s) for r, s in zip(records, statuses) if s == "danger"]
    warn_rows = [(r, s) for r, s in zip(records, statuses) if s == "warn"]

    alert_html = ""
    if danger_rows:
        alert_html += '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:12px;">'
        alert_html += f'<strong style="color:#EF4444;">지연 {len(danger_rows)}건</strong><ul style="margin:8px 0 0 0;">'
        for r, _ in danger_rows:
            cnfm = r.get("INDC_DT_CNFM", "-")
            alert_html += f'<li>{r["PO_NO"]} - {r["PRDT_NM"]} (납기: {cnfm}, 협력사: {r["MFAC_COMPY_NM"]})</li>'
        alert_html += "</ul></div>"

    if warn_rows:
        alert_html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:12px;">'
        alert_html += f'<strong style="color:#F59E0B;">D-7 임박 {len(warn_rows)}건</strong><ul style="margin:8px 0 0 0;">'
        for r, _ in warn_rows:
            cnfm = r.get("INDC_DT_CNFM", "-")
            alert_html += f'<li>{r["PO_NO"]} - {r["PRDT_NM"]} (납기: {cnfm}, 협력사: {r["MFAC_COMPY_NM"]})</li>'
        alert_html += "</ul></div>"

    if not danger_rows and not warn_rows:
        alert_html = '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px;">' \
                     '<strong style="color:#16A34A;">납기 이슈 없음</strong></div>'

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>주간 생산현황 리포트 - {brand_name} {season}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #1f2937; background: #f9fafb; padding: 32px; }}
        .container {{ max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 40px; }}
        .header {{ text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }}
        .header h1 {{ font-size: 24px; color: #1f2937; margin-bottom: 8px; }}
        .header .meta {{ font-size: 14px; color: #6b7280; }}
        .kpi-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }}
        .kpi-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; }}
        .kpi-card .label {{ font-size: 13px; color: #6b7280; margin-bottom: 4px; }}
        .kpi-card .value {{ font-size: 28px; font-weight: 700; color: #1e293b; }}
        h2 {{ font-size: 18px; color: #1f2937; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
        th {{ background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }}
        tr:hover {{ background: #f8fafc; }}
        .footer {{ text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>주간 생산현황 리포트</h1>
            <div class="meta">{brand_name} | {season} | 생성일: {gen_time}</div>
        </div>

        <h2>KPI 요약</h2>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="label">발주액</div>
                <div class="value">{total_amt / 1e8:,.1f}억</div>
            </div>
            <div class="kpi-card">
                <div class="label">발주수량</div>
                <div class="value">{total_qty:,}</div>
            </div>
            <div class="kpi-card">
                <div class="label">입고율</div>
                <div class="value">{fulfill_pct:.1f}%</div>
            </div>
        </div>

        <h2>아이템그룹별 진행률</h2>
        <table>
            <thead>
                <tr>
                    <th>아이템그룹</th>
                    <th style="text-align:right">PO건수</th>
                    <th style="text-align:right">발주수량</th>
                    <th style="text-align:right">입고수량</th>
                    <th style="text-align:right">진행률</th>
                </tr>
            </thead>
            <tbody>
                {group_rows_html}
            </tbody>
        </table>

        <h2>납기 알림 요약</h2>
        {alert_html}

        <div class="footer">
            ISO AI Agent | 자동 생성 리포트 | {gen_time}
        </div>
    </div>
</body>
</html>"""

    return html


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.1 리포트 생성 페이지"""
    st.markdown("## 📄 주간 생산현황 리포트")
    st.markdown("---")

    # ── 필터 ──
    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")

    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)
    st.caption(f"📌 {brand_name} | 시즌: {season}")

    st.markdown("")

    # ── 리포트 생성 ──
    if st.button("주간 생산현황 리포트 생성", type="primary", use_container_width=True):
        with st.spinner("리포트 생성 중..."):
            df = _generate_sample_data()
            html_content = _generate_html_report(brand_name, season, df)

            # 파일 저장
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"주간생산현황_{brand_name}_{season}_{timestamp}.html"
            filepath = OUTPUT_DIR / filename
            filepath.write_text(html_content, encoding="utf-8")

            st.session_state["_report_html"] = html_content
            st.session_state["_report_filename"] = filename
            st.session_state["_report_filepath"] = str(filepath)

        st.success(f"리포트 생성 완료: {filename}")

    # ── 다운로드 / 열기 ──
    if "_report_html" in st.session_state:
        st.markdown("---")
        st.markdown("### 생성된 리포트")

        col_dl, col_open, col_spacer2 = st.columns([2, 2, 6])

        with col_dl:
            st.download_button(
                label="다운로드 (.html)",
                data=st.session_state["_report_html"],
                file_name=st.session_state["_report_filename"],
                mime="text/html",
                use_container_width=True,
            )

        with col_open:
            if st.button("파일 열기", use_container_width=True):
                fpath = st.session_state.get("_report_filepath", "")
                if fpath:
                    try:
                        if sys.platform == "win32":
                            subprocess.Popen(["cmd", "/c", "start", "", fpath], shell=False)
                        elif sys.platform == "darwin":
                            subprocess.Popen(["open", fpath])
                        else:
                            subprocess.Popen(["xdg-open", fpath])
                        st.info("파일을 열었습니다.")
                    except Exception as e:
                        st.error(f"파일 열기 실패: {e}")

        # 미리보기
        with st.expander("리포트 미리보기", expanded=False):
            st.components.v1.html(st.session_state["_report_html"], height=800, scrolling=True)
