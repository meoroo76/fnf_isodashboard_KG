"""
26FW 시즌 캐시 데이터 일괄 조회 스크립트
- SESN_RUNNING=26F 기준으로 KG에서 조회
- 대상: order_inbound, cost (V, ST)
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
    print(f"[{label}] ...", end=" ", flush=True)
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(f"[FAIL] {result.stderr[:200]}")
        return False
    if output_path.exists():
        size_kb = output_path.stat().st_size / 1024
        try:
            data = json.loads(output_path.read_text(encoding="utf-8"))
            rows = data.get("data", data) if isinstance(data, dict) else data
            n = len(rows) if isinstance(rows, list) else "?"
        except Exception:
            n = "?"
        print(f"[OK] {size_kb:,.1f}KB, {n}rows")
        return True
    print("[FAIL] no file")
    return False


def build_order_inbound_body(brd_cd: str) -> dict:
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
            {"system_code": "26F", "system_field_name": "SESN_RUNNING"},
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
            {"system_code": "26F", "system_field_name": "SESN_RUNNING"},
        ],
        "meta_info": {
            "data_size_only": False,
            "data_type": "list",
            "requested_record_rows": 20000,
        },
    }


def main():
    results = []
    brands = [("V", "duvetica"), ("ST", "sergio")]

    print("=" * 60)
    print("26FW cache data fetch (SESN_RUNNING=26F)")
    print("=" * 60)

    for brd_cd, prefix in brands:
        print(f"\n--- {prefix.upper()} ({brd_cd}) ---")

        ok = run_cli(
            "/api/v1/hq/scm/order_inbound_status",
            build_order_inbound_body(brd_cd),
            CACHE_DIR / f"{prefix}_26f_order_inbound.json",
            f"{prefix} order_inbound 26F",
        )
        results.append((f"{prefix}_26f_order_inbound", ok))

        ok = run_cli(
            "/api/v1/hq/scm/product_po_manufacturing_cost",
            build_cost_body(brd_cd),
            CACHE_DIR / f"{prefix}_26f_cost.json",
            f"{prefix} cost 26F",
        )
        results.append((f"{prefix}_26f_cost", ok))

    print("\n" + "=" * 60)
    success = sum(1 for _, ok in results if ok)
    fail = sum(1 for _, ok in results if not ok)
    for name, ok in results:
        print(f"  {'[OK]' if ok else '[FAIL]'} {name}")
    print(f"\nTotal: {len(results)}, OK: {success}, FAIL: {fail}")

    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
