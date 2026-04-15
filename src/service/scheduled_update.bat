@echo off
REM 대시보드 데이터 자동 업데이트 (매주 금요일 18:00)
REM Windows 작업 스케줄러에서 호출

cd /d D:\WORKSPACE\260407_소싱 대시보드_지식그래프

set PYTHONPATH=.

echo [%date% %time%] 업데이트 시작 >> src\service\update_log.txt

.venv\Scripts\python.exe src\service\update_dashboard_data.py >> src\service\update_log.txt 2>&1

echo [%date% %time%] 업데이트 완료 >> src\service\update_log.txt
echo. >> src\service\update_log.txt
