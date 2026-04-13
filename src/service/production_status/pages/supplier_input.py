"""
Cat.1 협력사/소싱담당자 입력 페이지
생산 진행 상태 입력, 이력 조회, 엑셀 업로드
"""
import datetime
import io

import polars as pl
import streamlit as st

from src.core.config import CURRENT_SEASON, GSHEET_SHEETS
from src.core.gsheet_client import get_gsheet_client

# ──────────────────────────────────────────
# 상수
# ──────────────────────────────────────────
SAMPLE_PO_LIST = [f"PO26V-{i:03d}" for i in range(1, 21)]
STATUS_OPTIONS = ["재단", "봉제", "검품", "출고", "완료"]
SHEET_NAME = GSHEET_SHEETS.get("production_input", "생산진행입력")


# ──────────────────────────────────────────
# 메인 렌더 함수
# ──────────────────────────────────────────
def render():
    """Cat.1 협력사/소싱담당자 입력 페이지"""
    st.markdown("## 📝 협력사 생산진행 입력")
    st.markdown("---")

    client = get_gsheet_client()

    # ────────────────────────────────────
    # 1) 입력 폼
    # ────────────────────────────────────
    st.markdown("### 생산 진행 입력")

    with st.form("production_input_form", clear_on_submit=True):
        col1, col2 = st.columns(2)

        with col1:
            po_no = st.selectbox("PO번호", options=SAMPLE_PO_LIST, index=0)
            status = st.selectbox("진행상태", options=STATUS_OPTIONS, index=0)
            progress = st.slider("진행률 (%)", min_value=0, max_value=100, value=50, step=5)

        with col2:
            writer = st.text_input("입력자", placeholder="이름 또는 담당자 ID")
            memo = st.text_area("이슈메모", placeholder="특이사항을 입력하세요", height=120)

        submitted = st.form_submit_button("저장", use_container_width=True, type="primary")

    if submitted:
        if not writer.strip():
            st.warning("입력자를 입력해주세요.")
        else:
            new_row = pl.DataFrame({
                "PO번호": [po_no],
                "진행상태": [status],
                "진행률": [progress],
                "이슈메모": [memo],
                "입력자": [writer.strip()],
                "입력일시": [datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
                "시즌": [CURRENT_SEASON],
            })
            try:
                client.write_sheet(SHEET_NAME, new_row, append=True)
                st.success(f"저장 완료: {po_no} / {status} / {progress}%")
            except Exception as e:
                st.error(f"저장 실패: {e}")

    st.markdown("---")

    # ────────────────────────────────────
    # 2) 현재 입력 이력 테이블
    # ────────────────────────────────────
    st.markdown("### 입력 이력")

    existing_df = client.read_sheet(SHEET_NAME)
    if existing_df.height > 0:
        st.dataframe(
            existing_df.to_pandas(),
            use_container_width=True,
            height=min(500, 40 + existing_df.height * 35),
        )
        st.caption(f"총 {existing_df.height}건")
    else:
        st.info("아직 입력된 이력이 없습니다.")

    st.markdown("---")

    # ────────────────────────────────────
    # 3) 엑셀 업로드
    # ────────────────────────────────────
    st.markdown("### 엑셀 일괄 업로드")
    st.caption("엑셀 파일(.xlsx)을 업로드하면 기존 이력에 병합 저장됩니다. "
               "컬럼: PO번호, 진행상태, 진행률, 이슈메모, 입력자")

    uploaded_file = st.file_uploader(
        "엑셀 파일 선택",
        type=["xlsx"],
        key="excel_uploader",
    )

    if uploaded_file is not None:
        try:
            upload_df = pl.read_excel(io.BytesIO(uploaded_file.read()))

            st.markdown("**업로드 미리보기**")
            st.dataframe(upload_df.to_pandas(), use_container_width=True)
            st.caption(f"총 {upload_df.height}건")

            if st.button("병합 저장", type="primary", key="merge_save"):
                # 입력일시/시즌 열 추가
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if "입력일시" not in upload_df.columns:
                    upload_df = upload_df.with_columns(pl.lit(now_str).alias("입력일시"))
                if "시즌" not in upload_df.columns:
                    upload_df = upload_df.with_columns(pl.lit(CURRENT_SEASON).alias("시즌"))

                client.write_sheet(SHEET_NAME, upload_df, append=True)
                st.success(f"{upload_df.height}건 병합 저장 완료")
                st.rerun()

        except Exception as e:
            st.error(f"엑셀 파싱 실패: {e}")
