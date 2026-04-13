"""
Cat.4 협력사 상세 패널
발주/입고, 원가, 클레임 실적 + 메모 입력 (Google Sheets)
데이터 소스: KG 캐시 조합 + Google Sheets
"""

import polars as pl
import streamlit as st

from src.core.config import (
    BRAND_CODE_MAP,
    CURRENT_SEASON,
    STATUS_COLORS,
    GRADE_MAP,
    get_supplier_grade,
    get_status,
    get_markup_verdict,
)
from src.core.data_loader import load_order_inbound, load_cost_master, load_claims
from src.core.gsheet_client import get_gsheet_client
from src.core.config import GSHEET_SHEETS


def _get_supplier_list(brd_cd: str, season: str) -> list[str]:
    """사용 가능한 협력사 목록"""
    suppliers = set()
    order_df = load_order_inbound(brd_cd, season)
    if not order_df.is_empty() and "MFAC_COMPY_NM" in order_df.columns:
        suppliers.update(order_df["MFAC_COMPY_NM"].drop_nulls().unique().to_list())
    cost_df = load_cost_master(brd_cd, season)
    if not cost_df.is_empty() and "MFAC_COMPY_NM" in cost_df.columns:
        suppliers.update(cost_df["MFAC_COMPY_NM"].drop_nulls().unique().to_list())
    return sorted(suppliers)


def _render_order_summary(brd_cd: str, season: str, supplier: str):
    """발주/입고 요약"""
    df = load_order_inbound(brd_cd, season)
    if df.is_empty() or "MFAC_COMPY_NM" not in df.columns:
        st.info("발주/입고 데이터가 없습니다.")
        return

    s_df = df.filter(pl.col("MFAC_COMPY_NM") == supplier)
    if s_df.is_empty():
        st.info(f"{supplier}: 해당 시즌 발주 데이터 없음")
        return

    ord_qty = s_df["ORD_QTY"].sum() if "ORD_QTY" in s_df.columns else 0
    stor_qty = s_df["STOR_QTY"].sum() if "STOR_QTY" in s_df.columns else 0
    rate = min(stor_qty / ord_qty * 100, 100) if ord_qty > 0 else 0
    po_count = s_df["PO_NO"].n_unique() if "PO_NO" in s_df.columns else 0

    cols = st.columns(4)
    metrics = [
        ("발주수량", f"{ord_qty:,.0f}"),
        ("입고수량", f"{stor_qty:,.0f}"),
        ("이행률", f"{rate:.1f}%"),
        ("PO 건수", f"{po_count}건"),
    ]
    for col, (label, value) in zip(cols, metrics):
        col.metric(label, value)


def _render_cost_summary(brd_cd: str, season: str, supplier: str):
    """원가 요약"""
    df = load_cost_master(brd_cd, season)
    if df.is_empty() or "MFAC_COMPY_NM" not in df.columns:
        st.info("원가 데이터가 없습니다.")
        return

    s_df = df.filter(pl.col("MFAC_COMPY_NM") == supplier)
    if s_df.is_empty():
        st.info(f"{supplier}: 해당 시즌 원가 데이터 없음")
        return

    avg_cost = s_df["MFAC_COST_MFAC_COST_AMT"].mean() * 1.1
    avg_markup = s_df["MFAC_COST_MARKUP"].mean()
    style_count = s_df["PRDT_CD"].n_unique()

    cols = st.columns(3)
    cols[0].metric("평균원가 (USD)", f"${avg_cost:,.1f}")
    cols[1].metric("평균 M/U", f"{avg_markup:.2f}x" if avg_markup else "-")
    cols[2].metric("스타일 수", f"{style_count}개")


def _render_claim_summary(brd_cd: str, supplier: str):
    """클레임 요약"""
    df = load_claims(brd_cd)
    if df.is_empty() or "MFAC_COMPY_NM" not in df.columns:
        st.info("클레임 데이터가 없습니다.")
        return

    s_df = df.filter(pl.col("MFAC_COMPY_NM") == supplier)
    if s_df.is_empty():
        st.info(f"{supplier}: 클레임 없음")
        return

    total_claim = s_df["CLAIM_QTY"].sum()
    claim_types = s_df["CLAIM_CONTS_ANAL_GROUP_NM"].n_unique() if "CLAIM_CONTS_ANAL_GROUP_NM" in s_df.columns else 0

    cols = st.columns(2)
    cols[0].metric("총 클레임", f"{total_claim:,.0f}건")
    cols[1].metric("불량유형 수", f"{claim_types}종")

    # 불량유형 분포
    if "CLAIM_CONTS_ANAL_GROUP_NM" in s_df.columns:
        type_agg = (
            s_df.group_by("CLAIM_CONTS_ANAL_GROUP_NM")
            .agg(pl.col("CLAIM_QTY").sum().alias("qty"))
            .sort("qty", descending=True)
        )
        st.dataframe(type_agg.to_pandas(), use_container_width=True, hide_index=True)


def render():
    st.markdown("## 협력사 상세 패널")
    st.markdown("---")

    brd_cd = st.session_state.get("selected_brand", "V")
    season = st.session_state.get("global_season", "26S")
    brand_name = BRAND_CODE_MAP.get(brd_cd, brd_cd)

    suppliers = _get_supplier_list(brd_cd, season)
    if not suppliers:
        st.warning(f"{brand_name} 협력사 데이터가 없습니다.")
        return

    selected = st.selectbox("협력사 선택", suppliers, key="supplier_detail_select")
    st.markdown("---")

    # 발주/입고
    st.markdown(f"### 발주/입고 현황 ({season})")
    _render_order_summary(brd_cd, season, selected)

    st.markdown("---")

    # 원가
    st.markdown(f"### 원가 현황 ({season})")
    _render_cost_summary(brd_cd, season, selected)

    st.markdown("---")

    # 클레임
    st.markdown("### 클레임 이력")
    _render_claim_summary(brd_cd, selected)

    st.markdown("---")

    # 메모 입력 (Google Sheets)
    st.markdown("### 메모")
    memo_text = st.text_area("협력사 메모 입력", key="supplier_memo_input", height=100)
    if st.button("메모 저장", key="save_supplier_memo"):
        try:
            client = get_gsheet_client()
            import datetime
            new_row = pl.DataFrame([{
                "협력사": selected,
                "날짜": datetime.date.today().isoformat(),
                "브랜드": brd_cd,
                "시즌": season,
                "메모": memo_text,
            }])
            client.write_sheet(GSHEET_SHEETS["supplier_memo"], new_row, append=True)
            st.success("메모가 저장되었습니다.")
        except Exception as e:
            st.error(f"저장 실패: {e}")
