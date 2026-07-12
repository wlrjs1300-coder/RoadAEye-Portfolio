import os
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional

import cv2
import httpx

from app.modules.its.stream import FrameReader
from app.modules.its.pipeline import analyze_frame
from app.modules.its.repository import load_forbidden_classes, get_or_create_cctv
from app.modules.its.schemas import StreamStatus
from app.core.config import settings
from app.common.logger import logger

FRAME_INTERVAL = 1.0
PREVIEW_INTERVAL = 0.03
DETECTION_SAVE_COOLDOWN = 300.0
CAPTURE_DIR = "uploads/detections"

SAFE_FRAME_DIR      = "uploads/safe_frames"   # Keras 재학습용 안전 프레임 저장 경로
SAFE_FRAME_INTERVAL = 30.0                     # 카메라당 30초에 1장 저장
SAFE_FRAME_MAX      = 5000                     # 총 최대 저장 수 (초과 시 자동 중지)


def _is_quality_frame(frame) -> bool:
    """학습에 유의미한 프레임인지 품질 검사"""
    import numpy as np
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # 1. 밝기 검사: 너무 어둡거나(야간) 너무 밝은(역광) 프레임 제외
    mean_brightness = float(gray.mean())
    if mean_brightness < 40 or mean_brightness > 220:
        return False

    # 2. 선명도 검사: Laplacian 분산으로 흐림 감지 (값이 낮을수록 흐림)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if laplacian_var < 30:
        return False

    # 3. 단조로움 검사: 표준편차가 너무 낮으면 단색/텅 빈 프레임
    std_dev = float(gray.std())
    if std_dev < 15:
        return False

    return True


def _save_safe_frame(frame, camera_id: str) -> None:
    """YOLOv11 탐지 없음 + 품질 검사 통과 → Keras car 클래스 학습 데이터로 저장"""
    # 품질 필터 먼저 적용 (저장 I/O 최소화)
    if not _is_quality_frame(frame):
        return

    today = datetime.now().strftime("%Y%m%d")
    save_dir = os.path.join(SAFE_FRAME_DIR, today)
    os.makedirs(save_dir, exist_ok=True)

    # 최대 저장 수 체크
    total = sum(len(f) for _, _, f in os.walk(SAFE_FRAME_DIR))
    if total >= SAFE_FRAME_MAX:
        return

    ts = datetime.now().strftime("%H%M%S_%f")[:10]
    cam_safe = camera_id.replace("/", "_").replace(" ", "_")[:20]
    path = os.path.join(save_dir, f"{cam_safe}_{ts}.jpg")
    cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])


def _post_detection(cctv_no: int, class_no: int, confidence: float, image_path: str) -> None:
    """백엔드 POST /cctv/detections 호출 — 감지 기록 저장 + WebSocket 브로드캐스트"""
    url = f"{settings.ai_backend_url}/cctv/detections"
    payload = {
        "cctv_no":     cctv_no,
        "class_no":    class_no,
        "confidence":  confidence,
        "image_path":  image_path,
        "detected_at": datetime.now().isoformat(),
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
    except Exception as e:
        logger.error(f"백엔드 감지 전송 실패 (cctv_no={cctv_no}): {e}")


class _StreamWorker:
    def __init__(self, camera_id: str, stream_url: str, name: str, cctv_no: int):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.name = name
        self.cctv_no = cctv_no
        self.is_active = False
        self.frame_count = 0
        self.last_result: Optional[dict] = None
        # AI 분석 통계
        self.analyzed_count  = 0           # Keras까지 통과한 프레임 수
        self.keras_pass_count = 0          # Keras가 "금지 차량 있음"으로 판별한 수
        self.detection_count  = 0          # 실제 YOLO 감지 히트 누적
        self.last_analyzed_at: Optional[str] = None   # 마지막 분석 시각
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._capture_thread: Optional[threading.Thread] = None
        self._callbacks: list = []
        self._forbidden: dict = {}  # {class_name: class_no}
        self._latest_frame = None
        self._latest_jpeg: Optional[bytes] = None
        self._latest_annotated_jpeg: Optional[bytes] = None  # bbox 오버레이 포함 프레임
        self._last_detections: list = []  # 마지막 AI 분석 결과 (빠른 오버레이용)
        self._frame_lock = threading.Lock()
        self._last_saved_at: dict[int, float] = {}
        self._last_safe_saved_at: float = 0.0  # 안전 프레임 마지막 저장 시각

    def _reload_forbidden(self):
        try:
            self._forbidden = load_forbidden_classes()
            logger.info(f"금지 클래스 {len(self._forbidden)}개 로드 완료")
        except Exception as e:
            logger.warning(f"금지 클래스 로드 실패: {e}")

    def add_callback(self, cb):
        self._callbacks.append(cb)

    def remove_callback(self, cb):
        self._callbacks = [c for c in self._callbacks if c != cb]

    def start(self):
        self._reload_forbidden()
        self._stop_event.clear()
        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._capture_thread.start()
        self._thread.start()
        self.is_active = True
        logger.info(f"스트림 시작: {self.camera_id} ({self.name})")

    def stop(self):
        self._stop_event.set()
        if self._capture_thread:
            self._capture_thread.join(timeout=5)
        if self._thread:
            self._thread.join(timeout=5)
        self.is_active = False
        logger.info(f"스트림 중지: {self.camera_id}")

    def _draw_annotations(self, frame: "np.ndarray", detections: list) -> bytes:
        """탐지 결과를 프레임 위에 그려 JPEG bytes 반환"""
        import numpy as np
        annotated = frame.copy()
        h, w = annotated.shape[:2]

        for det in detections:
            cls  = det.get("class_name", "?")
            # car(일반 승용차)는 bbox 표시 제외 — 진입금지 차량 강조 목적
            if cls.lower() == "car":
                continue

            box = det.get("box", {})
            x1 = int(box.get("x1", 0)); y1 = int(box.get("y1", 0))
            x2 = int(box.get("x2", 0)); y2 = int(box.get("y2", 0))
            conf = det.get("confidence", 0)
            is_forbidden = cls in self._forbidden

            # 박스 색상: 금지=빨강, 기타=초록
            color = (0, 0, 220) if is_forbidden else (0, 180, 0)
            thick = 3 if is_forbidden else 2

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thick)

            # 라벨 배경 + 텍스트
            label = f"{cls} {conf*100:.0f}%"
            font_scale = max(0.45, min(w, h) / 1000)
            (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
            ty = max(y1 - 4, th + baseline)
            cv2.rectangle(annotated, (x1, ty - th - baseline), (x1 + tw + 4, ty + baseline), color, -1)
            cv2.putText(annotated, label, (x1 + 2, ty),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        # 탐지 건수 표시 (우상단)
        if detections:
            badge = f"DETECT: {len(detections)}"
            cv2.rectangle(annotated, (w - 115, 6), (w - 6, 26), (0, 0, 200), -1)
            cv2.putText(annotated, badge, (w - 110, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return buf.tobytes()

    def _save_frame_image(self, frame, class_name: str) -> str:
        """캡처 이미지를 저장하고 외부 접근 가능한 URL 반환"""
        os.makedirs(CAPTURE_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{self.camera_id}_{class_name}_{timestamp}.jpg"
        local_path = os.path.join(CAPTURE_DIR, filename)
        cv2.imwrite(local_path, frame)
        return f"{settings.ai_server_url}/images/{filename}"

    def _should_save_detection(self, class_no: int) -> bool:
        """같은 CCTV의 동일 클래스가 연속 감지될 때 저장 기록이 과도하게 쌓이지 않게 한다."""
        now = time.monotonic()
        last_saved_at = self._last_saved_at.get(class_no)
        if last_saved_at is not None and now - last_saved_at < DETECTION_SAVE_COOLDOWN:
            return False
        self._last_saved_at[class_no] = now
        return True

    def _capture_loop(self):
        """영상 출력용 최신 프레임을 추론과 독립적으로 계속 갱신한다."""
        retry_count = 0
        while not self._stop_event.is_set():
            reader = FrameReader(self.stream_url)
            if not reader.open():
                retry_count += 1
                wait = min(5 * retry_count, 60)
                logger.warning(f"스트림 연결 실패 ({self.name}) — {wait}초 후 재시도")
                self._stop_event.wait(wait)
                continue
            retry_count = 0
            logger.info(f"영상 캡처 연결 성공: {self.name}")
            try:
                while not self._stop_event.is_set():
                    frame = reader.read_frame()
                    if frame is None:
                        logger.warning(f"프레임 없음(클립 끝) — 재연결: {self.name}")
                        break
                    try:
                        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                        with self._frame_lock:
                            self._latest_frame = frame
                            self._latest_jpeg = buf.tobytes()
                    except Exception:
                        pass
                    self._stop_event.wait(PREVIEW_INTERVAL)
            finally:
                reader.release()

    def _run(self):
        """AI 분석은 캡처 루프가 보관한 최신 프레임만 샘플링한다."""
        while not self._stop_event.is_set():
            with self._frame_lock:
                frame = self._latest_frame.copy() if self._latest_frame is not None else None
            if frame is None:
                self._stop_event.wait(PREVIEW_INTERVAL)
                continue

            detections, keras_passed = analyze_frame(frame)
            self.frame_count += 1
            self.analyzed_count += 1
            self.last_analyzed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if keras_passed:
                self.keras_pass_count += 1

            # 탐지 결과 저장 (빠른 스트리밍에서 오버레이 재사용)
            with self._frame_lock:
                self._last_detections = detections

            # 항상 annotated JPEG 갱신 (탐지 없으면 원본 그대로)
            try:
                annotated = self._draw_annotations(frame, detections)
                with self._frame_lock:
                    self._latest_annotated_jpeg = annotated
            except Exception as e:
                logger.warning(f"어노테이션 그리기 실패: {e}")

            # ── 안전 프레임 자동 수집 (탐지 없음 = car only / 빈 도로) ──────────
            # Keras 재학습용 car 클래스 데이터 자동 수집
            # 탐지가 없고, 마지막 저장으로부터 30초 이상 경과 시 저장
            if not detections:
                now_mono = time.monotonic()
                if now_mono - self._last_safe_saved_at >= SAFE_FRAME_INTERVAL:
                    try:
                        _save_safe_frame(frame, self.camera_id)
                        self._last_safe_saved_at = now_mono
                    except Exception as e:
                        logger.debug(f"안전 프레임 저장 실패: {e}")

            # 시연용 데모 카메라는 감지 횟수만 집계하고 DB 저장 생략
            is_demo = self.camera_id == "demo-prohibited-vehicle"

            forbidden_hits = []
            for det in detections:
                class_no = self._forbidden.get(det["class_name"])
                if class_no:
                    forbidden_hits.append({**det, "class_no": class_no})
                    self.detection_count += 1
                    if not is_demo and self._should_save_detection(class_no):
                        image_url = self._save_frame_image(frame, det["class_name"])
                        _post_detection(
                            cctv_no=self.cctv_no,
                            class_no=class_no,
                            confidence=det["confidence"],
                            image_path=image_url,
                        )

            result = {
                "camera_id":            self.camera_id,
                "camera_name":          self.name,
                "timestamp":            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total_detections":     len(detections),
                "forbidden_detections": forbidden_hits,
            }
            self.last_result = result

            for cb in list(self._callbacks):
                try:
                    cb(self.camera_id, result)
                except Exception:
                    pass

            self._stop_event.wait(FRAME_INTERVAL)


class StreamManager:
    def __init__(self):
        self._workers: Dict[str, _StreamWorker] = {}
        self._lock = threading.Lock()

    def start_stream(
        self, camera_id: str, stream_url: str, name: str = "",
        coord_x: str = "", coord_y: str = ""
    ) -> bool:
        with self._lock:
            if camera_id in self._workers and self._workers[camera_id].is_active:
                return False

        try:
            lat = float(coord_y) if coord_y else None
            lon = float(coord_x) if coord_x else None
            cctv_no = get_or_create_cctv(camera_id, name, stream_url, lat, lon)
        except Exception as e:
            logger.error(f"CCTV 등록 실패: {e}")
            cctv_no = 0

        with self._lock:
            worker = _StreamWorker(camera_id, stream_url, name, cctv_no)
            self._workers[camera_id] = worker
        worker.start()
        return True

    def stop_stream(self, camera_id: str) -> bool:
        with self._lock:
            worker = self._workers.pop(camera_id, None)
        if worker:
            worker.stop()
            return True
        return False

    def stop_all(self):
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for w in workers:
            w.stop()

    def get_status(self) -> List[StreamStatus]:
        with self._lock:
            return [
                StreamStatus(
                    camera_id        = w.camera_id,
                    name             = w.name,
                    is_active        = w.is_active,
                    frame_count      = w.frame_count,
                    analyzed_count   = w.analyzed_count,
                    keras_pass_count = w.keras_pass_count,
                    detection_count  = w.detection_count,
                    last_analyzed_at = w.last_analyzed_at,
                )
                for w in self._workers.values()
            ]

    def get_latest(self, camera_id: str) -> Optional[dict]:
        with self._lock:
            w = self._workers.get(camera_id)
            return w.last_result if w else None

    def get_latest_jpeg(self, camera_id: str) -> Optional[bytes]:
        with self._lock:
            w = self._workers.get(camera_id)
        if not w:
            return None
        with w._frame_lock:
            return w._latest_jpeg

    def get_latest_annotated_jpeg(self, camera_id: str) -> Optional[bytes]:
        """bbox 오버레이가 그려진 최신 프레임 반환. 없으면 원본 반환."""
        with self._lock:
            w = self._workers.get(camera_id)
        if not w:
            return None
        with w._frame_lock:
            return w._latest_annotated_jpeg or w._latest_jpeg

    def get_fast_annotated_jpeg(self, camera_id: str) -> Optional[bytes]:
        """최신 raw 프레임에 마지막 AI 결과를 오버레이해 빠르게 반환 (~33fps)."""
        with self._lock:
            w = self._workers.get(camera_id)
        if not w:
            return None
        with w._frame_lock:
            frame = w._latest_frame
            detections = list(w._last_detections)
        if frame is None:
            return None
        try:
            return w._draw_annotations(frame, detections)
        except Exception:
            with w._frame_lock:
                return w._latest_jpeg

    def subscribe(self, camera_id: str, callback) -> bool:
        with self._lock:
            w = self._workers.get(camera_id)
            if w:
                w.add_callback(callback)
                return True
            return False

    def unsubscribe(self, camera_id: str, callback):
        with self._lock:
            w = self._workers.get(camera_id)
            if w:
                w.remove_callback(callback)


manager = StreamManager()
