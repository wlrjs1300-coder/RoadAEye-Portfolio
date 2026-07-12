"""
services/stream_service.py
실시간 CCTV MJPEG 스트리밍 서비스

흐름:
  RTSP/HTTP 스트림 → OpenCV VideoCapture (URL당 단일 백그라운드 스레드)
  → 최신 프레임 캐시 → JPEG 인코딩 → multipart/x-mixed-replace 스트리밍
  → 브라우저 <img src="/cctv/{id}/stream"> 또는 React fetch로 수신
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import AsyncGenerator, Optional

import cv2

logger = logging.getLogger(__name__)


class _FrameReader:
    """
    URL당 하나의 백그라운드 스레드로 프레임을 지속적으로 읽어
    최신 프레임을 _frame에 저장.
    cap.read()를 단일 스레드에서만 호출하므로 FFmpeg 스레드 충돌 없음.
    """

    def __init__(self, stream_url: str):
        self.stream_url = stream_url
        self._frame: Optional[bytes] = None
        self._lock   = threading.Lock()
        self._stop   = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        cap = self._open()
        fail_count = 0
        MAX_FAILS = 10  # 10회 연속 실패 시 스레드 종료
        while not self._stop.is_set():
            if cap is None or not cap.isOpened():
                fail_count += 1
                if fail_count >= MAX_FAILS:
                    logger.error("스트림 최대 재시도 초과, 종료: %s", self.stream_url)
                    break
                logger.warning("스트림 재연결 시도 (%d/%d): %s", fail_count, MAX_FAILS, self.stream_url)
                time.sleep(min(fail_count * 2, 30))  # 점진적 대기
                cap = self._open()
                continue
            fail_count = 0  # 성공 시 초기화

            ok, frame = cap.read()
            if not ok:
                logger.warning("프레임 읽기 실패, 재연결: %s", self.stream_url)
                cap.release()
                cap = None
                continue

            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            with self._lock:
                self._frame = buf.tobytes()

            time.sleep(0.033)  # ~30 fps

        if cap:
            cap.release()

    def _open(self) -> Optional[cv2.VideoCapture]:
        cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            logger.error("스트림 연결 실패: %s", self.stream_url)
            cap.release()
            return None
        return cap

    def latest_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=5)


class StreamManager:
    """URL별 FrameReader 관리."""

    def __init__(self):
        self._readers: dict[str, _FrameReader] = {}
        self._lock = threading.Lock()

    def _get_reader(self, stream_url: str) -> _FrameReader:
        with self._lock:
            if stream_url not in self._readers:
                self._readers[stream_url] = _FrameReader(stream_url)
            return self._readers[stream_url]

    def release(self, stream_url: str):
        with self._lock:
            reader = self._readers.pop(stream_url, None)
        if reader:
            reader.stop()

    def release_all(self):
        with self._lock:
            readers = list(self._readers.values())
            self._readers.clear()
        for r in readers:
            r.stop()


stream_manager = StreamManager()


async def mjpeg_generator(stream_url: str) -> AsyncGenerator[bytes, None]:
    """
    MJPEG 멀티파트 스트림 제너레이터.

    FastAPI에서:
        return StreamingResponse(
            mjpeg_generator(url),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
    """
    reader = stream_manager._get_reader(stream_url)

    # 첫 프레임 최대 10초 대기
    for _ in range(100):
        if reader.latest_frame() is not None:
            break
        await asyncio.sleep(0.1)
    else:
        logger.error("스트림 첫 프레임 수신 실패: %s", stream_url)
        return

    try:
        while True:
            frame = reader.latest_frame()
            if frame is None:
                await asyncio.sleep(0.1)
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )

            await asyncio.sleep(0.033)  # ~30 fps

    except asyncio.CancelledError:
        logger.info("클라이언트 연결 종료: %s", stream_url)


async def capture_snapshot(stream_url: str) -> Optional[bytes]:
    """단일 프레임 JPEG bytes 반환"""
    reader = stream_manager._get_reader(stream_url)

    for _ in range(50):
        frame = reader.latest_frame()
        if frame is not None:
            return frame
        await asyncio.sleep(0.1)

    logger.error("스냅샷 실패 — 프레임 없음: %s", stream_url)
    return None
