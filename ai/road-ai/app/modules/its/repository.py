from typing import Optional

from app.infrastructure.database import get_db
from app.common.logger import logger


def load_forbidden_classes() -> dict:
    """forbidden_classes 테이블에서 활성 클래스 로드 → {class_name: class_no}"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT class_no, class_name FROM forbidden_classes WHERE is_active = 1"
            )
            return {row["class_name"]: row["class_no"] for row in cur.fetchall()}
    finally:
        conn.close()


def get_or_create_cctv(
    its_cctv_id: str,
    name: str,
    stream_url: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> int:
    """cctvs 테이블에서 카메라 조회 또는 신규 등록 → cctv_no 반환"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cctv_no FROM cctvs WHERE its_cctv_id = %s", (its_cctv_id,)
            )
            row = cur.fetchone()
            if row:
                return row["cctv_no"]

            cur.execute(
                """INSERT INTO cctvs (its_cctv_id, name, stream_url, latitude, longitude)
                   VALUES (%s, %s, %s, %s, %s)""",
                (its_cctv_id, name, stream_url, latitude, longitude),
            )
            conn.commit()
            logger.info(f"CCTV 등록: {name} ({its_cctv_id})")
            return cur.lastrowid
    except Exception as e:
        logger.error(f"CCTV 등록 실패: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def register_model_version(
    model_name: str, version: str, model_path: str, trained_at: str
) -> None:
    """model_versions 테이블에 현재 모델 등록 (이미 있으면 건너뜀)"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT version_no FROM model_versions WHERE model_name = %s AND version = %s",
                (model_name, version),
            )
            if cur.fetchone():
                return

            cur.execute(
                """INSERT INTO model_versions
                       (model_name, version, trained_at, model_path, is_active)
                   VALUES (%s, %s, %s, %s, 1)""",
                (model_name, version, trained_at, model_path),
            )
            conn.commit()
            logger.info(f"모델 버전 등록: {model_name} {version}")
    except Exception as e:
        logger.error(f"모델 버전 등록 실패: {e}")
        conn.rollback()
    finally:
        conn.close()
