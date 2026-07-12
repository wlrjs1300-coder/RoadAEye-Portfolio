"""
Keras 게이트 모델 v15 학습 스크립트 (GPU 버전)
- RTX 5060 8GB / Python 3.11.9 / TF 2.21.0 / CUDA 12.8 환경
- 이진 분류 (safe=0 / prohibited=1)
- safe 2,148장 : prohibited 2,148장 = 1:1 균형
- MobileNetV2 224×224
- 2단계 파인튜닝
"""
import os
import random
import math
import numpy as np
import glob
from pathlib import Path
from sklearn.model_selection import train_test_split
from PIL import Image

# GPU 사용 (RTX 5060) — CUDA_VISIBLE_DEVICES 설정 없음
import tf_keras as keras
from tf_keras.applications import MobileNetV2
from tf_keras.layers import GlobalAveragePooling2D, Dense, Dropout, BatchNormalization
from tf_keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
import tensorflow as tf

# ── 경로 설정 (학습 PC 기준으로 수정 필요) ────────────────────────────────────
# 아래 두 경로에 데이터를 복사한 뒤 실행하세요
SAFE_DIR       = Path("safe_frames")  # 정상 프레임 (label=0)
PROHIBITED_DIR = Path("detections")  # 금지차량 프레임 (label=1)
OUTPUT_DIR     = Path("output")
OUTPUT_PATH    = OUTPUT_DIR / "highway_model_v15.keras"
BEST_PATH      = OUTPUT_DIR / "highway_model_v15_best.keras"

IMG_SIZE   = 224
BATCH_SIZE = 32   # RTX 5060 8GB → 32 사용
SEED       = 42
THRESHOLD  = 0.3

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


# ── GPU 확인 ─────────────────────────────────────────────────────────────────
gpus = tf.config.list_physical_devices("GPU")
if gpus:
    print(f"GPU 감지: {[g.name for g in gpus]}")
    # 메모리 증가 허용 (OOM 방지)
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)
else:
    print("GPU 없음 — CPU 학습 (느림)")


# ── 이미지 로드 (32GB RAM이므로 전체 메모리 로드) ─────────────────────────────
def load_images(paths: list[str], label: str = "") -> np.ndarray:
    imgs, failed = [], 0
    total = len(paths)
    for i, p in enumerate(paths):
        if i % 200 == 0:
            print(f"  {label} 로드 중... {i}/{total}", end="\r")
        try:
            img = Image.open(p).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
            imgs.append(np.array(img, dtype=np.float32) / 255.0)
        except Exception:
            failed += 1
    print(f"  {label} 로드 완료: {len(imgs)}장 (실패 {failed}장)      ")
    return np.array(imgs, dtype=np.float32)


# ── 증강 제너레이터 ───────────────────────────────────────────────────────────
class AugmentGenerator(keras.utils.Sequence):
    def __init__(self, X, y, batch_size=BATCH_SIZE, augment=False, shuffle=True):
        self.X, self.y   = X, y
        self.batch_size  = batch_size
        self.augment     = augment
        self.shuffle     = shuffle
        self.on_epoch_end()

    def __len__(self):
        return math.ceil(len(self.X) / self.batch_size)

    def on_epoch_end(self):
        self.idx = np.arange(len(self.X))
        if self.shuffle:
            np.random.shuffle(self.idx)

    def __getitem__(self, i):
        batch = self.idx[i * self.batch_size:(i + 1) * self.batch_size]
        X_b = self.X[batch].copy()
        if self.augment:
            X_b = self._aug_batch(X_b)
        return X_b, self.y[batch]

    def _aug_batch(self, X):
        for i in range(len(X)):
            if random.random() < 0.5:
                X[i] = X[i, :, ::-1, :]                          # 수평 뒤집기
            X[i] = np.clip(X[i] * random.uniform(0.8, 1.2), 0, 1)  # 밝기
        return X


# ── 모델 정의 ─────────────────────────────────────────────────────────────────
def build_model(trainable_backbone=False) -> keras.Model:
    backbone = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    backbone.trainable = trainable_backbone

    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = backbone(inputs, training=trainable_backbone)
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(128, activation="relu")(x)
    x = Dropout(0.4)(x)
    x = Dense(64, activation="relu")(x)
    x = Dropout(0.3)(x)
    output = Dense(1, activation="sigmoid", name="is_prohibited")(x)

    return keras.Model(inputs, output, name="highway_gate_v15")


# ── 평가 ─────────────────────────────────────────────────────────────────────
def evaluate(model, X, y, threshold=THRESHOLD, label=""):
    preds    = model.predict(X, batch_size=BATCH_SIZE, verbose=0).flatten()
    pred_bin = (preds >= threshold).astype(int)

    tp = int(np.sum((pred_bin == 1) & (y == 1)))
    tn = int(np.sum((pred_bin == 0) & (y == 0)))
    fp = int(np.sum((pred_bin == 1) & (y == 0)))
    fn = int(np.sum((pred_bin == 0) & (y == 1)))

    acc       = (tp + tn) / len(y)
    precision = tp / (tp + fp + 1e-8)
    recall    = tp / (tp + fn + 1e-8)
    f1        = 2 * precision * recall / (precision + recall + 1e-8)

    print(f"\n{'='*55}")
    print(f"[{label}] 임계값 {threshold} 기준 평가")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall   : {recall:.4f}  ← 핵심 지표 (0.85 이상 목표)")
    print(f"  F1 Score : {f1:.4f}")
    print(f"  TP={tp}  TN={tn}  FP={fp}  FN={fn}")
    print(f"  미탐지(FN)율: {fn/(tp+fn+1e-8):.2%}")
    print(f"  평균 예측 확률: {preds.mean():.4f}  std: {preds.std():.4f}")

    uniq, cnts = np.unique(pred_bin, return_counts=True)
    print(f"  예측 분포: {dict(zip(uniq.tolist(), cnts.tolist()))}")

    if preds.std() < 0.01:
        print("  ⚠  모델 붕괴! 재학습 필요")
    elif recall >= 0.85 and f1 >= 0.75:
        print("  ✅ 게이트 모델로 사용 가능")
    elif recall >= 0.70:
        print("  ⚠  재현율 보통 — 임계값을 0.25로 낮추는 것 고려")
    else:
        print("  ❌ 재현율 부족 — 데이터·하이퍼파라미터 재검토 필요")

    return recall, f1


# ── 메인 ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("Keras 게이트 v15 학습 (GPU 버전)")
    print("=" * 55)

    safe_paths = glob.glob(str(SAFE_DIR / "**/*.jpg"), recursive=True) + \
                 glob.glob(str(SAFE_DIR / "*.jpg"))
    prob_paths = glob.glob(str(PROHIBITED_DIR / "**/*.jpg"), recursive=True) + \
                 glob.glob(str(PROHIBITED_DIR / "*.jpg"))

    if not safe_paths or not prob_paths:
        print(f"\n❌ 데이터 없음!")
        print(f"   safe 경로:       {SAFE_DIR.resolve()}")
        print(f"   prohibited 경로: {PROHIBITED_DIR.resolve()}")
        print("\n데이터 배치 방법:")
        print("  data/safe/       ← safe_frames 이미지 복사")
        print("  data/prohibited/ ← detections 이미지 복사")
        return

    n = min(len(safe_paths), len(prob_paths))
    print(f"\nsafe: {len(safe_paths)}장  →  {n}장 사용")
    print(f"prohibited: {len(prob_paths)}장  →  {n}장 사용")

    random.shuffle(safe_paths)
    random.shuffle(prob_paths)

    print("\n이미지 전체 메모리 로드 중 (32GB RAM 활용)...")
    X_safe = load_images(safe_paths[:n], "safe")
    X_prob = load_images(prob_paths[:n], "prohibited")

    X = np.concatenate([X_safe, X_prob])
    y = np.concatenate([np.zeros(len(X_safe)), np.ones(len(X_prob))]).astype(np.float32)

    # 70 / 15 / 15 분할
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30, stratify=y, random_state=SEED)
    X_val, X_te, y_val, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50, stratify=y_tmp, random_state=SEED)

    print(f"\ntrain={len(X_tr)}  val={len(X_val)}  test={len(X_te)}")

    train_gen = AugmentGenerator(X_tr, y_tr, augment=True,  shuffle=True)
    val_gen   = AugmentGenerator(X_val, y_val, augment=False, shuffle=False)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1단계: 백본 동결 ────────────────────────────────────────────────────
    print("\n" + "─" * 40)
    print("1단계: 백본 동결 (최대 5 epoch)")
    print("─" * 40)

    model = build_model(trainable_backbone=False)
    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    print(f"학습 가능 파라미터: {sum(np.prod(v.shape) for v in model.trainable_weights):,}")

    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=5,
        callbacks=[EarlyStopping(monitor="val_loss", patience=2, restore_best_weights=True)],
        verbose=1,
    )

    evaluate(model, X_val, y_val, label="1단계 val")

    # ── 2단계: 상위 30층 해동 ───────────────────────────────────────────────
    print("\n" + "─" * 40)
    print("2단계: 백본 상위 30층 해동 (최대 15 epoch)")
    print("─" * 40)

    backbone = model.layers[1]
    backbone.trainable = True
    for layer in backbone.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(1e-5),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=15,
        callbacks=[
            EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7, verbose=1),
            ModelCheckpoint(str(BEST_PATH), monitor="val_loss", save_best_only=True, verbose=1),
        ],
        verbose=1,
    )

    # ── 최종 평가 ─────────────────────────────────────────────────────────
    recall, f1 = evaluate(model, X_te, y_te, label="최종 테스트")

    model.save(str(OUTPUT_PATH))
    print(f"\n저장 완료: {OUTPUT_PATH}")
    print(f"최고 체크포인트: {BEST_PATH}")
    print("\n학습 완료!")


if __name__ == "__main__":
    main()
