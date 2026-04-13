"""16개 페이지 자동 탐색 + 에러 수집 (Playwright)"""
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8514"
OUTPUT_DIR = "src/output"

PAGES = [
    "order_dashboard", "delivery_mgmt", "supplier_input", "report_gen",
    "cost_overview", "cost_breakdown", "markup_analysis", "season_compare",
    "claim_dashboard", "defect_analysis", "qc_results", "voc_analysis",
    "scorecard", "ranking", "detail_panel", "evaluation",
]

def test_all_pages():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})

        # 콘솔 에러 수집
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        for idx, page_key in enumerate(PAGES):
            print(f"[{idx+1}/{len(PAGES)}] Testing: {page_key}...", end=" ")
            console_errors.clear()

            try:
                # 첫 페이지: 직접 접속
                if idx == 0:
                    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
                    time.sleep(5)

                # 사이드바 메뉴 클릭으로 페이지 이동
                nav_btn = page.locator(f'button:has-text("{get_label(page_key)}")')
                if nav_btn.count() > 0:
                    nav_btn.first.click()
                    time.sleep(4)

                # 에러 메시지 감지
                error_elements = page.locator('div.stAlert, [data-testid="stException"]')
                errors_found = []
                for i in range(error_elements.count()):
                    text = error_elements.nth(i).inner_text()
                    if text.strip():
                        errors_found.append(text[:300])

                # 스크린샷
                page.screenshot(path=f"{OUTPUT_DIR}/page_{idx+1:02d}_{page_key}.png")

                status = "ERROR" if errors_found else "OK"
                print(f"{status} {'| ' + errors_found[0][:80] if errors_found else ''}")

                results.append({
                    "page": page_key,
                    "status": status,
                    "errors": errors_found,
                    "console_errors": console_errors.copy(),
                })

            except Exception as e:
                print(f"CRASH: {e}")
                results.append({
                    "page": page_key,
                    "status": "CRASH",
                    "errors": [str(e)],
                })

        browser.close()

    # 결과 저장
    with open(f"{OUTPUT_DIR}/test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 요약 출력
    ok = sum(1 for r in results if r["status"] == "OK")
    err = sum(1 for r in results if r["status"] == "ERROR")
    crash = sum(1 for r in results if r["status"] == "CRASH")
    print(f"\n=== Summary: OK={ok} ERROR={err} CRASH={crash} / {len(results)} ===")

    for r in results:
        if r["status"] != "OK":
            print(f"  {r['status']} {r['page']}: {r['errors'][0][:100] if r['errors'] else 'no detail'}")

    return results


def get_label(page_key):
    labels = {
        "order_dashboard": "오더 현황", "delivery_mgmt": "납기 관리",
        "supplier_input": "데이터 입력", "report_gen": "리포트",
        "cost_overview": "원가 총괄", "cost_breakdown": "원가 구성",
        "markup_analysis": "마크업 분석", "season_compare": "시즌 비교",
        "claim_dashboard": "클레임 현황", "defect_analysis": "불량 분석",
        "qc_results": "검사 결과", "voc_analysis": "매장 VOC",
        "scorecard": "스코어카드", "ranking": "랭킹",
        "detail_panel": "상세 분석", "evaluation": "평가 입력",
    }
    return labels.get(page_key, page_key)


if __name__ == "__main__":
    test_all_pages()
