"""
ITS 프레임 분석 파이프라인 — 3모델 앙상블 (Soft Voting)

1단계: Keras (MobileNetV2 FP16 TFLite)
  - 프레임 전체에 대한 빠른 이진 판별 (게이트)
  - 금지 차량 없음 판단 시 YOLO 2개 모두 건너뜀 → CPU 절감

2단계: YOLOv8 (v1) + YOLOv11 (v3) 동시 실행 (조건부)
  - Keras 게이트 통과 시에만 실행
  - 두 YOLO 결과를 IoU 기반 Soft Voting으로 병합
    * IoU >= 0.45 인 쌍 → 가중 평균 신뢰도 (YOLOv8:0.35, YOLOv11:0.65)
    * 한 모델에만 감지 → 임계값(0.60) 이상인 것만 채택
"""
import os
from typing import Optional

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from app.common.logger import logger

# GTX 1060 환경에서 cuDNN 엔진 선택 오류가 발생해 CUDA 기본 커널로 추론한다.
torch.backends.cudnn.enabled = False

YOLO_V1_PATH  = "models/yolo/v1/best.pt"           # YOLOv8
YOLO_V3_PATH  = "models/yolo/v3/yolov11m_v3_best.pt"  # YOLOv11
KERAS_MODEL_PATH = "models/keras/v3/highway_model_v15.keras"

_yolo_v8: Optional[YOLO] = None
_yolo_v11: Optional[YOLO] = None
_keras_model = None

YOLO_DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"


def _get_model_device(model: YOLO) -> str:
    try:
        return str(next(model.model.parameters()).device)
    except Exception:
        return "unknown"

W_V8   = 0.35   # YOLOv8 가중치
W_V11  = 0.65   # YOLOv11 가중치
IOU_TH  = 0.30  # 동일 객체 판별 IoU 임계값
SOLO_TH = 0.20  # 단독 감지 채택 신뢰도 임계값 (낮을수록 더 많은 객체 탐지)


def get_yolo_v8() -> YOLO:
    global _yolo_v8
    if _yolo_v8 is None:
        _yolo_v8 = YOLO(YOLO_V1_PATH)
        try:
            _yolo_v8.to(YOLO_DEVICE)
        except Exception as exc:
            logger.warning(f"ITS 앙상블: YOLOv8 GPU 로드 실패, CPU로 전환: {exc}")
            _yolo_v8.to("cpu")
        device = _get_model_device(_yolo_v8)
        logger.info(f"ITS 앙상블: YOLOv8 모델 로드 완료 ({device})")
    return _yolo_v8


def get_yolo_v11() -> YOLO:
    global _yolo_v11
    if _yolo_v11 is None:
        _yolo_v11 = YOLO(YOLO_V3_PATH)
        try:
            _yolo_v11.to(YOLO_DEVICE)
        except Exception as exc:
            logger.warning(f"ITS 앙상블: YOLOv11 GPU 로드 실패, CPU로 전환: {exc}")
            _yolo_v11.to("cpu")
        device = _get_model_device(_yolo_v11)
        logger.info(f"ITS 앙상블: YOLOv11 모델 로드 완료 ({device})")
    return _yolo_v11


def warmup_models() -> None:
    """서버 시작 시 더미 프레임으로 첫 추론 초기화 비용을 미리 지불한다."""
    dummy = np.zeros((640, 640, 3), dtype=np.uint8)
    _run_yolo(get_yolo_v8(), dummy)
    _run_yolo(get_yolo_v11(), dummy)
    logger.info("ITS YOLO 모델 워밍업 완료")


def _frame_to_keras_input(frame: np.ndarray) -> np.ndarray:
    """프레임을 Keras 입력 형식(224×224 float32)으로 변환"""
    resized = cv2.resize(frame, (224, 224))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    return rgb.astype(np.float32) / 255.0


def _get_keras_model():
    global _keras_model
    if _keras_model is None:
        os.environ["TF_USE_LEGACY_KERAS"] = "1"
        try:
            import tensorflow as tf
            import tf_keras as keras
            # PyTorch가 GPU를 점유 중이므로 TF는 CPU만 사용
            tf.config.set_visible_devices([], "GPU")
            _keras_model = keras.models.load_model(KERAS_MODEL_PATH)
            logger.info("Keras v15 게이트 모델 로드 완료 (CPU 전용)")
        except Exception as exc:
            logger.warning(f"Keras 모델 로드 실패, 게이트 비활성화: {exc}")
            _keras_model = None
    return _keras_model


def _keras_gate(frame: np.ndarray) -> tuple[bool, float]:
    """Keras MobileNetV2 1차 게이트 — 금지차량 확률 keras_threshold 이상 시 YOLO 실행"""
    from app.core.config import settings
    model = _get_keras_model()
    if model is None:
        return True, 1.0
    try:
        import tensorflow as tf
        inp = np.expand_dims(_frame_to_keras_input(frame), axis=0)
        with tf.device("/CPU:0"):
            score = float(model.predict(inp, verbose=0)[0][0])
        return score >= settings.keras_threshold, score
    except Exception as exc:
        logger.warning(f"Keras 게이트 추론 실패, YOLO 실행 허용: {exc}")
        return True, 1.0


def _run_yolo(model: YOLO, frame: np.ndarray) -> list:
    """YOLO 모델로 탐지 후 dict 리스트 반환. CUDA 오류 시 CPU로 자동 전환한다."""
    detections = []
    try:
        results = model(frame, verbose=False)
    except RuntimeError as exc:
        msg = str(exc).lower()
        if not any(token in msg for token in ("cuda", "out of memory", "unable to find an engine", "cudnn")):
            raise
        logger.warning(f"YOLO CUDA 추론 실패, CPU로 전환 후 재시도: {exc}")
        try:
            torch.cuda.empty_cache()
        except Exception:
            pass
        model.to("cpu")
        results = model(frame, verbose=False)

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "class_name": result.names[int(box.cls[0])],
                "confidence": round(float(box.conf[0]), 4),
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            })
    return detections


def _calc_iou(b1: dict, b2: dict) -> float:
    """두 bbox의 IoU 계산"""
    ix1 = max(b1["x1"], b2["x1"])
    iy1 = max(b1["y1"], b2["y1"])
    ix2 = min(b1["x2"], b2["x2"])
    iy2 = min(b1["y2"], b2["y2"])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    a1 = (b1["x2"] - b1["x1"]) * (b1["y2"] - b1["y1"])
    a2 = (b2["x2"] - b2["x1"]) * (b2["y2"] - b2["y1"])
    return inter / (a1 + a2 - inter)


def _soft_vote_merge(v8_dets: list, v11_dets: list) -> list:
    """
    YOLOv8 + YOLOv11 결과를 Soft Voting으로 병합
    - IoU >= IOU_TH 인 쌍: 가중 평균 신뢰도, YOLOv11 클래스 우선
    - 단독 감지: SOLO_TH 이상만 채택
    """
    merged = []
    used_v11 = set()

    for d8 in v8_dets:
        best_iou, best_idx, best_d11 = 0.0, -1, None
        for i, d11 in enumerate(v11_dets):
            if i in used_v11:
                continue
            iou = _calc_iou(d8["box"], d11["box"])
            if iou > best_iou:
                best_iou, best_idx, best_d11 = iou, i, d11

        if best_d11 and best_iou >= IOU_TH:
            used_v11.add(best_idx)
            avg_conf = round(W_V8 * d8["confidence"] + W_V11 * best_d11["confidence"], 4)
            # 신뢰도가 더 높은 모델의 클래스명 채택
            cls = best_d11["class_name"] if best_d11["confidence"] >= d8["confidence"] else d8["class_name"]
            merged.append({
                "class_name": cls,
                "confidence": avg_conf,
                "box": best_d11["box"],
                "source": "soft_voting",
                "v8_conf": d8["confidence"],
                "v11_conf": best_d11["confidence"],
            })
        elif d8["confidence"] >= SOLO_TH:
            merged.append({**d8, "source": "yolov8_only"})

    for i, d11 in enumerate(v11_dets):
        if i not in used_v11 and d11["confidence"] >= SOLO_TH:
            merged.append({**d11, "source": "yolov11_only"})

    return merged


def analyze_frame(frame: np.ndarray) -> tuple[list, bool]:
    """
    3모델 앙상블 파이프라인
    1) Keras 게이트 → 통과 시만 진행
    2) YOLOv8 + YOLOv11 동시 탐지
    3) Soft Voting 병합 → 최종 감지 결과 반환
    금지 클래스 판단은 service 레이어에서 수행

    Returns:
        (detections, keras_passed)
        keras_passed=False 이면 Keras가 안전 프레임으로 판별해 YOLO를 건너뜀
    """
    is_prohibited, keras_score = _keras_gate(frame)
    if not is_prohibited:
        return [], False

    v8_dets  = _run_yolo(get_yolo_v8(),  frame)
    v11_dets = _run_yolo(get_yolo_v11(), frame)
    merged   = _soft_vote_merge(v8_dets, v11_dets)

    for det in merged:
        det["keras_score"] = round(keras_score, 4)

    return merged, True
