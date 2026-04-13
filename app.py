"""
Streamlit Cloud 진입점
"""
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 메인 앱 모듈 실행 (exec으로 동일 프로세스에서 실행)
exec(open(ROOT / "src" / "service" / "production_status" / "app.py").read())
