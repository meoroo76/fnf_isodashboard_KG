"""전체 페이지 데이터 연동 검증 스크립트"""
import sys
from src.core.data_loader import (
    load_order_inbound, load_cost_master, load_cost_account,
    load_claims, load_voc,
    get_available_data, get_available_cost_data,
)
from src.core.config import BRANDS

BRAND_CODES = [v["code"] for v in BRANDS.values()]
SEASONS = ["26S", "25F", "25S", "24F"]

print("=" * 60)
print("ISO AI Agent 데이터 연동 검증")
print("=" * 60)

# 1. 발주/입고 데이터
print("\n[1] 발주/입고 데이터")
for brd in BRAND_CODES:
    for sesn in SEASONS:
        df = load_order_inbound(brd, sesn)
        status = f"{df.shape[0]:>5} rows" if not df.is_empty() else "  EMPTY"
        print(f"  {brd} {sesn}: {status}")

# 2. 원가 데이터
print("\n[2] 원가 데이터 (마스터)")
for brd in BRAND_CODES:
    for sesn in SEASONS:
        df = load_cost_master(brd, sesn)
        status = f"{df.shape[0]:>5} styles" if not df.is_empty() else "  EMPTY"
        print(f"  {brd} {sesn}: {status}")

# 3. 원가 계정
print("\n[3] 원가 계정 디테일")
for brd in BRAND_CODES:
    for sesn in SEASONS:
        df = load_cost_account(brd, sesn)
        status = f"{df.shape[0]:>5} rows" if not df.is_empty() else "  EMPTY"
        print(f"  {brd} {sesn}: {status}")

# 4. 클레임
print("\n[4] 클레임 데이터")
for brd in BRAND_CODES:
    df = load_claims(brd)
    if not df.is_empty():
        print(f"  {brd}: {df.shape[0]} rows, 스타일={df['PRDT_CD'].n_unique()}, 협력사={df['MFAC_COMPY_NM'].n_unique()}")
    else:
        print(f"  {brd}: EMPTY")

# 5. VOC
print("\n[5] 매장 VOC 데이터")
for brd in BRAND_CODES:
    df = load_voc(brd)
    if not df.is_empty():
        shops = df['SHOP_NM'].n_unique() if 'SHOP_NM' in df.columns else 0
        print(f"  {brd}: {df.shape[0]} rows, 매장={shops}")
    else:
        print(f"  {brd}: EMPTY")

# 6. 페이지별 검증
print("\n[6] 페이지별 데이터 가용성")
pages = {
    "생산-오더현황": lambda b, s: not load_order_inbound(b, s).is_empty(),
    "생산-납기관리": lambda b, s: not load_order_inbound(b, s).is_empty(),
    "원가-총괄": lambda b, s: not load_cost_master(b, s).is_empty(),
    "원가-구성": lambda b, s: not load_cost_account(b, s).is_empty(),
    "원가-마크업": lambda b, s: not load_cost_master(b, s).is_empty(),
    "원가-시즌비교": lambda b, s: len(get_available_cost_data()) >= 2,
    "품질-클레임": lambda b, s: not load_claims(b).is_empty(),
    "품질-불량분석": lambda b, s: not load_claims(b).is_empty(),
    "품질-VOC": lambda b, s: not load_voc(b).is_empty(),
    "협력사-스코어": lambda b, s: not load_order_inbound(b, s).is_empty() or not load_cost_master(b, s).is_empty(),
    "협력사-랭킹": lambda b, s: not load_order_inbound(b, s).is_empty() or not load_cost_master(b, s).is_empty(),
}

ok_count = 0
fail_count = 0
for page_name, check_fn in pages.items():
    results = []
    for brd in BRAND_CODES:
        for sesn in SEASONS:
            try:
                available = check_fn(brd, sesn)
                results.append((brd, sesn, available))
            except Exception as e:
                results.append((brd, sesn, False))

    ok = sum(1 for _, _, a in results if a)
    total = len(results)
    symbol = "OK" if ok == total else f"{ok}/{total}"
    print(f"  {page_name:20s}: {symbol}")
    ok_count += ok
    fail_count += (total - ok)

print(f"\n{'=' * 60}")
total = ok_count + fail_count
print(f"전체 데이터 가용성: {ok_count}/{total} ({ok_count/total*100:.0f}%)")
print("=" * 60)
