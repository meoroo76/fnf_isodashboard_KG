"""
26SS 미입고 스타일 + 입고예정일 추출
엑셀 ● 2026 02 05 시트에서 실입고일(AB)이 없는 스타일의 ETA(AA) 추출
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
EXCEL_PATH = PROJECT_ROOT / "src" / "input" / "26SS_DV_schedule.xlsx"
JSON_PATH = PROJECT_ROOT / "frontend" / "public" / "data" / "duvetica_26s_pending_arrival.json"
SHEET_NAME = "● 2026 02 05"

DATA_START = 10


def extract_pending():
    print(f"Reading: {EXCEL_PATH.name}")
    wb = openpyxl.load_workbook(str(EXCEL_PATH), data_only=True)
    ws = wb[SHEET_NAME]

    pending = []
    for row in range(DATA_START, ws.max_row + 1):
        style_no = ws.cell(row=row, column=6).value  # F: STYLE NO.
        if not style_no:
            continue

        arrival_yn = ws.cell(row=row, column=1).value  # A: 입고여부
        actual_dt = ws.cell(row=row, column=28).value   # AB: 실입고일
        eta = ws.cell(row=row, column=27).value          # AA: 입고 예정일

        # 이미 입고 완료 건너뛰기
        if arrival_yn == "종결" or actual_dt:
            continue

        eta_str = eta.strftime("%Y-%m-%d") if isinstance(eta, datetime) else (str(eta) if eta else None)

        # PART_CD 계산 (STYLE NO에서 추출)
        sn = str(style_no).replace("-리오더", "").replace("-REORDER", "")
        item_type = sn[2:4] if len(sn) > 3 else ""

        pending.append({
            "style_no": str(style_no),
            "style_name": ws.cell(row=row, column=8).value or "",
            "color": (ws.cell(row=row, column=9).value or "").strip(),
            "pcs": ws.cell(row=row, column=10).value or 0,
            "supplier": ws.cell(row=row, column=11).value or "",
            "staff": ws.cell(row=row, column=12).value or "",
            "eta": eta_str,
            "is_m": ws.cell(row=row, column=3).value or 0,
            "item_type": item_type,
            "category": ws.cell(row=row, column=31).value or "",
            "spot": ws.cell(row=row, column=5).value or "",
        })

    output = {
        "meta": {
            "source": EXCEL_PATH.name,
            "synced_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "count": len(pending),
        },
        "data": pending,
    }

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"Saved: {JSON_PATH.name} ({len(pending)} pending styles)")
    return output


if __name__ == "__main__":
    extract_pending()
