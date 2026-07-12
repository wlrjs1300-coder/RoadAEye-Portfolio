from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.modules.its.repository import register_model_version
from app.common.logger import logger
from app.infrastructure.model_registry import get_keras_model_path, get_keras_metadata


def _restore_active_streams() -> None:
    """DB의 is_active=1 CCTV를 읽어 스트림 워커를 자동 복구한다."""
    try:
        from app.infrastructure.database import get_db
        from app.modules.its.service import manager
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT cctv_no, name, its_cctv_id, stream_url, latitude, longitude "
                    "FROM cctvs WHERE is_active=1 AND stream_url IS NOT NULL"
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        for row in rows:
            try:
                manager.start_stream(
                    camera_id  = row["its_cctv_id"] or row["name"],
                    stream_url = row["stream_url"],
                    name       = row["name"],
                    coord_y    = str(row["latitude"])  if row["latitude"]  else "",
                    coord_x    = str(row["longitude"]) if row["longitude"] else "",
                )
                logger.info(f"스트림 자동 복구: {row['name']}")
            except Exception as e:
                logger.warning(f"스트림 복구 실패 ({row['name']}): {e}")

        logger.info(f"스트림 자동 복구 완료: {len(rows)}개 시도")
    except Exception as e:
        logger.warning(f"스트림 자동 복구 중 오류 (계속 실행): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keras 분류기 (classify 엔드포인트용) 로드
    try:
        from app.core.config import settings
        from app.modules.keras import classifier
        model_path = get_keras_model_path(settings.keras_model_version)
        metadata   = get_keras_metadata(settings.keras_model_version)
        classifier.load_model(str(model_path), metadata)
        logger.info(f"Keras 분류기 로드 완료 ({settings.keras_model_version}): {model_path}")
    except Exception as e:
        logger.warning(f"Keras 분류기 로드 실패 (classify 엔드포인트 503 상태): {e}")

    # Keras v15 게이트 사전 로드
    try:
        from app.modules.its.pipeline import _get_keras_model
        _get_keras_model()
        logger.info("Keras v15 1차 게이트 사전 로드 완료")
    except Exception as e:
        logger.warning(f"Keras 게이트 사전 로드 실패 (첫 프레임 시 재시도): {e}")

    # 첫 ITS 스트림 시작 시 모델 지연 로딩으로 영상 전송이 멈추지 않도록 미리 로드한다.
    try:
        from app.modules.its.pipeline import warmup_models
        warmup_models()
        logger.info("ITS YOLO 모델 사전 로드 완료")
    except Exception as e:
        logger.warning(f"ITS YOLO 모델 사전 로드 실패 (첫 분석 시 재시도): {e}")

    try:
        register_model_version(
            model_name="yolov11-roadeye-v3",
            version="v3",
            model_path="models/yolo/v3/yolov11m_v3_best.pt",
            trained_at="2026-05-28",
        )
        register_model_version(
            model_name="keras-highway-classifier-v3",
            version="v3",
            model_path="models/keras/v3/highway_model_v3_fp16.tflite",
            trained_at="2026-05-28",
        )
    except Exception as e:
        logger.warning(f"모델 버전 등록 실패 (서버는 계속 실행): {e}")

    # DB 활성 CCTV 스트림 자동 복구
    _restore_active_streams()

    yield

    from app.modules.its.service import manager
    manager.stop_all()
    logger.info("서버 종료")
