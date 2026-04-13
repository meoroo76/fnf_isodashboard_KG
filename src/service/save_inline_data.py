"""인라인 MCP 응답 데이터를 캐시 파일로 저장하는 스크립트.
이 파일의 DATA 딕셔너리에 인라인 데이터의 첫 레코드만 넣으면,
실제로는 전체 MCP 응답이 Claude Code 세션에서 직접 처리됨.

사용법: Claude Code에서 이 스크립트의 save_all() 함수를 호출하거나,
MCP 응답의 data 배열을 직접 save_data()에 전달.
"""
import json
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "download" / "kg_cache"

def save_data(brd_cd: str, sesn_running: str, data: list[dict]):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    prefix = "duvetica" if brd_cd == "V" else "sergio" if brd_cd == "ST" else brd_cd.lower()
    fname = f"{prefix}_{sesn_running.lower()}_order_inbound.json"
    out = CACHE_DIR / fname
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {brd_cd} {sesn_running}: {len(data)} records -> {fname}")

def check():
    needed = [
        ("V","26S"), ("V","25F"), ("V","25S"), ("V","24F"),
        ("ST","26S"), ("ST","25F"), ("ST","25S"), ("ST","24F"),
    ]
    for brd, sesn in needed:
        prefix = "duvetica" if brd == "V" else "sergio"
        f = CACHE_DIR / f"{prefix}_{sesn.lower()}_order_inbound.json"
        if f.exists():
            data = json.loads(f.read_text(encoding="utf-8"))
            print(f"  OK   {brd} {sesn}: {len(data)}")
        else:
            print(f"  MISS {brd} {sesn}")

if __name__ == "__main__":
    check()
