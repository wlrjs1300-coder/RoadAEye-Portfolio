"""
Grad-CAM 히트맵 생성 — MobileNetV2 이진 분류 모델용

AI 모델이 이미지의 어느 영역을 근거로 판정했는지 시각화한다.
MobileNetV2가 중첩 서브모델로 저장된 경우(Graph disconnected 오류)도 처리한다.
"""
import cv2
import numpy as np


def _find_last_conv_layer(model):
    for layer in reversed(model.layers):
        try:
            shape = layer.output_shape
            if isinstance(shape, list):
                shape = shape[0]
            if len(shape) == 4:
                return layer
        except Exception:
            continue
    return None


def compute_gradcam(model, img_224: np.ndarray) -> np.ndarray:
    """
    img_224: (224, 224, 3) float32, 값 범위 0~1
    Returns: heatmap (H_feat, W_feat) float32, 0~1
    """
    import tensorflow as tf
    import tf_keras as keras

    inp = tf.Variable(tf.cast(tf.expand_dims(img_224, axis=0), tf.float32))

    # MobileNetV2 같은 중첩 서브모델이 있으면 그래프가 분리되어
    # keras.Model(inputs=model.inputs, ...) 로 grad_model을 만들 수 없다.
    # 서브모델 내부 그래프에서 feat_model을 만들고 헤드 레이어를 순차 실행한다.
    base_model = next(
        (l for l in model.layers if hasattr(l, "layers") and len(l.layers) > 5),
        None,
    )

    if base_model is not None:
        conv_layer = _find_last_conv_layer(base_model)
        if conv_layer is None:
            raise ValueError("Conv 레이어를 찾을 수 없습니다.")

        feat_model = keras.Model(
            inputs=base_model.inputs,
            outputs=[conv_layer.output, base_model.output],
        )

        head_layers = []
        after_base = False
        for layer in model.layers:
            if after_base:
                head_layers.append(layer)
            if layer is base_model:
                after_base = True

        with tf.GradientTape() as tape:
            conv_outputs, base_features = feat_model(inp)
            tape.watch(conv_outputs)
            x = base_features
            for layer in head_layers:
                x = layer(x, training=False)
            score = x[:, 0]

        grads = tape.gradient(score, conv_outputs)
    else:
        conv_layer = _find_last_conv_layer(model)
        if conv_layer is None:
            raise ValueError("Conv 레이어를 찾을 수 없습니다.")

        grad_model = keras.Model(
            inputs=model.inputs,
            outputs=[conv_layer.output, model.output],
        )
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(inp)
            tape.watch(conv_outputs)
            score = predictions[:, 0]

        grads = tape.gradient(score, conv_outputs)

    if grads is None:
        raise ValueError("그래디언트 계산에 실패했습니다.")

    pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
    cam = (conv_outputs[0] @ pooled[..., tf.newaxis]).numpy().squeeze()
    cam = np.maximum(cam, 0)
    if cam.max() > 0:
        cam /= cam.max()
    return cam


def overlay_heatmap(original_rgb: np.ndarray, heatmap: np.ndarray, alpha: float = 0.45) -> bytes:
    """
    original_rgb : (H, W, 3) uint8 RGB 원본 이미지 (임의 크기 가능)
    heatmap      : compute_gradcam() 반환값
    Returns      : JPEG bytes (히트맵 오버레이 완성 이미지)
    """
    h, w = original_rgb.shape[:2]
    hm = cv2.resize(heatmap.astype(np.float32), (w, h))
    hm_uint8 = np.uint8(255 * hm)
    hm_color = cv2.applyColorMap(hm_uint8, cv2.COLORMAP_JET)          # BGR
    original_bgr = cv2.cvtColor(original_rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
    result = cv2.addWeighted(original_bgr, 1 - alpha, hm_color, alpha, 0)
    _, buf = cv2.imencode(".jpg", result, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes()
