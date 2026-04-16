"""
대시보드 데이터 자동 업데이트 스크립트
KG API → JSON 생성 → frontend/public/data/ 저장 → git push

사용법:
  PYTHONPATH=. .venv/Scripts/python src/service/update_dashboard_data.py
  PYTHONPATH=. .venv/Scripts/python src/service/update_dashboard_data.py --no-push   # git push 생략
  PYTHONPATH=. .venv/Scripts/python src/service/update_dashboard_data.py --dry-run    # API 호출 없이 구조만 확인
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import glob
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# ── 설정 ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "frontend" / "public" / "data"
TMPDIR = Path(tempfile.gettempdir()) / "dcs-ai-cli"

BRANDS = {
    "V": "duvetica",
    "ST": "sergio",
}

# 운영 시즌 (업데이트 대상) - 현재 + 전년 동기간
ACTIVE_SEASONS = ["26S", "26F"]  # 26SS, 26FW
PREV_SEASONS = {"26S": "25S", "26F": "25F"}  # 전년 동기간 매핑


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    try:
        print(f"[{ts}] {msg}")
    except UnicodeEncodeError:
        print(f"[{ts}] {msg.encode('ascii', errors='replace').decode('ascii')}")


def call_cli(endpoint: str, method: str, body: dict, name: str) -> Path | None:
    """dcs-ai-cli로 KG API 호출 후 저장된 파일 경로 반환"""
    cmd = [
        "dcs-ai-cli", "fetch",
        "--endpoint", endpoint,
        "--method", method,
        "--body", json.dumps(body, ensure_ascii=False),
        "--name", name,
    ]
    log(f"  API 호출: {name} → {endpoint}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            log(f"  [ERROR] {name}: {result.stderr.strip()}")
            return None
    except subprocess.TimeoutExpired:
        log(f"  [ERROR] {name}: 타임아웃 (120초)")
        return None

    # 저장된 파일 찾기 (최신)
    pattern = str(TMPDIR / f"{name}_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        log(f"  [ERROR] {name}: 저장 파일 없음")
        return None
    return Path(files[-1])


def extract_data(filepath: Path) -> list:
    """JSON 파일에서 data 배열 추출"""
    with open(filepath, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        d = raw.get("data", raw)
        if isinstance(d, list):
            return d
        if isinstance(d, dict) and "data" in d:
            return d["data"] if isinstance(d["data"], list) else []
    return []


def save_json(data, filename: str, protect_existing: bool = True):
    """frontend/public/data/에 JSON 저장

    protect_existing=True: API가 빈 데이터를 반환했을 때 기존 파일을 보호
    """
    out = DATA_DIR / filename
    if protect_existing and isinstance(data, list) and len(data) == 0 and out.exists():
        existing_size = out.stat().st_size
        if existing_size > 10:  # 기존 파일에 데이터가 있으면 덮어쓰지 않음
            log(f"  [SKIP] 건너뜀: {filename} - API 0건 반환, 기존 데이터 보호 ({existing_size / 1024:.0f} KB)")
            return
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    size_kb = out.stat().st_size / 1024
    log(f"  저장: {filename} ({size_kb:.0f} KB, {len(data) if isinstance(data, list) else '-'} rows)")


# ── 데이터 수집 함수들 ──

def update_order_inbound(brd_cd: str, brand_name: str, season: str):
    """발주/입고 현황 업데이트"""
    body = {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM_GROUP"},
            {"system_field_name": "ITEM"},
            {"system_field_name": "PART_CD"},
        ],
        "selectors_sku": [
            {"system_field_name": "COLOR_CD"},
            {"system_field_name": "SIZE_CD"},
        ],
        "selectors_order": [
            {"system_field_name": "SESN_RUNNING"},
            {"system_field_name": "PO_NO"},
            {"system_field_name": "PO_CNTRY_NM"},
            {"system_field_name": "MFAC_COMPY_NM"},
            {"system_field_name": "INDC_DT_REQ"},
            {"system_field_name": "INDC_DT_CNFM"},
        ],
        "metrics_order": [
            {"system_field_name": "ORD_QTY"},
            {"system_field_name": "ORD_TAG_AMT"},
            {"system_field_name": "STOR_QTY"},
            {"system_field_name": "STOR_TAG_AMT"},
        ],
        "filters_product": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "filters_order": [
            {"system_code": season, "system_field_name": "SESN_RUNNING"},
        ],
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_{season.lower()}_order_inbound"
    filepath = call_cli("/api/v1/hq/scm/order_inbound_status", "POST", body, name)
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_{season.lower()}_order_inbound.json")


def update_claims(brd_cd: str, brand_name: str):
    """클레임 전체 업데이트 (전 시즌 포함)"""
    today = datetime.now().strftime("%Y-%m-%d")
    two_years_ago = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

    body = {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM_GROUP"},
        ],
        "selectors_channel": [
            {"system_field_name": "CHANNEL_TYPE"},
            {"system_field_name": "SHOP_NM"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "MFAC_COMPY_NM"},
        ],
        "selectors_claim": [
            {"system_field_name": "CLAIM_CLS_NM"},
            {"system_field_name": "CLAIM_ERR_CLS_NM"},
            {"system_field_name": "CLAIM_CONTS_ANAL_GROUP_NM"},
            {"system_field_name": "CLAIM_RSLT_ANAL_NM"},
        ],
        "metrics": [
            {"system_field_name": "CLAIM_QTY"},
        ],
        "filters_product": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "periods": {
            "start_dt": two_years_ago,
            "end_dt": today,
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_claims"
    filepath = call_cli("/api/v1/hq/cs/claim_receipt", "POST", body, name)
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_claims.json")


def update_cost(brd_cd: str, brand_name: str, season: str):
    """원가 마스터 업데이트"""
    body = {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM_GROUP"},
            {"system_field_name": "ITEM"},
            {"system_field_name": "TAG_PRICE"},
        ],
        "selectors_cost": [
            {"system_field_name": "MFAC_COST_MFAC_COST_AMT"},
            {"system_field_name": "MFAC_COST_MARKUP"},
            {"system_field_name": "MFAC_COST_TAG_AMT"},
            {"system_field_name": "MFAC_COST_EXCHAGE_RATE"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "MFAC_COMPY_NM"},
        ],
        "filters_product": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
            {"system_code": season, "system_field_name": "SESN"},
        ],
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_{season.lower()}_cost"
    filepath = call_cli("/api/v1/hq/scm/product_po_manufacturing_cost", "POST", body, name)
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_{season.lower()}_cost.json")


def update_voc(brd_cd: str, brand_name: str):
    """매장 VOC 업데이트 (최근 90일)"""
    today = datetime.now().strftime("%Y-%m-%d")
    ninety_days_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    body = {
        "filters": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "periods": {
            "start_dt": ninety_days_ago,
            "end_dt": today,
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_voc"
    filepath = call_cli("/api/v1/hq/voc/shop_voc", "POST", body, name)
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_voc.json")


def update_inbound_daily(brd_cd: str, brand_name: str, season: str):
    """일자별 칼라x사이즈 입고 데이터 (DW_STOR) - 증분 업데이트"""
    filename = f"{brand_name}_{season.lower()}_inbound_daily.json"
    daily_file = DATA_DIR / filename
    today_str = datetime.now().strftime("%Y-%m-%d")

    # 기존 파일에서 최신 날짜 확인
    existing: list = []
    last_dt = ""
    if daily_file.exists():
        with open(daily_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
        if isinstance(existing, dict) and "data" in existing:
            existing = existing["data"]
        if existing:
            last_dt = max(r.get("STOR_DT", "") for r in existing)
            log(f"  기존 데이터: {len(existing)}건, 최신 {last_dt}")

    if not last_dt:
        # 최초 실행: 시즌 시작일부터 전체 조회
        year = 2000 + int(season[:2])
        is_fw = season.upper().endswith("F")
        start_dt = f"{year}-07-01" if is_fw else f"{year - 1}-12-01"
        log(f"  최초 실행: {start_dt}~{today_str} 전체 조회")
    else:
        # 증분: 최신 날짜 다음 날부터 (같은 날도 재조회하여 당일 추가분 반영)
        start_dt = last_dt
        if start_dt >= today_str:
            log(f"  이미 최신 ({last_dt}) - 스킵")
            return
        # 기존 데이터에서 start_dt 이후 삭제 (재조회 대상)
        existing = [r for r in existing if r.get("STOR_DT", "") < start_dt]
        log(f"  증분: {start_dt}~{today_str} 조회")

    sql = (
        f"SELECT STOR_DT, PRDT_CD, PART_CD, COLOR_CD, SIZE_CD, PO_NO, QTY "
        f"FROM DW_STOR "
        f"WHERE BRD_CD = '{brd_cd}' AND SESN = '{season}' "
        f"AND QTY > 0 AND RET_YN = false "
        f"AND STOR_DT >= '{start_dt}' AND STOR_DT <= '{today_str}' "
        f"ORDER BY STOR_DT, PRDT_CD, COLOR_CD, SIZE_CD"
    )
    body = {
        "sql": sql,
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_{season.lower()}_inbound_daily"
    filepath = call_cli("/api/v1/hq/search/data_from_snowflake_query", "POST", body, name)
    if filepath:
        new_rows = extract_data(filepath)
        all_rows = existing + new_rows
        save_json(all_rows, filename)


def update_season_sale(brd_cd: str, brand_name: str, season: str):
    """시즌 발입출판재 업데이트 (판매금액 KPI용)"""
    year = 2000 + int(season[:2])
    is_fw = season.upper().endswith("F")
    prev_season = f"{int(season[:2]) - 1:02d}{season[2:]}"

    # 날짜 계산 (동요일 기준)
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    # 전주 월~일
    this_monday = today - timedelta(days=(today.weekday()))
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    # 전년 동요일
    prev_last_monday = last_monday - timedelta(days=364)
    prev_last_sunday = last_sunday - timedelta(days=364)
    prev_yesterday = yesterday - timedelta(days=364)

    # 전년 시즌 마감일 조회
    cmd = [
        "dcs-ai-cli", "fetch",
        "--endpoint", f"/api/v1/common/date_util/sale_end_date_product_season?sesn={prev_season}",
        "--name", f"{brand_name}_season_end",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        pattern = str(TMPDIR / f"{brand_name}_season_end_*.json")
        files = sorted(glob.glob(pattern))
        if files:
            raw = json.loads(Path(files[-1]).read_text(encoding="utf-8"))
            season_end = raw.get("data", {}).get("data", "")
            if isinstance(season_end, dict):
                season_end = season_end.get("data", "")
        else:
            season_end = ""
    except Exception:
        season_end = ""

    if not season_end:
        # fallback: SS=8/31, FW=2/28
        season_end = f"{year}-02-28" if is_fw else f"{year - 1 + 1}-08-31"

    body = {
        "selectors": [
            {"system_field_name": "BRD_CD"},
        ],
        "filters": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "current_season_period_filters": {
            "sesn": season,
            "term_start_dt": last_monday.strftime("%Y-%m-%d"),
            "term_end_dt": last_sunday.strftime("%Y-%m-%d"),
            "acum_end_dt": yesterday.strftime("%Y-%m-%d"),
        },
        "previous_season_period_filters": {
            "sesn": prev_season,
            "term_start_dt": prev_last_monday.strftime("%Y-%m-%d"),
            "term_end_dt": prev_last_sunday.strftime("%Y-%m-%d"),
            "acum_end_dt": prev_yesterday.strftime("%Y-%m-%d"),
            "season_end_dt": season_end,
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_{season.lower()}_season_sale"
    filepath = call_cli(
        "/api/v1/hq/sales_analysis/product/season_wear_order_stor_sale_stock",
        "POST", body, name,
    )
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_{season.lower()}_season_sale.json")


def update_inbound_booking(brd_cd: str, brand_name: str, season: str):
    """물류 입고 부킹 현황 업데이트 (시즌 전체 기간)"""
    # SS 시즌: 전년 12/1 ~ 오늘, FW 시즌: 당해 7/1 ~ 오늘
    year = 2000 + int(season[:2])
    is_fw = season.upper().endswith("F")
    start_dt = f"{year}-07-01" if is_fw else f"{year - 1}-12-01"
    today = datetime.now().strftime("%Y-%m-%d")

    body = {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PART_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM_GROUP"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "SESN_RUNNING"},
            {"system_field_name": "MFAC_COMPY_NM"},
            {"system_field_name": "PO_CNTRY_NM"},
        ],
        "metrics_stor_estm": [
            {"system_field_name": "STOR_QTY_ESTM"},
            {"system_field_name": "BOX_QTY"},
        ],
        "filters_product": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "filters_order": [
            {"system_code": season, "system_field_name": "SESN_RUNNING"},
            {"system_code": "한국", "system_field_name": "PO_CNTRY_NM"},
        ],
        "periods_stor_estm": {
            "start_dt": start_dt,
            "end_dt": today,
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }
    name = f"{brand_name}_{season.lower()}_inbound_booking"
    filepath = call_cli("/api/v1/hq/scm/inbound_booking_status", "POST", body, name)
    if filepath:
        rows = extract_data(filepath)
        save_json(rows, f"{brand_name}_{season.lower()}_inbound_booking.json")


def update_product_images():
    """전 브랜드 대표이미지 매핑 업데이트"""
    img_map = {}
    for brd_cd, brand_name in BRANDS.items():
        body = {
            "filters": [
                {"system_code": brd_cd, "system_field_name": "BRD_CD"},
            ],
            "meta_info": {
                "data_size_only": False,
                "data_type": "list",
                "requested_record_rows": 20000,
            },
        }
        name = f"{brand_name}_prdt_img"
        filepath = call_cli("/api/v1/hq/search/product_codes_properties", "POST", body, name)
        if filepath:
            rows = extract_data(filepath)
            for row in rows:
                prdt_cd = row.get("PRDT_CD", "")
                img_url = row.get("PRDT_IMG_URL")
                if prdt_cd and img_url:
                    img_map[prdt_cd] = img_url

    if img_map:
        save_json(img_map, "prdt_img_map.json")
        log(f"  이미지 매핑: {len(img_map)}개 스타일")


def git_commit_and_push(no_push: bool = False):
    """변경사항 git commit & push"""
    os.chdir(PROJECT_ROOT)

    # 변경 확인
    result = subprocess.run(
        ["git", "diff", "--name-only", "frontend/public/data/"],
        capture_output=True, text=True,
    )
    changed = [f for f in result.stdout.strip().split("\n") if f]

    result2 = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard", "frontend/public/data/"],
        capture_output=True, text=True,
    )
    untracked = [f for f in result2.stdout.strip().split("\n") if f]

    all_files = changed + untracked
    if not all_files:
        log("변경된 데이터 파일 없음 - 커밋 생략")
        return

    log(f"변경 파일: {len(all_files)}개")
    for f in all_files:
        log(f"  - {f}")

    # git add & commit
    subprocess.run(["git", "add"] + all_files, check=True)
    today_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    subprocess.run(
        ["git", "commit", "-m", f"chore: 대시보드 데이터 자동 업데이트 ({today_str})"],
        check=True,
    )
    log("커밋 완료")

    if no_push:
        log("--no-push 옵션으로 push 생략")
        return

    subprocess.run(["git", "push", "origin", "main"], check=True)
    log("push 완료 → Vercel 자동 배포 시작")


def main():
    parser = argparse.ArgumentParser(description="대시보드 데이터 자동 업데이트")
    parser.add_argument("--no-push", action="store_true", help="git push 생략")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 구조만 확인")
    parser.add_argument("--only", choices=["order", "claims", "cost", "voc", "images", "inbound", "inbound-daily", "sale", "excel"], help="특정 데이터만 업데이트")
    args = parser.parse_args()

    all_seasons = ACTIVE_SEASONS + list(PREV_SEASONS.values())

    log("=" * 60)
    log("대시보드 데이터 자동 업데이트 시작")
    log(f"운영 시즌: {', '.join(ACTIVE_SEASONS)}")
    log(f"전년 동기간: {', '.join(PREV_SEASONS.values())}")
    log(f"대상 브랜드: {', '.join(f'{v}({k})' for k, v in BRANDS.items())}")
    log("=" * 60)

    if args.dry_run:
        log("[DRY RUN] API 호출 없이 종료")
        return

    for brd_cd, brand_name in BRANDS.items():
        log(f"\n{'='*40}")
        log(f"브랜드: {brand_name} ({brd_cd})")
        log(f"{'='*40}")

        # ── 시즌별 데이터 (운영 + 전년) ──
        for season in all_seasons:
            tag = f"{brand_name}/{season}"

            # 1. 발주/입고 현황 (전체 재조회 - 소량)
            if not args.only or args.only == "order":
                log(f"\n[1] 발주/입고 ({tag})")
                update_order_inbound(brd_cd, brand_name, season)

            # 2. 원가 (전체 재조회 - 소량)
            if not args.only or args.only == "cost":
                log(f"\n[2] 원가 ({tag})")
                update_cost(brd_cd, brand_name, season)

            # 3. 물류 입고 부킹 (전체 재조회 - 소량)
            if not args.only or args.only == "inbound":
                log(f"\n[3] 물류 입고 부킹 ({tag})")
                update_inbound_booking(brd_cd, brand_name, season)

            # 4. 일자별 입고 상세 DW_STOR (증분 업데이트 - 대량)
            if not args.only or args.only == "inbound-daily":
                log(f"\n[4] 일자별 입고 상세 ({tag})")
                update_inbound_daily(brd_cd, brand_name, season)

        # ── 시즌 무관 데이터 ──

        # 5. 클레임 (전체 재조회)
        if not args.only or args.only == "claims":
            log(f"\n[5] 클레임 (전체)")
            update_claims(brd_cd, brand_name)

        # 6. 매장 VOC (최근 90일)
        if not args.only or args.only == "voc":
            log(f"\n[6] 매장 VOC (최근 90일)")
            update_voc(brd_cd, brand_name)

        # 7. 시즌 판매 (운영 시즌만 - 전년비 포함)
        for season in ACTIVE_SEASONS:
            if not args.only or args.only == "sale":
                log(f"\n[7] 시즌 판매 ({brand_name}/{season})")
                update_season_sale(brd_cd, brand_name, season)

    # 8. 이미지 매핑 - 전 브랜드 통합
    if not args.only or args.only == "images":
        log(f"\n[8] 제품 이미지 매핑")
        update_product_images()

    # 9. 엑셀 생산스케줄 동기화 (26FW ORDER LIST + 26SS 미입고 예정)
    if not args.only or args.only == "excel":
        log(f"\n[9] 엑셀 생산스케줄 동기화")
        try:
            from src.service.sync_fw_orderlist import excel_to_json
            excel_to_json()
        except Exception as e:
            log(f"  [ERROR] 26FW 엑셀 동기화 실패: {e}")
        try:
            from src.service.sync_ss_pending import extract_pending
            extract_pending()
        except Exception as e:
            log(f"  [ERROR] 26SS 미입고 예정 추출 실패: {e}")

    # ── git commit & push ──
    log(f"\n{'='*40}")
    log("Git 커밋 & 푸시")
    log(f"{'='*40}")
    git_commit_and_push(no_push=args.no_push)

    log("\n" + "=" * 60)
    log("업데이트 완료!")
    log("=" * 60)


if __name__ == "__main__":
    main()
