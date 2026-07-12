import threading
from datetime import datetime

from app.modules.keras import classifier
from app.modules.keras.utils import bytes_to_array, b64_to_array
from app.modules.keras.schemas import ClassifyResponse, StatsResponse, AlertItem

_stats: dict = {
    "total": 0,
    "prohibited": 0,
    "allowed": 0,
    "by_type": {},
    "recent_alerts": [],
}
_lock = threading.Lock()


def classify_image(image_bytes: bytes) -> ClassifyResponse:
    arr = bytes_to_array(image_bytes)
    result = classifier.predict(arr)
    _update_stats(result)
    return ClassifyResponse(**result)


def classify_b64(b64_str: str) -> ClassifyResponse:
    arr = b64_to_array(b64_str)
    result = classifier.predict(arr)
    _update_stats(result)
    return ClassifyResponse(**result)


def get_stats() -> StatsResponse:
    with _lock:
        return StatsResponse(
            total=_stats["total"],
            prohibited=_stats["prohibited"],
            allowed=_stats["allowed"],
            by_type=dict(_stats["by_type"]),
            recent_alerts=[AlertItem(**a) for a in _stats["recent_alerts"]],
        )


def _update_stats(result: dict) -> None:
    with _lock:
        _stats["total"] += 1
        key = "prohibited" if result["is_prohibited"] else "allowed"
        _stats[key] += 1

        vtype = result["vehicle_class"]
        _stats["by_type"][vtype] = _stats["by_type"].get(vtype, 0) + 1

        if result["is_prohibited"]:
            alert = {
                "time": datetime.now().strftime("%H:%M:%S"),
                "type": result["vehicle_class"],
                "confidence": round(result["confidence"] * 100, 1),
            }
            _stats["recent_alerts"].insert(0, alert)
            _stats["recent_alerts"] = _stats["recent_alerts"][:20]
