"""
26SS 시즌 캐시 데이터 일괄 갱신 스크립트
- 대상: order_inbound, cost, season_sale (V, ST)
- 24FW~25FW 확정 데이터는 건드리지 않음
"""
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

CACHE_DIR = Path(__file__).parent.parent / "download" / "kg_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

CLI = "dcs-ai-cli"


def run_cli(endpoint: str, body: dict, output_path: Path, label: str):
    """dcs-ai-cli로 KG API 호출 후 파일 저장"""
    body_json = json.dumps(body, ensure_ascii=False)
    cmd = [
        CLI, "fetch",
        "--endpoint", endpoint,
        "--method", "POST",
        "--body", body_json,
        "--output", str(output_path),
    ]
    print(f"[{label}] 호출 중... → {output_path.name}")
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(f"  [FAIL] 실패: {result.stderr[:300]}")
        return False
    # 파일 크기 확인
    if output_path.exists():
        size_kb = output_path.stat().st_size / 1024
        # row 수 확인
        try:
            data = json.loads(output_path.read_text(encoding="utf-8"))
            rows = data.get("data", data) if isinstance(data, dict) else data
            n = len(rows) if isinstance(rows, list) else "?"
        except Exception:
            n = "?"
        print(f"  [OK] 완료: {size_kb:,.1f}KB, {n}건")
        return True
    else:
        print(f"  [FAIL] 파일 미생성")
        return False


# ──────────────────────────────────────────
# 1. Order/Inbound 26SS
# ──────────────────────────────────────────
def build_order_inbound_body(brd_cd: str, sesn_running: str = "26S") -> dict:
    today = datetime.date.today().isoformat()
    return {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM"},
            {"system_field_name": "ITEM_GROUP"},
            {"system_field_name": "SESN"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "MFAC_COMPY_NM"},
            {"system_field_name": "ORIGIN_NM"},
            {"system_field_name": "INDC_DT_CNFM"},
            {"system_field_name": "INDC_DT_REQ"},
            {"system_field_name": "ORD_TYPE"},
            {"system_field_name": "SESN_RUNNING"},
        ],
        "selectors_sku": [
            {"system_field_name": "COLOR_CD"},
            {"system_field_name": "SIZE_CD"},
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
            {"system_code": sesn_running, "system_field_name": "SESN_RUNNING"},
        ],
        "periods_order": {
            "start_dt": "2025-01-01",
            "end_dt": "2026-12-31",
        },
        "periods_inbound": {
            "start_dt": "2025-01-01",
            "end_dt": today,
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }


# ──────────────────────────────────────────
# 2. Cost 26SS
# ──────────────────────────────────────────
def build_cost_body(brd_cd: str) -> dict:
    return {
        "selectors_product": [
            {"system_field_name": "BRD_CD"},
            {"system_field_name": "SESN"},
            {"system_field_name": "PRDT_CD"},
            {"system_field_name": "PRDT_NM"},
            {"system_field_name": "ITEM"},
            {"system_field_name": "ITEM_GROUP"},
            {"system_field_name": "TAG_PRICE"},
        ],
        "selectors_cost": [
            {"system_field_name": "MFAC_COST_QUOTATION_STAT_NM"},
            {"system_field_name": "MFAC_COST_SUPPLIER_OFFER_COST_AMT"},
            {"system_field_name": "MFAC_COST_SUPPLIER_NEGO_COST_AMT"},
            {"system_field_name": "MFAC_COST_MFAC_COST_AMT"},
            {"system_field_name": "MFAC_COST_MARKUP"},
            {"system_field_name": "MFAC_COST_TAG_AMT"},
            {"system_field_name": "MFAC_COST_EXCHAGE_RATE"},
        ],
        "selectors_cost_account": [
            {"system_field_name": "MFAC_COST_ACCOUNT_TYPE1_NM"},
            {"system_field_name": "MFAC_COST_ACCOUNT_TYPE2_NM"},
            {"system_field_name": "MFAC_COST_UNIT_COST"},
            {"system_field_name": "MFAC_COST_COST_AMT"},
        ],
        "selectors_order": [
            {"system_field_name": "PO_NO"},
            {"system_field_name": "PO_CNTRY_NM"},
            {"system_field_name": "MFAC_COMPY_NM"},
        ],
        "filters_product": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "filters_order": [
            {"system_code": "26S", "system_field_name": "SESN_RUNNING"},
        ],
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }


# ──────────────────────────────────────────
# 3. Season Sale 26SS (발입출판재)
# ──────────────────────────────────────────
def build_season_sale_body(brd_cd: str) -> dict:
    return {
        "selectors": [
            {"system_field_name": "BRD_CD"},
        ],
        "filters": [
            {"system_code": brd_cd, "system_field_name": "BRD_CD"},
        ],
        "current_season_period_filters": {
            "sesn": "26S",
            "term_start_dt": "2026-04-06",
            "term_end_dt": "2026-04-12",
            "acum_end_dt": "2026-04-12",
        },
        "previous_season_period_filters": {
            "sesn": "25S",
            "term_start_dt": "2025-04-07",
            "term_end_dt": "2025-04-13",
            "acum_end_dt": "2025-04-13",
            "season_end_dt": "2025-08-31",
        },
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }


# ──────────────────────────────────────────
# 실행
# ──────────────────────────────────────────
def main():
    results = []

    brands = [
        ("V", "duvetica"),
        ("ST", "sergio"),
    ]

    print("=" * 60)
    print("26SS 시즌 캐시 데이터 갱신 시작")
    print("대상: Order/Inbound, Cost, Season Sale")
    print("브랜드: DUVETICA(V), SERGIO TACCHINI(ST)")
    print("=" * 60)

    for brd_cd, prefix in brands:
        print(f"\n--- {prefix.upper()} ({brd_cd}) ---")

        # Order/Inbound
        ok = run_cli(
            "/api/v1/hq/scm/order_inbound_status",
            build_order_inbound_body(brd_cd),
            CACHE_DIR / f"{prefix}_26s_order_inbound.json",
            f"{prefix} order_inbound 26S",
        )
        results.append((f"{prefix}_26s_order_inbound", ok))

        # Cost
        ok = run_cli(
            "/api/v1/hq/scm/product_po_manufacturing_cost",
            build_cost_body(brd_cd),
            CACHE_DIR / f"{prefix}_26s_cost.json",
            f"{prefix} cost 26S",
        )
        results.append((f"{prefix}_26s_cost", ok))

        # Season Sale
        ok = run_cli(
            "/api/v1/hq/sales_analysis/product/season_wear_order_stor_sale_stock",
            build_season_sale_body(brd_cd),
            CACHE_DIR / f"{prefix}_season_sale.json",
            f"{prefix} season_sale 26S",
        )
        results.append((f"{prefix}_season_sale", ok))

    # 결과 요약
    print("\n" + "=" * 60)
    print("갱신 결과 요약")
    print("=" * 60)
    success = sum(1 for _, ok in results if ok)
    fail = sum(1 for _, ok in results if not ok)
    for name, ok in results:
        status = "[OK]" if ok else "[FAIL]"
        print(f"  {status} {name}")
    print(f"\n총 {len(results)}건 중 성공 {success}건, 실패 {fail}건")

    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
