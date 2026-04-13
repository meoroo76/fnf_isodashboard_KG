"""
기본 통계처리 유틸리티 (Polars + DuckDB)

JSON/CSV 데이터를 로드하여 기본 통계 분석을 수행한다.
- 범주형 컬럼: 고유값 수, 최빈값, 빈도 분포
- 수치형 컬럼: 평균, 중앙값, 표준편차, 최소/최대
- 크로스탭: 두 범주형 컬럼 간 교차표
- DuckDB SQL 기반 그룹별 집계
"""

import json
from pathlib import Path
from typing import Any

import duckdb
import polars as pl


def load_json_as_df(file_path: str | Path) -> pl.DataFrame:
    """JSON 파일을 Polars DataFrame으로 로드한다."""
    file_path = Path(file_path)
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return pl.DataFrame(data)
    if isinstance(data, dict) and "data" in data:
        return pl.DataFrame(data["data"])
    raise ValueError(f"지원하지 않는 JSON 구조입니다: {type(data)}")


def load_csv_as_df(file_path: str | Path, **kwargs) -> pl.DataFrame:
    """CSV 파일을 Polars DataFrame으로 로드한다."""
    return pl.read_csv(file_path, **kwargs)


def basic_info(df: pl.DataFrame) -> dict:
    """DataFrame 기본 정보를 반환한다."""
    return {
        "shape": {"rows": df.height, "columns": df.width},
        "columns": {
            col: str(dtype) for col, dtype in zip(df.columns, df.dtypes)
        },
        "null_counts": {
            col: df[col].null_count() for col in df.columns
        },
    }


def describe_stats(df: pl.DataFrame) -> pl.DataFrame:
    """Polars describe()로 전체 컬럼 기술통계를 반환한다."""
    return df.describe()


def category_distribution(df: pl.DataFrame, column: str) -> pl.DataFrame:
    """범주형 컬럼의 빈도 분포를 반환한다 (내림차순)."""
    return (
        df.group_by(column)
        .agg(pl.len().alias("count"))
        .sort("count", descending=True)
        .with_columns(
            (pl.col("count") / pl.col("count").sum() * 100)
            .round(2)
            .alias("pct")
        )
    )


def crosstab(df: pl.DataFrame, row_col: str, col_col: str) -> pl.DataFrame:
    """두 범주형 컬럼 간 교차표(피벗)를 반환한다."""
    return (
        df.group_by([row_col, col_col])
        .agg(pl.len().alias("count"))
        .pivot(on=col_col, index=row_col, values="count")
        .fill_null(0)
        .sort(row_col)
    )


def group_agg_duckdb(df: pl.DataFrame, group_cols: list[str],
                     agg_expr: str = "COUNT(*) AS cnt") -> pl.DataFrame:
    """DuckDB SQL로 그룹별 집계를 수행한다.

    Args:
        df: 원본 DataFrame
        group_cols: GROUP BY 컬럼 리스트
        agg_expr: SELECT에 추가할 집계 표현식 (기본: COUNT(*) AS cnt)

    Returns:
        집계 결과 DataFrame

    Example:
        group_agg_duckdb(df, ["PRDT_KIND_NM"], "COUNT(*) AS cnt")
        group_agg_duckdb(df, ["PRDT_KIND_NM", "ITEM_GROUP"], "COUNT(*) AS cnt")
    """
    conn = duckdb.connect(":memory:")
    try:
        conn.register("tbl", df.to_arrow())
        group_str = ", ".join(group_cols)
        sql = f"SELECT {group_str}, {agg_expr} FROM tbl GROUP BY {group_str} ORDER BY {group_str}"
        result = conn.execute(sql).pl()
    finally:
        conn.close()
    return result


def custom_query_duckdb(df: pl.DataFrame, sql: str,
                        table_name: str = "tbl") -> pl.DataFrame:
    """DuckDB에서 임의의 SQL을 실행한다.

    Args:
        df: 원본 DataFrame (SQL에서 table_name으로 참조)
        sql: 실행할 SQL 문
        table_name: DataFrame을 등록할 테이블명 (기본: tbl)

    Example:
        custom_query_duckdb(df, "SELECT PRDT_KIND_NM, COUNT(*) AS cnt FROM tbl GROUP BY 1 ORDER BY 2 DESC")
    """
    conn = duckdb.connect(":memory:")
    try:
        conn.register(table_name, df.to_arrow())
        result = conn.execute(sql).pl()
    finally:
        conn.close()
    return result


def run_full_stats(file_path: str | Path) -> dict[str, Any]:
    """JSON 파일에 대해 전체 기본 통계를 실행하고 결과를 딕셔너리로 반환한다.

    Returns:
        {
            "info": 기본 정보,
            "describe": 기술통계 DataFrame,
            "distributions": {컬럼명: 빈도분포 DataFrame, ...},
        }
    """
    df = load_json_as_df(file_path)
    info = basic_info(df)

    str_cols = [col for col, dtype in zip(df.columns, df.dtypes)
                if dtype == pl.String]

    distributions = {}
    for col in str_cols:
        distributions[col] = category_distribution(df, col)

    return {
        "info": info,
        "describe": describe_stats(df),
        "distributions": distributions,
    }


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "src/download/product_classification_X.json"
    results = run_full_stats(target)

    print("=" * 60)
    print("[ 기본 정보 ]")
    print(f"  행: {results['info']['shape']['rows']}, 열: {results['info']['shape']['columns']}")
    print(f"  컬럼: {list(results['info']['columns'].keys())}")
    print(f"  NULL 수: {results['info']['null_counts']}")

    print("\n[ 기술통계 ]")
    print(results["describe"])

    print("\n[ 범주형 컬럼 빈도분포 ]")
    for col, dist_df in results["distributions"].items():
        print(f"\n  --- {col} ---")
        print(dist_df)
