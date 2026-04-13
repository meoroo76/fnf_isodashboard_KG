"""KG 실데이터 일괄 fetch → 캐시 저장 스크립트
Claude Code 세션에서 MCP를 통해 데이터를 가져온 후,
이 스크립트에서 캐시 JSON 파일로 저장.

사용법: MCP 호출 결과를 result_files dict에 매핑 후 실행
"""
import json
from pathlib import Path

CACHE_DIR = Path("src/download/kg_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def save_mcp_result(result_file: str, output_name: str):
    """MCP 결과 파일에서 data를 추출하여 캐시로 저장"""
    raw = json.loads(Path(result_file).read_text(encoding="utf-8"))

    # MCP 결과 형식: [{"type": "text", "text": "{json}"}]
    if isinstance(raw, list) and raw and "text" in raw[0]:
        inner = json.loads(raw[0]["text"])
    else:
        inner = raw

    # data 추출
    data = inner.get("data", inner)
    if isinstance(data, dict) and "data" in data:
        data = data["data"]

    if isinstance(data, list):
        out_path = CACHE_DIR / output_name
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Saved {len(data)} records -> {out_path}")
    else:
        print(f"Unexpected data type: {type(data)}")

if __name__ == "__main__":
    # 이미 캐시된 파일 확인
    for f in sorted(CACHE_DIR.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        count = len(data) if isinstance(data, list) else "?"
        print(f"  {f.name}: {count} records")
