"""캐시 데이터 상태 점검"""
import json
from pathlib import Path

CACHE_DIR = Path("src/download/kg_cache")

for f in sorted(CACHE_DIR.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    if isinstance(data, list):
        rows = len(data)
        cols = len(data[0].keys()) if rows > 0 else 0
        print(f"  {f.name:45s}  rows={rows:>5}  cols={cols}")
    elif isinstance(data, dict):
        if "data" in data:
            rows = len(data["data"])
            cols = len(data["data"][0].keys()) if rows > 0 else 0
            print(f"  {f.name:45s}  rows={rows:>5}  cols={cols}  (nested)")
        else:
            print(f"  {f.name:45s}  dict keys={list(data.keys())[:5]}")
    else:
        print(f"  {f.name:45s}  type={type(data).__name__}")
