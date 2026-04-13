<!-- DCS-AI-PLUGIN-CONFIG -->
## DCS AI 프로젝트 표준
- created by Roybong 2026.03.07

이 프로젝트는 **DCS AI 코딩 표준**을 따릅니다.
- `.claude/rules/` 디렉토리의 규칙을 준수하세요
- 새로운 기술 스택, 인프라, 라이브러리를 도입할 때는 **작업 전에** `dcs-ai-common` 플러그인의 rules와 skills를 먼저 확인하세요
  - Rules: `~/.claude/plugins/cache/dcs-ai/dcs-ai-common/*/rules/` — 해당 카테고리가 있으면 `.claude/rules/`에 복사 후 준수
  - Skills: `.claude/skills/` (Init 시 자동 배포) 및 `~/.claude/plugins/cache/dcs-ai/dcs-ai-common/*/skills/` — 해당 기술의 `SKILL.md`를 읽고 참고

## DCS AI 활용 지침
- **dcsai MCP**를 통해 F&F 지식그래프를 탐색·분석하고, 문제를 발견하여 해결방안을 제시하세요
- **브랜드 가치 보호**: 해결방안에서 프로모션, 가격인하 등 브랜드 가치를 훼손하는 방법은 **절대 금지**합니다
- **기술적 접근**: 데이터분석, 통계, 프로그래밍 등 기술적 방법을 적극 활용하세요
- **시장동향**: 시장 트렌드와 동향 파악 시 웹서치를 적극 활용하세요
- **존대말**: 사용자에게 항상 존대말을 사용하세요

## 프로젝트 초기설정
- 폴더 구조: `src/{util,service,core,output,download}`
- Python 가상환경이 없으면 `uv`로 Python 3.13 설치
- 필수 라이브러리: `polars`, `duckdb`, `python-pptx`, `matplotlib`, `plotly`, `kaleido`, `pyarrow` (`uv`로 설치)
- 실행 중 추가 라이브러리가 필요하면 `uv`로 현재 가상환경에 설치

## 코드 작성 규칙
- 코드 작성 전 반드시 `.claude/skills/` 및 `src/util/`의 기존 유틸리티를 먼저 확인할 것
- 기존 유틸리티가 있으면 직접 코드 작성 대신 해당 유틸리티를 활용할 것
- 데이터 처리 및 도구 사용 규칙은 `.claude/rules/dcsai-tools.md`를 참조
- 비즈니스 분석 규칙(용어, 도메인, 검증, 추천액션)은 `.claude/rules/dcsai-business-analysis.md`를 참조
- 시각화 규칙(차트 유형 자동 선택, 라이브러리 선택)은 `.claude/rules/dcsai-visualization.md`를 참조

## Bash로 파일 실행 규칙
- python 실행 시 반드시 현재 프로젝트 내 가상환경(.venv)내의 python으로 실행할것
- `src/` 패키지를 임포트하는 스크립트 실행 시 반드시 프로젝트 루트에서 `PYTHONPATH=.`를 설정할 것
  - Windows: `PYTHONPATH=. .venv/Scripts/python src/service/xxx/script.py`
  - macOS/Linux: `PYTHONPATH=. .venv/bin/python src/service/xxx/script.py`
- Python 코드는 반드시 `.py` 파일로 저장 후 `python script.py`로 실행할 것 (`bash -c` 멀티라인 문자열로 Python 코드 실행 금지)

## 폴더·파일 생성 규칙

- `src/service/` → 지식그래프 인텐트별 하위 폴더로 코드 저장
- `src/output/` → 실행 결과 저장
- `src/service`, `src/output`, `src/download` 구조는 항상 동일하게 유지


## 결과물 안내 규칙
- `src/output/`에 파일(pptx, xlsx, html, png 등)을 생성한 후, 사용자에게 "파일을 열어드릴까요?"라고 질의할 것
- 승인 시 OS 기본 프로그램으로 파일 열기 (Windows: `start`, macOS: `open`)

## Claude Skill, Rule 업데이트 시 유의사항
- 사용자의 요청에 의해 `<!-- DCS-AI-PLUGIN-CONFIG -->`마커 영역을 수정할 경우 경고 메세지를 띄운다 : `이 내용을 변경하면 지식그래프가 정상적으로 동작하지 않을 수도 있습니다. 계속하시겠습니까?`

<!-- /DCS-AI-PLUGIN-CONFIG -->
