"""모든 페이지 모듈 import 테스트"""
import sys
import traceback

modules = [
    "src.core.config",
    "src.core.data_loader",
    "src.core.kg_client",
    "src.core.gsheet_client",
    "src.service.common.components",
    "src.service.common.custom_css",
    "src.service.production_status.pages.order_dashboard",
    "src.service.production_status.pages.delivery_mgmt",
    "src.service.production_status.pages.supplier_input",
    "src.service.production_status.pages.report_gen",
    "src.service.cost_management.pages.cost_overview",
    "src.service.cost_management.pages.cost_breakdown",
    "src.service.cost_management.pages.markup_analysis",
    "src.service.cost_management.pages.season_compare",
    "src.service.quality.pages.claim_dashboard",
    "src.service.quality.pages.defect_analysis",
    "src.service.quality.pages.qc_results",
    "src.service.quality.pages.voc_analysis",
    "src.service.supplier.pages.scorecard",
    "src.service.supplier.pages.ranking",
    "src.service.supplier.pages.detail_panel",
    "src.service.supplier.pages.evaluation",
]

ok = 0
fail = 0
errors = []

for mod in modules:
    try:
        __import__(mod)
        print(f"  OK  {mod}")
        ok += 1
    except Exception as e:
        print(f"  FAIL {mod}: {e}")
        errors.append((mod, traceback.format_exc()))
        fail += 1

print(f"\n{'='*50}")
print(f"Results: {ok} OK, {fail} FAIL / {len(modules)} total")

if errors:
    print(f"\n{'='*50}")
    print("ERRORS:")
    for mod, tb in errors:
        print(f"\n--- {mod} ---")
        print(tb)
