"""
생산스케줄 엑셀 → JSON 변환
OneDrive 동기화 폴더에서 읽어 frontend/public/data/에 저장

사용법:
  PYTHONPATH=. .venv/Scripts/python src/service/sync_schedule_excel.py
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("openpyxl 설치 필요: uv pip install openpyxl")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "frontend" / "public" / "data"

# OneDrive 경로
ONEDRIVE_DIR = Path(r"C:\Users\AD1305\OneDrive - F&F\F_ISO-듀베티카 공용파일 - 문서")

EXCEL_FILES = {
    "26S": ONEDRIVE_DIR / "■ 26SS_DV_생산스케줄 취합_260205.xlsx",
    "26F": ONEDRIVE_DIR / "■ 26FW_DV_생산스케줄 취합_260325 1.xlsx",
}

# 메인 시트명 패턴
SHEET_PATTERNS = ["● 2026", "● 2025"]


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def fmt_date(val) -> str | None:
    """날짜 값을 YYYY-MM-DD 문자열로 변환"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s in ("#VALUE!", "#N/A", "#REF!", "#CONNECT!"):
        return None
    return s[:10] if len(s) >= 10 else None


def find_main_sheet(wb) -> str | None:
    """메인 데이터 시트 찾기 (● 로 시작)"""
    for name in wb.sheetnames:
        if name.startswith("●"):
            return name
    return None


def parse_schedule(filepath: Path, season: str) -> list[dict]:
    """생산스케줄 엑셀을 파싱하여 레코드 리스트 반환"""
    # 파일 잠김 방지: 임시 복사
    import shutil
    import tempfile
    tmp = Path(tempfile.gettempdir()) / f"schedule_{season}.xlsx"
    shutil.copy2(filepath, tmp)

    wb = openpyxl.load_workbook(tmp, read_only=True, data_only=True)
    sheet_name = find_main_sheet(wb)
    if not sheet_name:
        log(f"  [ERROR] 메인 시트(●) 없음: {filepath.name}")
        wb.close()
        return []

    ws = wb[sheet_name]
    log(f"  시트: {sheet_name}")

    records = []
    for i, row in enumerate(ws.iter_rows(min_row=10, values_only=True)):
        if not row or len(row) < 28:
            continue

        status = str(row[0] or "").strip()  # A: 입고여부
        style_no = str(row[5] or "").strip()  # F: STYLE NO.
        if not style_no:
            continue

        # 캔슬 제외
        if status == "캔슬":
            continue

        style_name = str(row[7] or "").strip()  # H: STYLE NAME
        color = str(row[8] or "").strip()  # I: COLOR
        pcs = row[9]  # J: PCS
        supplier = str(row[10] or "").strip()  # K: 생산처
        staff = str(row[11] or "").strip() if len(row) > 11 else ""  # L: 담당자
        supplier_eta = fmt_date(row[12]) if len(row) > 12 else None  # M: 협력사 협의납기
        eta = fmt_date(row[26]) if len(row) > 26 else None  # AA: 입고예정일
        actual_dt = fmt_date(row[27]) if len(row) > 27 else None  # AB: 실입고일
        remark = str(row[33] or "").strip() if len(row) > 33 else ""  # AH: MD 납기 히스토리
        spot = str(row[4] or "").strip() if len(row) > 4 else ""  # E: SPOT/RE-ORDER
        item_code = str(row[29] or "").strip() if len(row) > 29 else ""  # AD: 복종

        # PCS 정리
        try:
            pcs_num = int(float(pcs)) if pcs else 0
        except (ValueError, TypeError):
            pcs_num = 0

        records.append({
            "season": season,
            "status": status,
            "style_no": style_no,
            "style_name": style_name,
            "color": color,
            "pcs": pcs_num,
            "supplier": supplier,
            "staff": staff,
            "spot": spot,
            "supplier_eta": supplier_eta,
            "eta": eta,
            "actual_dt": actual_dt,
            "remark": remark,
            "item_code": item_code,
        })

    wb.close()
    return records


def main():
    log("=" * 60)
    log("생산스케줄 엑셀 동기화 시작")
    log("=" * 60)

    all_records = []

    for season, filepath in EXCEL_FILES.items():
        log(f"\n[{season}] {filepath.name}")
        if not filepath.exists():
            log(f"  [SKIP] 파일 없음")
            continue

        records = parse_schedule(filepath, season)
        log(f"  파싱 완료: {len(records)}건")
        all_records.extend(records)

    if all_records:
        out = DATA_DIR / "duvetica_schedule.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(all_records, f, ensure_ascii=False)
        size_kb = out.stat().st_size / 1024
        log(f"\n저장: duvetica_schedule.json ({size_kb:.0f} KB, {len(all_records)} rows)")

    log("\n" + "=" * 60)
    log("동기화 완료!")
    log("=" * 60)


if __name__ == "__main__":
    main()
