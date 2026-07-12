import os
import tempfile
from typing import Optional

import cv2
import httpx
import numpy as np

from app.common.logger import logger


class FrameReader:
    """
    ITS CCTV 스트림 리더.

    ITS API가 반환하는 URL은 video/mp4 클립이다.
    cv2.VideoCapture(url) 직접 열기가 이 환경에서 지원되지 않으므로,
    httpx로 클립을 내려받아 임시 파일로 저장 → cv2.VideoCapture(파일경로)로 열고
    클립이 끝나면 재다운로드하여 항상 최신 프레임을 유지한다.
    """

    def __init__(self, stream_url: str):
        self._url = stream_url
        self._cap: Optional[cv2.VideoCapture] = None
        self._tmp_path: Optional[str] = None

    # ── public API ──────────────────────────────────────────────────────────

    def open(self) -> bool:
        # 1) 직접 URL 시도 (지원 환경이면 빠름)
        cap = cv2.VideoCapture(self._url)
        if cap.isOpened():
            self._cap = cap
            logger.info(f"스트림 직접 연결: {self._url[:60]}")
            return True
        cap.release()

        # 2) MP4 다운로드 후 로컬 파일로 열기
        return self._download_and_open()

    def read_frame(self) -> Optional[np.ndarray]:
        if self._cap is None or not self._cap.isOpened():
            return None

        ret, frame = self._cap.read()
        if ret:
            return frame

        # 클립 끝 → 재다운로드
        self._close_cap()
        if self._download_and_open():
            ret, frame = self._cap.read()
            return frame if ret else None
        return None

    def release(self):
        self._close_cap()

    # ── private ─────────────────────────────────────────────────────────────

    def _download_and_open(self) -> bool:
        self._close_cap()
        try:
            r = httpx.get(self._url, timeout=15.0, follow_redirects=True)
            r.raise_for_status()

            tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            tmp.write(r.content)
            tmp.close()
            self._tmp_path = tmp.name

            cap = cv2.VideoCapture(self._tmp_path)
            if cap.isOpened():
                self._cap = cap
                logger.info(f"MP4 다운로드 후 열기 성공: {self._url[:60]}")
                return True

            cap.release()
            self._cleanup_tmp()
            logger.warning(f"다운로드된 MP4 열기 실패: {self._url[:60]}")
            return False

        except Exception as e:
            self._cleanup_tmp()
            logger.error(f"스트림 다운로드 실패 ({self._url[:60]}): {e}")
            return False

    def _close_cap(self):
        if self._cap:
            self._cap.release()
            self._cap = None
        self._cleanup_tmp()

    def _cleanup_tmp(self):
        if self._tmp_path:
            try:
                os.unlink(self._tmp_path)
            except Exception:
                pass
            self._tmp_path = None
