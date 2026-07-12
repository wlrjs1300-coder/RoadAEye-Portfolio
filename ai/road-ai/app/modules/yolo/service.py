import asyncio
import os
import uuid
from typing import AsyncGenerator

import cv2
import httpx
from fastapi import UploadFile

from app.modules.yolo.detector import YoloDetector
from app.modules.yolo.utils import b64_to_frame, open_stream


MODEL_PATH_V1 = "models/yolo/v1/best.pt"          # YOLOv8
MODEL_PATH_V3 = "models/yolo/v3/yolov11m_v3_best.pt"  # YOLOv11
UPLOAD_DIR = "uploads/yolo"
VIDEO_UPLOAD_DIR = "uploads/yolo/videos"
ITS_API_URL = "https://data.ex.co.kr/openapi/cctvNew/getCctvInfo"

detector    = YoloDetector(MODEL_PATH_V1)
detector_v3 = YoloDetector(MODEL_PATH_V3)


async def _save_and_predict(content: bytes, filename: str, det: YoloDetector):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_ext = filename.split(".")[-1] if "." in filename else "jpg"
    save_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}.{file_ext}")
    with open(save_path, "wb") as f:
        f.write(content)
    results = det.predict(save_path)
    return results


async def predict_image(file: UploadFile):
    content = await file.read()
    results = await _save_and_predict(content, file.filename, detector)
    return {
        "success": True,
        "message": "YOLOv8 prediction completed",
        "model": "YOLOv8",
        "count": len(results),
        "results": results,
    }


async def predict_image_v3(file: UploadFile):
    """YOLOv11 (v3) 예측"""
    content = await file.read()
    results = await _save_and_predict(content, file.filename, detector_v3)
    return {
        "success": True,
        "message": "YOLOv11 prediction completed",
        "model": "YOLOv11",
        "count": len(results),
        "results": results,
    }


async def predict_ensemble(file: UploadFile):
    """
    3모델 앙상블 (Soft Voting)
    1단계: Keras 게이트 (이진 판별)
    2단계: YOLOv8 + YOLOv11 동시 실행 → Soft Voting 병합
    """
    import numpy as np, cv2
    from app.modules.keras import classifier
    from app.modules.its.pipeline import (
        _frame_to_keras_input, _run_yolo, _soft_vote_merge,
        get_yolo_v8, get_yolo_v11,
    )

    content = await file.read()
    arr   = np.frombuffer(content, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    # 1단계: Keras 게이트
    keras_result = None
    gate_passed  = True
    if frame is not None and classifier.is_loaded():
        kres         = classifier.predict(_frame_to_keras_input(frame))
        keras_result = kres
        gate_passed  = kres["is_prohibited"]

    v8_results   = []
    v11_results  = []
    merged       = []

    # 2단계: Keras 게이트 통과 시 두 YOLO 동시 실행
    if gate_passed and frame is not None:
        v8_results  = _run_yolo(get_yolo_v8(),  frame)
        v11_results = _run_yolo(get_yolo_v11(), frame)
        merged      = _soft_vote_merge(v8_results, v11_results)
        for det in merged:
            det["keras_score"] = round(keras_result["prohibited_prob"], 4) if keras_result else None

    return {
        "success": True,
        "message": "Ensemble (Soft Voting) prediction completed",
        "keras": keras_result,
        "yolo_skipped": not gate_passed,
        # 최종 병합 결과
        "yolo": {
            "model": "YOLOv8 + YOLOv11 Soft Voting",
            "count": len(merged),
            "results": merged,
        },
        # 각 모델 단독 결과 (디버깅/비교용)
        "detail": {
            "yolov8":  {"count": len(v8_results),  "results": v8_results},
            "yolov11": {"count": len(v11_results), "results": v11_results},
        },
    }


async def analyze_video(
    file: UploadFile,
    sample_interval_sec: float = 1.0,
    max_frames: int = 60,
):
    """
    업로드 영상을 프레임 단위로 샘플링하여 3모델 앙상블으로 분석한다.
    긴 영상은 테스트 페이지 응답성을 위해 최대 분석 프레임 수를 제한한다.
    """
    from app.modules.keras import classifier
    from app.modules.its.pipeline import (
        _frame_to_keras_input, _run_yolo, _soft_vote_merge,
        get_yolo_v8, get_yolo_v11,
    )

    os.makedirs(VIDEO_UPLOAD_DIR, exist_ok=True)
    file_ext = filename_ext(file.filename, "mp4")
    save_path = os.path.join(VIDEO_UPLOAD_DIR, f"{uuid.uuid4()}.{file_ext}")
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    cap = cv2.VideoCapture(save_path)
    if not cap.isOpened():
        raise ValueError("영상을 열 수 없습니다. MP4/WebM/AVI 파일인지 확인해 주세요.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = round(total_frames / fps, 2) if fps else None
    step = max(1, int(round((fps or 30) * max(sample_interval_sec, 0.2))))
    max_frames = max(1, min(max_frames, 180))

    frame_results = []
    class_counts: dict[str, int] = {}
    total_detections = 0
    yolo_skipped_count = 0
    analyzed = 0
    frame_idx = 0

    try:
        while analyzed < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step != 0:
                frame_idx += 1
                continue

            timestamp_sec = round(frame_idx / fps, 2) if fps else round(analyzed * sample_interval_sec, 2)
            keras_result = None
            gate_passed = True
            if classifier.is_loaded():
                keras_result = classifier.predict(_frame_to_keras_input(frame))
                gate_passed = bool(keras_result["is_prohibited"])

            v8_results = []
            v11_results = []
            merged = []
            if gate_passed:
                v8_results = _run_yolo(get_yolo_v8(), frame)
                v11_results = _run_yolo(get_yolo_v11(), frame)
                merged = _soft_vote_merge(v8_results, v11_results)
                for det in merged:
                    det["keras_score"] = round(keras_result["prohibited_prob"], 4) if keras_result else None
                    class_counts[det["class_name"]] = class_counts.get(det["class_name"], 0) + 1
                total_detections += len(merged)
            else:
                yolo_skipped_count += 1

            frame_results.append({
                "frame_index": frame_idx,
                "timestamp_sec": timestamp_sec,
                "keras": keras_result,
                "yolo_skipped": not gate_passed,
                "yolo": {
                    "model": "YOLOv8 + YOLOv11 Soft Voting",
                    "count": len(merged),
                    "results": merged,
                },
                "detail": {
                    "yolov8": {"count": len(v8_results), "results": v8_results},
                    "yolov11": {"count": len(v11_results), "results": v11_results},
                },
            })
            analyzed += 1
            frame_idx += 1
    finally:
        cap.release()

    detection_events = [
        {
            "timestamp_sec": r["timestamp_sec"],
            "frame_index": r["frame_index"],
            "detections": r["yolo"]["results"],
        }
        for r in frame_results
        if r["yolo"]["count"] > 0
    ]

    return {
        "success": True,
        "message": "Video ensemble analysis completed",
        "video": {
            "filename": file.filename,
            "fps": round(fps, 2) if fps else None,
            "total_frames": total_frames,
            "duration_sec": duration_sec,
            "sample_interval_sec": sample_interval_sec,
            "frames_analyzed": analyzed,
            "max_frames": max_frames,
        },
        "summary": {
            "total_detections": total_detections,
            "frames_with_detections": len(detection_events),
            "yolo_skipped_frames": yolo_skipped_count,
            "class_counts": class_counts,
        },
        "events": detection_events,
        "frames": frame_results,
    }


def filename_ext(filename: str | None, default: str) -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


async def predict_b64(b64: str) -> dict:
    frame = b64_to_frame(b64)
    results = detector.predict_frame(frame)
    return {
        "success": True,
        "message": "YOLO prediction completed",
        "count": len(results),
        "results": results,
    }


async def stream_rtsp_detections(url: str) -> AsyncGenerator[dict, None]:
    loop = asyncio.get_event_loop()
    cap = open_stream(url)  # raises ConnectionError if fails
    try:
        while True:
            ret, frame = await loop.run_in_executor(None, cap.read)
            if not ret:
                break
            results = detector.predict_frame(frame)
            yield {"success": True, "count": len(results), "results": results}
    finally:
        cap.release()


async def fetch_its_streams(api_key: str, road_route_code: str = None) -> list:
    params = {"key": api_key, "type": "json", "cctvType": 1}
    if road_route_code:
        params["roadRouteCode"] = road_route_code
    async with httpx.AsyncClient() as client:
        resp = await client.get(ITS_API_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    return data.get("list", [])
