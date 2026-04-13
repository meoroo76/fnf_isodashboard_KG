"""16개 페이지 Playwright 자동 테스트 v2"""
import sys, os, time, json
os.environ["PYTHONIOENCODING"] = "utf-8"

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8514"

NAV_KEYS = [
    "order_dashboard", "delivery_mgmt", "supplier_input", "report_gen",
    "cost_overview", "cost_breakdown", "markup_analysis", "season_compare",
    "claim_dashboard", "defect_analysis", "qc_results", "voc_analysis",
    "scorecard", "ranking", "detail_panel", "evaluation",
]

def run():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        pg = browser.new_page(viewport={"width": 1400, "height": 900})

        pg.goto(BASE, wait_until="networkidle", timeout=30000)
        time.sleep(6)

        # 메인 체크
        errs = pg.query_selector_all('[data-testid="stException"]')
        main_ok = len(errs) == 0
        sys.stdout.buffer.write(f"MAIN: {'OK' if main_ok else 'ERROR'}\n".encode("utf-8"))
        pg.screenshot(path="src/output/test_main.png")

        # 사이드바 모든 버튼 수집
        all_btns = pg.query_selector_all('[data-testid="stSidebar"] button[kind]')
        sys.stdout.buffer.write(f"Sidebar buttons: {len(all_btns)}\n".encode("utf-8"))

        for key in NAV_KEYS:
            try:
                # expander 모두 열기
                details = pg.query_selector_all('[data-testid="stSidebar"] details')
                for d in details:
                    if not d.get_attribute("open"):
                        s = d.query_selector("summary")
                        if s:
                            s.click()
                            time.sleep(0.3)

                # 버튼 찾기 - Streamlit 내부 key로는 접근 불가, 텍스트 기반
                all_btns = pg.query_selector_all('[data-testid="stSidebar"] button[kind]')

                # 인덱스 매핑 (브랜드2개 + 메뉴16개 = 총 18개 이상)
                # 브랜드 버튼 건너뛰고 메뉴 버튼만
                menu_btns = [b for b in all_btns if "brand" not in (b.get_attribute("key") or "")]

                idx = NAV_KEYS.index(key)
                if idx < len(menu_btns):
                    menu_btns[idx].click()
                    time.sleep(3)

                    errs = pg.query_selector_all('[data-testid="stException"]')
                    if errs:
                        msg = errs[0].inner_text()[:200].replace("\n", " ")
                        results[key] = f"ERROR: {msg}"
                        sys.stdout.buffer.write(f"ERR  {key}: {msg[:80]}\n".encode("utf-8"))
                    else:
                        results[key] = "OK"
                        sys.stdout.buffer.write(f"OK   {key}\n".encode("utf-8"))

                    pg.screenshot(path=f"src/output/test_{key}.png")
                else:
                    results[key] = "SKIP"
                    sys.stdout.buffer.write(f"SKIP {key}\n".encode("utf-8"))

            except Exception as e:
                results[key] = f"CRASH: {str(e)[:100]}"
                sys.stdout.buffer.write(f"CRASH {key}: {str(e)[:80]}\n".encode("utf-8"))

        browser.close()

    ok = sum(1 for v in results.values() if v == "OK")
    err = sum(1 for v in results.values() if "ERROR" in str(v))
    sys.stdout.buffer.write(f"\n=== OK={ok} ERROR={err} / {len(results)} ===\n".encode("utf-8"))

    for k, v in results.items():
        if "ERROR" in str(v):
            sys.stdout.buffer.write(f"  {k}: {v[:150]}\n".encode("utf-8"))

    with open("src/output/playwright_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    run()
