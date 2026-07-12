import base64

import cv2
import numpy as np


def b64_to_frame(b64_str: str) -> np.ndarray:
    raw = b64_str.split(",")[-1]  # data:image/...;base64, 프리픽스 제거
    img_bytes = base64.b64decode(raw)
    arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def open_stream(url: str) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        raise ConnectionError(f"스트림 연결 실패: {url}")
    return cap
