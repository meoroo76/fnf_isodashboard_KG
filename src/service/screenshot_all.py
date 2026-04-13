"""전체 16페이지 + 사이드바 스크린샷 캡처"""
import sys, time, os
os.environ["PYTHONIOENCODING"] = "utf-8"
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8514"
OUT = "src/output/screenshots"
os.makedirs(OUT, exist_ok=True)

NAV_PAGES = [
    # (category_idx, page_idx_in_cat, name)
    (0, 0, "order_dashboard"),
    (0, 1, "delivery_mgmt"),
    (0, 2, "supplier_input"),
    (0, 3, "report_gen"),
    (1, 0, "cost_overview"),
    (1, 1, "cost_breakdown"),
    (1, 2, "markup_analysis"),
    (1, 3, "season_compare"),
    (2, 0, "claim_dashboard"),
    (2, 1, "defect_analysis"),
    (2, 2, "qc_results"),
    (2, 3, "voc_analysis"),
    (3, 0, "scorecard"),
    (3, 1, "ranking"),
    (3, 2, "detail_panel"),
    (3, 3, "evaluation"),
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        pg = browser.new_page(viewport={"width": 1400, "height": 900})

        # 1) 메인 로드
        pg.goto(BASE, wait_until="networkidle", timeout=30000)
        time.sleep(5)

        # 사이드바 스크린샷
        pg.screenshot(path=f"{OUT}/00_main.png")
        sys.stdout.buffer.write(b"MAIN: captured\n")

        # 사이드바 expander 스크린샷 (모두 펼치기)
        details = pg.query_selector_all('[data-testid="stSidebar"] details')
        for d in details:
            if not d.get_attribute("open"):
                s = d.query_selector("summary")
                if s:
                    s.click()
                    time.sleep(0.3)
        time.sleep(0.5)

        sidebar = pg.query_selector('[data-testid="stSidebar"]')
        if sidebar:
            sidebar.screenshot(path=f"{OUT}/00_sidebar_expanded.png")
            sys.stdout.buffer.write(b"SIDEBAR: captured\n")

        # 2) 각 페이지 캡처 - 사이드바 버튼 클릭 방식
        for cat_idx, page_idx, name in NAV_PAGES:
            try:
                # 모든 expander 열기
                details = pg.query_selector_all('[data-testid="stSidebar"] details')
                for d in details:
                    if not d.get_attribute("open"):
                        s = d.query_selector("summary")
                        if s:
                            s.click()
                            time.sleep(0.2)

                # 해당 카테고리의 버튼들 찾기
                # 각 expander 내 버튼 수집
                expanders = pg.query_selector_all('[data-testid="stSidebar"] [data-testid="stExpander"]')
                if cat_idx < len(expanders):
                    exp = expanders[cat_idx]
                    btns = exp.query_selector_all('button')
                    if page_idx < len(btns):
                        btns[page_idx].click()
                        time.sleep(3)

                        # 에러 체크
                        errs = pg.query_selector_all('[data-testid="stException"]')
                        status = "ERROR" if errs else "OK"
                        pg.screenshot(path=f"{OUT}/{cat_idx+1}_{page_idx}_{name}.png")
                        msg = f"  {name}: {status}\n"
                        sys.stdout.buffer.write(msg.encode("utf-8"))
                    else:
                        sys.stdout.buffer.write(f"  {name}: btn not found (idx={page_idx}, btns={len(btns)})\n".encode("utf-8"))
                else:
                    sys.stdout.buffer.write(f"  {name}: expander not found (idx={cat_idx})\n".encode("utf-8"))

            except Exception as e:
                sys.stdout.buffer.write(f"  {name}: EXCEPTION {e}\n".encode("utf-8"))

        browser.close()

if __name__ == "__main__":
    run()
