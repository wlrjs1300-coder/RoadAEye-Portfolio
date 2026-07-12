import torch
from ultralytics import YOLO

from app.common.logger import logger

# GTX 1060 환경에서 cuDNN 엔진 선택 오류가 발생해 CUDA 기본 커널로 추론한다.
torch.backends.cudnn.enabled = False

YOLO_DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"


def _get_model_device(model: YOLO) -> str:
    try:
        return str(next(model.model.parameters()).device)
    except Exception:
        return "unknown"


class YoloDetector:
    def __init__(self, model_path: str):
        self.model = YOLO(model_path)
        try:
            self.model.to(YOLO_DEVICE)
        except Exception as exc:
            logger.warning(f"YOLO GPU 로드 실패, CPU로 전환: {exc}")
            self.model.to("cpu")
        device = _get_model_device(self.model)
        logger.info(f"YOLO 모델 로드 완료 ({device}): {model_path}")

    def _predict(self, source):
        try:
            return self.model(source)
        except RuntimeError as exc:
            msg = str(exc).lower()
            if not any(token in msg for token in ("cuda", "out of memory", "unable to find an engine", "cudnn")):
                raise
            logger.warning(f"YOLO CUDA 추론 실패, CPU로 전환 후 재시도: {exc}")
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass
            self.model.to("cpu")
            return self.model(source)

    def predict(self, image_path: str):
        results = self._predict(image_path)
        return self._parse_results(results)

    def predict_frame(self, frame):
        results = self._predict(frame)
        return self._parse_results(results)

    def _parse_results(self, results):
        detections = []
        for result in results:
            class_names = result.names
            for box in result.boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class_id": class_id,
                    "class_name": class_names[class_id],
                    "confidence": confidence,
                    "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
                })
        return detections