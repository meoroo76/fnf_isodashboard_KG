"""Playwright 기반 페이지 렌더링 테스트 - 메인 + 첫번째 카테고리"""
import sys, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8514"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        pg = browser.new_page(viewport={"width": 1400, "height": 900})

        # 1) 메인 페이지 로드
        pg.goto(BASE, wait_until="networkidle", timeout=30000)
        time.sleep(4)

        # 에러 체크
        errs = pg.query_selector_all('[data-testid="stException"]')
        if errs:
            for e in errs:
                txt = e.inner_text()[:200]
                sys.stdout.buffer.write(f"MAIN ERROR: {txt}\n".encode("utf-8"))
        else:
            sys.stdout.buffer.write(b"MAIN: OK (no errors)\n")

        pg.screenshot(path="src/output/check_main.png")

        # 2) 사이드바 expander 열기 + 메뉴 클릭
        details = pg.query_selector_all('[data-testid="stSidebar"] details')
        for d in details:
            if not d.get_attribute("open"):
                s = d.query_selector("summary")
                if s:
                    s.click()
                    time.sleep(0.3)

        # 사이드바에서 텍스트 가진 모든 버튼 수집
        btns = pg.query_selector_all('[data-testid="stSidebar"] button')
        btn_labels = []
        for b in btns:
            txt = b.inner_text().strip()
            if txt:
                btn_labels.append(txt)

        sys.stdout.buffer.write(f"Sidebar buttons: {btn_labels}\n".encode("utf-8"))

        browser.close()

if __name__ == "__main__":
    run()
