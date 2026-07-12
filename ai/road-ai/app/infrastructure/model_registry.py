import json
from pathlib import Path

# road-ai/models/ 기준 경로
MODELS_ROOT = Path(__file__).parents[2] / "models"

_REGISTRY: dict[str, dict[str, Path]] = {
    "keras": {
        "v1": MODELS_ROOT / "keras" / "v1",
        "v3": MODELS_ROOT / "keras" / "v3",
    },
    "yolo": {
        "v1": MODELS_ROOT / "yolo" / "v1",
        "v2": MODELS_ROOT / "yolo" / "v2",
        "v3": MODELS_ROOT / "yolo" / "v3",
    },
    "llm": {
        "mistral-7b": MODELS_ROOT / "llm" / "mistral-7b",
    },
}

# 버전별 Keras 모델 파일명 (확장자 포함)
_KERAS_FILENAMES: dict[str, str] = {
    "v1": "highway_model.keras",
    "v3": "highway_model_v3_fp16.tflite",
}

# 버전별 YOLO 모델 파일명
_YOLO_FILENAMES: dict[str, str] = {
    "v1": "best.pt",
    "v2": "best.pt",
    "v3": "yolov11m_v3_best.pt",
}


def get_model_dir(module: str, version: str) -> Path:
    try:
        return _REGISTRY[module][version]
    except KeyError:
        raise ValueError(f"등록되지 않은 모델: {module}/{version}")


def get_keras_model_path(version: str = "v1") -> Path:
    base = get_model_dir("keras", version)
    filename = _KERAS_FILENAMES.get(version, "highway_model.keras")
    return base / filename


def get_yolo_model_path(version: str = "v1") -> Path:
    base = get_model_dir("yolo", version)
    filename = _YOLO_FILENAMES.get(version, "best.pt")
    return base / filename


def get_keras_metadata(version: str = "v1") -> dict:
    meta_path = get_model_dir("keras", version) / "metadata.json"
    with open(meta_path, encoding="utf-8") as f:
        return json.load(f)


def list_versions(module: str) -> list[str]:
    return list(_REGISTRY.get(module, {}).keys())
