"""
ISO AI Agent - Google Sheets 클라이언트
Google Sheets API v4를 사용한 읽기/쓰기
"""
import json
from pathlib import Path
from typing import Any

import polars as pl

# 로컬 대체 저장소 (Google Sheets API 미설정 시)
LOCAL_STORE_DIR = Path(__file__).parent.parent / "download" / "gsheet_local"
LOCAL_STORE_DIR.mkdir(parents=True, exist_ok=True)


class GSheetClient:
    """Google Sheets 클라이언트 (API v4 또는 로컬 JSON 대체)"""

    def __init__(self, spreadsheet_id: str = None, credentials_path: str = None):
        self.spreadsheet_id = spreadsheet_id
        self.credentials_path = credentials_path
        self._service = None
        self._use_local = spreadsheet_id is None

    def _get_service(self):
        """Google Sheets API 서비스 초기화"""
        if self._use_local:
            return None
        if self._service is not None:
            return self._service
        try:
            from google.oauth2.service_account import Credentials
            from googleapiclient.discovery import build

            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=["https://www.googleapis.com/auth/spreadsheets"],
            )
            self._service = build("sheets", "v4", credentials=creds)
            return self._service
        except Exception:
            self._use_local = True
            return None

    # ──────────────────────────────────────
    # 읽기
    # ──────────────────────────────────────
    def read_sheet(self, sheet_name: str) -> pl.DataFrame:
        """시트 데이터를 polars DataFrame으로 읽기"""
        if self._use_local:
            return self._read_local(sheet_name)

        service = self._get_service()
        if service is None:
            return self._read_local(sheet_name)

        try:
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=self.spreadsheet_id, range=f"{sheet_name}!A:ZZ")
                .execute()
            )
            values = result.get("values", [])
            if len(values) < 2:
                return pl.DataFrame()
            headers = values[0]
            rows = values[1:]
            # 행 길이를 헤더에 맞춤
            normalized = [row + [""] * (len(headers) - len(row)) for row in rows]
            return pl.DataFrame(normalized, schema=headers, orient="row")
        except Exception as e:
            print(f"[GSheet] 읽기 실패 ({sheet_name}): {e}")
            return self._read_local(sheet_name)

    # ──────────────────────────────────────
    # 쓰기
    # ──────────────────────────────────────
    def write_sheet(self, sheet_name: str, df: pl.DataFrame, append: bool = False):
        """polars DataFrame을 시트에 쓰기"""
        if self._use_local:
            self._write_local(sheet_name, df, append)
            return

        service = self._get_service()
        if service is None:
            self._write_local(sheet_name, df, append)
            return

        try:
            values = [df.columns] + df.rows()
            body = {"values": values}

            if append:
                service.spreadsheets().values().append(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"{sheet_name}!A:A",
                    valueInputOption="USER_ENTERED",
                    body={"values": df.rows()},
                ).execute()
            else:
                service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"{sheet_name}!A1",
                    valueInputOption="USER_ENTERED",
                    body=body,
                ).execute()
        except Exception as e:
            print(f"[GSheet] 쓰기 실패 ({sheet_name}): {e}")
            self._write_local(sheet_name, df, append)

    # ──────────────────────────────────────
    # 로컬 대체 저장소
    # ──────────────────────────────────────
    def _local_path(self, sheet_name: str) -> Path:
        return LOCAL_STORE_DIR / f"{sheet_name}.json"

    def _read_local(self, sheet_name: str) -> pl.DataFrame:
        path = self._local_path(sheet_name)
        if not path.exists():
            return pl.DataFrame()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not data:
                return pl.DataFrame()
            return pl.DataFrame(data)
        except Exception:
            return pl.DataFrame()

    def _write_local(self, sheet_name: str, df: pl.DataFrame, append: bool = False):
        path = self._local_path(sheet_name)
        if append and path.exists():
            existing = self._read_local(sheet_name)
            if existing.height > 0:
                df = pl.concat([existing, df], how="diagonal")
        data = df.to_dicts()
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# 싱글톤 인스턴스
_client: GSheetClient | None = None


def get_gsheet_client(spreadsheet_id: str = None, credentials_path: str = None) -> GSheetClient:
    global _client
    if _client is None:
        _client = GSheetClient(spreadsheet_id, credentials_path)
    return _client
