import base64
from io import BytesIO

import numpy as np
from PIL import Image


def bytes_to_array(image_bytes: bytes) -> np.ndarray:
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    return np.array(img, dtype=np.float32)


def b64_to_array(b64_str: str) -> np.ndarray:
    raw = b64_str.split(",")[-1]
    return bytes_to_array(base64.b64decode(raw))
