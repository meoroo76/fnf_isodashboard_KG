"""누락된 4개 시즌 데이터를 KG API에서 직접 가져와 캐시에 저장하는 스크립트.
Claude Code 세션에서 MCP를 통해 실행해야 함.
수동 실행: 이 스크립트의 fetch_and_save 함수를 호출
"""
import json
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "download" / "kg_cache"

MISSING = [
    {"brd": "V",  "sesn": "25S", "file": "duvetica_25s_order_inbound.json"},
    {"brd": "ST", "sesn": "25F", "file": "sergio_25f_order_inbound.json"},
    {"brd": "ST", "sesn": "25S", "file": "sergio_25s_order_inbound.json"},
    {"brd": "ST", "sesn": "24F", "file": "sergio_24f_order_inbound.json"},
]

def save_data(brd: str, sesn: str, data: list[dict]):
    """데이터를 캐시 파일로 저장"""
    prefix = "duvetica" if brd == "V" else "sergio" if brd == "ST" else brd.lower()
    filename = f"{prefix}_{sesn.lower()}_order_inbound.json"
    out = CACHE_DIR / filename
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {brd} {sesn}: {len(data)} records -> {filename}")

def check_status():
    """캐시 현황 출력"""
    all_files = {
        ("V", "26S"), ("V", "25F"), ("V", "25S"), ("V", "24F"),
        ("ST", "26S"), ("ST", "25F"), ("ST", "25S"), ("ST", "24F"),
    }
    print("Cache status:")
    for brd, sesn in sorted(all_files):
        prefix = "duvetica" if brd == "V" else "sergio"
        f = CACHE_DIR / f"{prefix}_{sesn.lower()}_order_inbound.json"
        if f.exists():
            data = json.loads(f.read_text(encoding="utf-8"))
            print(f"  OK    {brd} {sesn}: {len(data)} records")
        else:
            print(f"  MISS  {brd} {sesn}")

if __name__ == "__main__":
    check_status()
