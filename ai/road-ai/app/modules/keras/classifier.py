import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

import threading

import numpy as np
import tensorflow as tf

_model = None
_interpreter = None  # TFLite interpreter
_interpreter_lock = threading.Lock()
_is_tflite = False
_class_names: list[str] = []
_prohibited_set: set[str] = set()

IMAGE_SIZE = (224, 224)   # 로드 시 모델 입력 크기로 자동 갱신
_image_size = (224, 224)  # 실제 사용 크기


def load_model(model_path: str, metadata: dict) -> None:
    global _model, _interpreter, _is_tflite, _class_names, _prohibited_set, _image_size
    _class_names = metadata["classes"]
    _prohibited_set = set(metadata["prohibited"])

    if str(model_path).endswith(".tflite"):
        _is_tflite = True
        _interpreter = tf.lite.Interpreter(model_path=str(model_path))
        _interpreter.allocate_tensors()
        # TFLite 입력 크기 자동 감지
        in_shape = _interpreter.get_input_details()[0]["shape"]  # [1, H, W, C]
        _image_size = (int(in_shape[1]), int(in_shape[2]))
        _model = None
    else:
        _is_tflite = False
        _interpreter = None
        import tf_keras as keras
        _model = keras.models.load_model(model_path)
        # .keras 모델 입력 크기 자동 감지
        try:
            in_shape = _model.input_shape  # (None, H, W, C)
            _image_size = (int(in_shape[1]), int(in_shape[2]))
        except Exception:
            _image_size = (224, 224)

    from app.common.logger import logger
    logger.info(f"Keras 모델 로드: {model_path} | 입력 크기={_image_size}")


def is_loaded() -> bool:
    return _model is not None or _interpreter is not None


def predict(image_array: np.ndarray) -> dict:
    if not is_loaded():
        from app.common.exceptions import ModelNotLoadedError
        raise ModelNotLoadedError()

    img = tf.image.resize(image_array, _image_size)
    img = tf.expand_dims(img, axis=0)

    if _is_tflite:
        # A TFLite interpreter is not safe to invoke concurrently. CCTV stream
        # workers and API requests share this instance, so guard the full cycle.
        with _interpreter_lock:
            input_details = _interpreter.get_input_details()
            output_details = _interpreter.get_output_details()
            img_np = img.numpy().astype(input_details[0]["dtype"])
            _interpreter.set_tensor(input_details[0]["index"], img_np)
            _interpreter.invoke()
            out0 = _interpreter.get_tensor(output_details[0]["index"])
            out1 = _interpreter.get_tensor(output_details[1]["index"])
        # 출력 순서: 첫 번째가 다중 클래스, 두 번째가 이진 판별
        if out0.shape[-1] > out1.shape[-1]:
            vehicle_probs, prohibited_prob = out0, out1
        else:
            vehicle_probs, prohibited_prob = out1, out0
    else:
        vehicle_probs, prohibited_prob = _model.predict(img, verbose=0)

    class_idx = int(np.argmax(vehicle_probs[0]))
    class_name = _class_names[class_idx]
    confidence = float(vehicle_probs[0][class_idx])
    from app.core.config import settings
    is_prohibited = bool(prohibited_prob[0][0] > settings.keras_threshold)
    prohibited_score = float(prohibited_prob[0][0])

    return {
        "vehicle_class": class_name,
        "class_index": class_idx,
        "confidence": round(confidence, 4),
        "is_prohibited": is_prohibited,
        "prohibited_prob": round(prohibited_score, 4),
        "alert": "고속도로 진입 금지 차량 감지!" if is_prohibited else "정상 차량",
    }
