"""
Keras 게이트 파인튜닝 스크립트 v13
===================================
목적: is_prohibited 이진 헤드의 편향(항상 100%) 수정
방법: 이진 헤드만 집중 파인튜닝 + 클래스 가중치로 불균형 보정
시간: GPU 기준 15~30분

사용법:
    python keras_finetune_v13.py \
        --model  highway_model_v12.keras \
        --data   C:/Users/yourname/datasets/highway \
        --output highway_model_v13.keras

데이터 폴더 구조 (둘 다 지원):
    방식 A (클래스별 폴더):
        data/
          train/
            car/        ← safe
            Stacker/    ← prohibited
            ...
          valid/
            car/
            ...

    방식 B (Roboflow YOLO 형식):
        data/
          train/images/  + train/labels/
          valid/images/  + valid/labels/
        data/data.yaml   (클래스 이름 포함)
"""
import os, sys, argparse, random
import numpy as np
import tensorflow as tf
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import tf_keras as keras
from pathlib import Path
from PIL import Image

# ── 설정 ──────────────────────────────────────────────────────────────────────
IMG_SIZE    = (512, 512)
BATCH_SIZE  = 16
EPOCHS_BIN  = 20   # 이진 헤드 파인튜닝 에폭 (1단계)
EPOCHS_TOP  = 10   # 상위 레이어 파인튜닝 에폭 (2단계, 선택)
SAFE_CLASS  = "car"

PROHIBITED_CLASSES = [
    "Cultivator", "Electric Scooter", "Excavator", "Rear Car",
    "Stacker", "Tractor", "Wheelchair", "person", "motorcycle",
]
ALL_CLASSES = ["Cultivator", "Electric Scooter", "Excavator", "Rear Car",
               "Stacker", "Tractor", "Wheelchair", "car", "person", "motorcycle"]

# ── 데이터 로딩 ──────────────────────────────────────────────────────────────

def collect_images_from_class_folders(data_dir: Path):
    """방식 A: 클래스별 폴더에서 이미지 수집"""
    safe, prohibited = [], []
    for split in ["train", "valid", "validation", "val", "test"]:
        split_dir = data_dir / split
        if not split_dir.exists():
            continue
        for cls_dir in split_dir.iterdir():
            if not cls_dir.is_dir():
                continue
            label = 0 if cls_dir.name.lower() == SAFE_CLASS.lower() else 1
            for f in cls_dir.glob("*.jpg"):
                (safe if label == 0 else prohibited).append(str(f))
            for f in cls_dir.glob("*.png"):
                (safe if label == 0 else prohibited).append(str(f))
    return safe, prohibited


def collect_images_from_yolo(data_dir: Path):
    """방식 B: YOLO 형식 — labels 폴더의 클래스 번호로 binary 레이블 생성"""
    import yaml
    yaml_path = data_dir / "data.yaml"
    if not yaml_path.exists():
        return [], []

    with open(yaml_path) as f:
        cfg = yaml.safe_load(f)
    class_names = cfg.get("names", ALL_CLASSES)
    safe_ids = {i for i, n in enumerate(class_names) if n.lower() == SAFE_CLASS.lower()}

    safe, prohibited = [], []
    for split in ["train", "valid", "val", "test"]:
        img_dir = data_dir / split / "images"
        lbl_dir = data_dir / split / "labels"
        if not img_dir.exists():
            continue
        for img_path in img_dir.glob("*.jpg"):
            lbl_path = lbl_dir / (img_path.stem + ".txt")
            if not lbl_path.exists():
                safe.append(str(img_path))  # 레이블 없음 = 빈 도로 = safe
                continue
            lines = lbl_path.read_text().strip().splitlines()
            cls_ids = {int(l.split()[0]) for l in lines if l.strip()}
            # safe_ids에만 속하면 safe, 아니면 prohibited
            is_safe = all(c in safe_ids for c in cls_ids) or not cls_ids
            (safe if is_safe else prohibited).append(str(img_path))
    return safe, prohibited


def load_and_preprocess(path: str, label: int):
    img = tf.io.read_file(path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, IMG_SIZE)
    img = tf.cast(img, tf.float32) / 255.0
    return img, label


def build_dataset(paths, labels, augment=False, shuffle=True):
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if shuffle:
        ds = ds.shuffle(buffer_size=len(paths), seed=42)
    ds = ds.map(lambda p, l: load_and_preprocess(p, l),
                num_parallel_calls=tf.data.AUTOTUNE)
    if augment:
        ds = ds.map(lambda x, y: (augment_fn(x), y),
                    num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)


def augment_fn(img):
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_brightness(img, 0.15)
    img = tf.image.random_contrast(img, 0.85, 1.15)
    img = tf.image.random_saturation(img, 0.85, 1.15)
    return tf.clip_by_value(img, 0.0, 1.0)


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",  default="highway_model_v12.keras")
    parser.add_argument("--data",   required=True, help="데이터셋 루트 폴더")
    parser.add_argument("--output", default="highway_model_v13.keras")
    parser.add_argument("--no-stage2", action="store_true",
                        help="2단계 상위 레이어 파인튜닝 건너뜀")
    args = parser.parse_args()

    data_dir = Path(args.data)
    print(f"\n📂 데이터 폴더: {data_dir}")

    # 데이터 수집
    safe, prohibited = collect_images_from_class_folders(data_dir)
    if not safe and not prohibited:
        safe, prohibited = collect_images_from_yolo(data_dir)

    if not safe:
        print("❌ car 이미지를 찾을 수 없습니다. --data 경로를 확인하세요.")
        sys.exit(1)

    print(f"✅ safe(car):    {len(safe):,}장")
    print(f"✅ prohibited:  {len(prohibited):,}장")

    # 클래스 불균형 보정: prohibited를 safe 수의 1.5배로 제한
    target_prohibited = min(len(prohibited), int(len(safe) * 1.5))
    prohibited_sampled = random.sample(prohibited, target_prohibited)
    print(f"균형 조정 후 → safe={len(safe)}, prohibited={target_prohibited}")

    # 학습/검증 분리 (9:1)
    def split(lst, ratio=0.9):
        n = int(len(lst) * ratio)
        return lst[:n], lst[n:]

    safe_tr, safe_val = split(safe)
    proh_tr, proh_val = split(prohibited_sampled)

    tr_paths  = safe_tr  + proh_tr
    tr_labels = [0]*len(safe_tr)  + [1]*len(proh_tr)
    val_paths  = safe_val + proh_val
    val_labels = [0]*len(safe_val) + [1]*len(proh_val)

    print(f"\n학습셋: {len(tr_paths)}장 | 검증셋: {len(val_paths)}장")

    tr_ds  = build_dataset(tr_paths,  tr_labels,  augment=True)
    val_ds = build_dataset(val_paths, val_labels, augment=False)

    # 클래스 가중치 (safe 과소 표현 보정)
    n_safe = len(safe_tr)
    n_proh = len(proh_tr)
    total  = n_safe + n_proh
    class_weight = {
        0: (total / (2 * n_safe)),
        1: (total / (2 * n_proh)),
    }
    print(f"클래스 가중치: safe={class_weight[0]:.2f}, prohibited={class_weight[1]:.2f}")

    # 모델 로드
    print(f"\n⏳ 모델 로드: {args.model}")
    model = keras.models.load_model(args.model)
    print(f"입력: {model.input_shape} | 출력: {[str(o.shape) for o in model.outputs]}")

    # ── 1단계: is_prohibited 헤드만 학습 ─────────────────────────────────────
    print("\n" + "="*55)
    print("  1단계: is_prohibited 이진 헤드 파인튜닝")
    print("="*55)

    # 백본 + 10클래스 헤드 완전 동결
    model.trainable = False
    # is_prohibited 출력 레이어만 해제
    for layer in model.layers:
        if "prohibited" in layer.name.lower() or "sigmoid" in layer.name.lower():
            layer.trainable = True
            print(f"  학습 레이어: {layer.name}")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss={
            model.output_names[0]: "sparse_categorical_crossentropy",
            model.output_names[1]: "binary_crossentropy",
        },
        loss_weights={
            model.output_names[0]: 0.0,   # 10클래스 헤드 손실 무시
            model.output_names[1]: 1.0,   # 이진 헤드만 집중
        },
        metrics={model.output_names[1]: ["accuracy"]},
    )

    # 이진 레이블로만 학습 (vehicle_class는 dummy)
    def add_dummy_label(img, binary_label):
        vehicle_label = tf.zeros((), dtype=tf.int32)  # 무시됨
        return img, {model.output_names[0]: vehicle_label,
                     model.output_names[1]: tf.cast(binary_label, tf.float32)}

    tr_ds2  = tr_ds.map(add_dummy_label)
    val_ds2 = val_ds.map(add_dummy_label)

    callbacks_s1 = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=4, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6),
    ]

    model.fit(tr_ds2, validation_data=val_ds2, epochs=EPOCHS_BIN,
              class_weight=class_weight, callbacks=callbacks_s1)

    # ── 2단계: 백본 상위 30 레이어 해제 후 전체 파인튜닝 ─────────────────────
    if not args.no_stage2:
        print("\n" + "="*55)
        print("  2단계: 상위 레이어 파인튜닝 (낮은 LR)")
        print("="*55)

        # 백본 상위 30레이어 해제
        model.trainable = True
        backbone = next((l for l in model.layers
                         if hasattr(l, 'layers') and len(l.layers) > 10), None)
        if backbone:
            for layer in backbone.layers[:-30]:
                layer.trainable = False
            print(f"  백본 하위 레이어 동결, 상위 30개 해제")

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=5e-5),
            loss={
                model.output_names[0]: "sparse_categorical_crossentropy",
                model.output_names[1]: "binary_crossentropy",
            },
            loss_weights={
                model.output_names[0]: 0.5,
                model.output_names[1]: 1.0,
            },
            metrics={model.output_names[1]: ["accuracy"]},
        )

        # 10클래스 레이블 포함
        def with_vehicle_label(img, binary_label):
            return img, {model.output_names[0]: tf.zeros((), dtype=tf.int32),
                         model.output_names[1]: tf.cast(binary_label, tf.float32)}

        tr_ds3  = tr_ds.map(with_vehicle_label)
        val_ds3 = val_ds.map(with_vehicle_label)

        callbacks_s2 = [
            keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=4, restore_best_weights=True),
        ]
        model.fit(tr_ds3, validation_data=val_ds3, epochs=EPOCHS_TOP,
                  class_weight=class_weight, callbacks=callbacks_s2)

    # ── 검증 ─────────────────────────────────────────────────────────────────
    print("\n" + "="*55)
    print("  최종 검증")
    print("="*55)

    # 검증셋에서 이진 예측
    y_true, y_pred = [], []
    for batch_img, batch_lbl in val_ds:
        outputs = model.predict(batch_img, verbose=0)
        probs = outputs[1] if isinstance(outputs, list) else outputs
        y_true.extend(batch_lbl.numpy().tolist())
        y_pred.extend((probs.flatten() > 0.5).astype(int).tolist())

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    tp = ((y_true==1) & (y_pred==1)).sum()
    tn = ((y_true==0) & (y_pred==0)).sum()
    fp = ((y_true==0) & (y_pred==1)).sum()
    fn = ((y_true==1) & (y_pred==0)).sum()
    acc      = (tp + tn) / len(y_true)
    precision = tp / (tp + fp) if (tp+fp) > 0 else 0
    recall    = tp / (tp + fn) if (tp+fn) > 0 else 0
    f1        = 2*precision*recall/(precision+recall) if (precision+recall) > 0 else 0

    print(f"\n  정확도:   {acc*100:.1f}%")
    print(f"  정밀도:   {precision*100:.1f}%")
    print(f"  재현율:   {recall*100:.1f}%")
    print(f"  F1 Score: {f1*100:.1f}%")
    print(f"\n  혼동 행렬:")
    print(f"    TP(금지↗금지)={tp}  FP(안전↗금지)={fp}")
    print(f"    FN(금지↗안전)={fn}  TN(안전↗안전)={tn}")

    # 단색 이미지 이상값 테스트
    print("\n  이상값 테스트:")
    for name, arr in [("흰색(255)", np.ones((1,*IMG_SIZE,3), dtype=np.float32)),
                      ("검은색(0)", np.zeros((1,*IMG_SIZE,3), dtype=np.float32))]:
        out = model.predict(arr, verbose=0)
        prob = float(out[1][0][0]) if isinstance(out, list) else float(out[0][0])
        ok = "✅" if prob < 0.5 else "⚠"
        print(f"    {ok} {name}: 금지확률={prob*100:.1f}%  (0.5 미만이어야 정상)")

    # 저장
    model.save(args.output)
    print(f"\n✅ 모델 저장 완료: {args.output}")
    print(f"   → http://localhost:8001/model-upload 에서 Keras v3로 업로드")

if __name__ == "__main__":
    main()
