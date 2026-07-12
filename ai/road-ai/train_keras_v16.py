"""
Keras 게이트 v16 학습 스크립트
- 안전(0): uploads/safe_frames/ — 5,000장 (실제 고속도로 CCTV 미탐지 프레임)
- 금지차량(1): uploads/detections/ — 2,148장 (실제 CCTV 탐지 프레임)
- class_weight 으로 클래스 불균형 보정
- MobileNetV2 파인튜닝 (상위 30레이어 언프리즈)
- 출력: models/keras/v3/highway_model_v16.keras
"""
import os, glob, random
os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ["CUDA_VISIBLE_DEVICES"] = ""  # CPU 전용 (YOLO와 GPU 충돌 방지)

import numpy as np
import cv2
import tensorflow as tf
import tf_keras as keras
from sklearn.model_selection import train_test_split

tf.config.set_visible_devices([], "GPU")

# ── 설정 ──────────────────────────────────────────────────────────────────────
IMG_SIZE   = 224
BATCH_SIZE = 32
EPOCHS_1   = 10   # 헤드만 학습 (베이스 동결)
EPOCHS_2   = 20   # 상위 레이어 언프리즈 후 파인튜닝
SEED       = 42

SAFE_DIR      = "uploads/safe_frames"
DETECT_DIR    = "uploads/detections"
OUTPUT_PATH   = "models/keras/v3/highway_model_v16.keras"

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


# ── 데이터 로드 ────────────────────────────────────────────────────────────────
print("데이터 경로 수집 중...")
safe_paths      = glob.glob(f"{SAFE_DIR}/**/*.jpg", recursive=True)
detected_paths  = glob.glob(f"{DETECT_DIR}/**/*.jpg", recursive=True)

print(f"  안전(0): {len(safe_paths)}장")
print(f"  금지차량(1): {len(detected_paths)}장")

all_paths  = safe_paths + detected_paths
all_labels = [0] * len(safe_paths) + [1] * len(detected_paths)

# class_weight 계산 (불균형 보정)
n_safe     = len(safe_paths)
n_prohib   = len(detected_paths)
n_total    = n_safe + n_prohib
w_safe     = round(n_total / (2 * n_safe),   4)
w_prohib   = round(n_total / (2 * n_prohib), 4)
class_weight = {0: w_safe, 1: w_prohib}
print(f"\nclass_weight: {class_weight}")

# train / val 분리 (80:20)
train_paths, val_paths, train_labels, val_labels = train_test_split(
    all_paths, all_labels, test_size=0.2, stratify=all_labels, random_state=SEED
)
print(f"\n학습: {len(train_paths)}장  /  검증: {len(val_paths)}장")


# ── 이미지 로드 함수 ───────────────────────────────────────────────────────────
def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        return np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.float32)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    return img.astype(np.float32) / 255.0


def build_dataset(paths, labels, augment=False):
    def gen():
        combined = list(zip(paths, labels))
        random.shuffle(combined)
        for p, l in combined:
            yield load_image(p), l

    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            tf.TensorSpec(shape=(IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32),
            tf.TensorSpec(shape=(), dtype=tf.int32),
        )
    )

    if augment:
        aug = keras.Sequential([
            keras.layers.RandomFlip("horizontal"),
            keras.layers.RandomRotation(0.1),
            keras.layers.RandomZoom(0.1),
            keras.layers.RandomBrightness(0.2),
            keras.layers.RandomContrast(0.2),
        ])
        ds = ds.map(lambda x, y: (aug(x, training=True), y),
                    num_parallel_calls=tf.data.AUTOTUNE)

    return ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)


print("\n데이터셋 구성 중...")
train_ds = build_dataset(train_paths, train_labels, augment=True)
val_ds   = build_dataset(val_paths,   val_labels,   augment=False)


# ── 모델 구성 ──────────────────────────────────────────────────────────────────
print("\n모델 구성 중...")
base = keras.applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
)
base.trainable = False

inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
x = base(inputs, training=False)
x = keras.layers.GlobalAveragePooling2D()(x)
x = keras.layers.BatchNormalization()(x)
x = keras.layers.Dense(128, activation="relu")(x)
x = keras.layers.Dropout(0.4)(x)
x = keras.layers.Dense(64, activation="relu")(x)
x = keras.layers.Dropout(0.3)(x)
out = keras.layers.Dense(1, activation="sigmoid", name="is_prohibited")(x)

model = keras.Model(inputs, out, name="highway_gate_v16")
model.compile(
    optimizer=keras.optimizers.Adam(1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy", keras.metrics.AUC(name="auc")],
)
model.summary()


# ── 1단계: 헤드 학습 ───────────────────────────────────────────────────────────
print(f"\n[1단계] 헤드 학습 ({EPOCHS_1} 에포크) ...")
callbacks_1 = [
    keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True, verbose=1),
    keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=2, verbose=1),
]
model.fit(
    train_ds, validation_data=val_ds,
    epochs=EPOCHS_1, class_weight=class_weight,
    callbacks=callbacks_1,
)


# ── 2단계: 상위 30 레이어 언프리즈 후 파인튜닝 ────────────────────────────────
print(f"\n[2단계] 파인튜닝 ({EPOCHS_2} 에포크) ...")
base.trainable = True
for layer in base.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=keras.optimizers.Adam(1e-4),
    loss="binary_crossentropy",
    metrics=["accuracy", keras.metrics.AUC(name="auc")],
)

callbacks_2 = [
    keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, verbose=1),
    keras.callbacks.ReduceLROnPlateau(factor=0.3, patience=3, verbose=1),
    keras.callbacks.ModelCheckpoint(
        OUTPUT_PATH, save_best_only=True, monitor="val_auc", mode="max", verbose=1
    ),
]
model.fit(
    train_ds, validation_data=val_ds,
    epochs=EPOCHS_2, class_weight=class_weight,
    callbacks=callbacks_2,
)


# ── 저장 및 검증 ───────────────────────────────────────────────────────────────
print(f"\n모델 저장: {OUTPUT_PATH}")
model.save(OUTPUT_PATH)

print("\n=== 편향 검증 ===")
def check(arr, label):
    inp = np.expand_dims(arr.astype(np.float32) / 255.0, axis=0)
    score = float(model.predict(inp, verbose=0)[0][0])
    tag = "금지차량" if score >= 0.5 else "안전"
    ok = "✅" if (label == 1 and score >= 0.5) or (label == 0 and score < 0.5) else "❌"
    print(f"  {ok}  점수={score:.4f} ({tag})")

print("흰색 단색 (기대: 안전):")
check(np.ones((224,224,3))*255, 0)
print("검은색 단색 (기대: 안전):")
check(np.zeros((224,224,3)), 0)
print("랜덤 노이즈 (기대: 안전):")
check(np.random.randint(0,255,(224,224,3)), 0)

# 실제 이미지 샘플
safe_sample = random.sample(safe_paths, min(3, len(safe_paths)))
prohib_sample = random.sample(detected_paths, min(3, len(detected_paths)))

print("\n실제 안전 프레임 3장 (기대: 안전):")
for p in safe_sample:
    img = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))
    check(img, 0)

print("\n실제 금지차량 프레임 3장 (기대: 금지차량):")
for p in prohib_sample:
    img = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))
    check(img, 1)

print("\n학습 완료!")
print(f"모델 저장 위치: {OUTPUT_PATH}")
print("업로드: http://<AI_SERVER_IP>:8001/model-upload 에서 확인 가능")
