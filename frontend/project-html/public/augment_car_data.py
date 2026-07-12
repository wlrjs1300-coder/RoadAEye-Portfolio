"""
Car 클래스 데이터 증강 스크립트
================================
사용법:
    python augment_car_data.py \
        --input  C:/데이터셋/car \
        --output C:/데이터셋/car_augmented \
        --target 5000

    (target: 최종 목표 이미지 수, 기본 5000)
"""
import os, argparse, random, shutil
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

# ── 증강 파라미터 (고속도로 CCTV 특성 반영) ──────────────────────────────────
# 실제 CCTV는 고정 카메라라 회전/크롭은 최소화, 밝기/날씨 변화 위주
AUG_CONFIGS = [
    # (이름, 확률적용 여부)
    "flip_h",           # 좌우 반전
    "brightness_up",    # 밝게 (맑은 날)
    "brightness_down",  # 어둡게 (흐린 날 / 터널)
    "contrast_up",      # 대비 강조
    "contrast_down",    # 대비 감소 (안개)
    "saturation_low",   # 채도 낮춤 (비 / 야간)
    "noise",            # 노이즈 추가 (CCTV 화질 열화)
    "blur_mild",        # 가벼운 블러 (원거리 차량)
    "crop_slight",      # 약한 크롭 (카메라 시야 변화)
    "combined_weather", # 밝기+채도 동시 변경 (날씨 변화)
]


def augment_image(img: Image.Image, aug_type: str) -> Image.Image:
    """단일 증강 적용"""
    img = img.copy()

    if aug_type == "flip_h":
        return img.transpose(Image.FLIP_LEFT_RIGHT)

    elif aug_type == "brightness_up":
        factor = random.uniform(1.15, 1.45)
        return ImageEnhance.Brightness(img).enhance(factor)

    elif aug_type == "brightness_down":
        factor = random.uniform(0.55, 0.80)
        return ImageEnhance.Brightness(img).enhance(factor)

    elif aug_type == "contrast_up":
        factor = random.uniform(1.15, 1.50)
        return ImageEnhance.Contrast(img).enhance(factor)

    elif aug_type == "contrast_down":
        factor = random.uniform(0.60, 0.85)
        return ImageEnhance.Contrast(img).enhance(factor)

    elif aug_type == "saturation_low":
        factor = random.uniform(0.3, 0.7)
        return ImageEnhance.Color(img).enhance(factor)

    elif aug_type == "noise":
        arr = np.array(img, dtype=np.float32)
        noise = np.random.normal(0, random.uniform(5, 15), arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    elif aug_type == "blur_mild":
        radius = random.uniform(0.5, 1.2)
        return img.filter(ImageFilter.GaussianBlur(radius=radius))

    elif aug_type == "crop_slight":
        w, h = img.size
        margin = random.uniform(0.03, 0.08)
        left   = int(w * random.uniform(0, margin))
        top    = int(h * random.uniform(0, margin))
        right  = int(w * (1 - random.uniform(0, margin)))
        bottom = int(h * (1 - random.uniform(0, margin)))
        return img.crop((left, top, right, bottom)).resize((w, h), Image.BILINEAR)

    elif aug_type == "combined_weather":
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.70, 1.30))
        img = ImageEnhance.Color(img).enhance(random.uniform(0.4, 0.9))
        return img

    return img


def collect_input_images(input_dir: Path) -> list:
    """입력 폴더에서 이미지 경로 수집"""
    exts = {".jpg", ".jpeg", ".png", ".bmp"}
    imgs = []
    for p in input_dir.rglob("*"):
        if p.suffix.lower() in exts:
            imgs.append(p)
    return imgs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",  required=True,
                        help="원본 car 이미지 폴더")
    parser.add_argument("--output", required=True,
                        help="증강 이미지 저장 폴더 (원본도 복사)")
    parser.add_argument("--target", type=int, default=5000,
                        help="최종 목표 이미지 수 (기본: 5000)")
    args = parser.parse_args()

    input_dir  = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 원본 이미지 수집
    originals = collect_input_images(input_dir)
    if not originals:
        print(f"❌ 이미지를 찾을 수 없습니다: {input_dir}")
        return

    print(f"\n원본 car 이미지: {len(originals)}장")
    print(f"목표 이미지 수:  {args.target}장")
    need = max(0, args.target - len(originals))
    print(f"증강 생성 필요:  {need}장\n")

    # 원본 복사
    print("원본 이미지 복사 중...")
    for i, src in enumerate(originals):
        dst = output_dir / f"orig_{i:05d}{src.suffix}"
        shutil.copy2(src, dst)
    print(f"✅ 원본 {len(originals)}장 복사 완료")

    if need <= 0:
        print(f"\n✅ 이미 목표({args.target}장)를 초과합니다. 증강 불필요.")
        return

    # 증강 생성
    print(f"\n증강 이미지 {need}장 생성 중...")
    generated = 0
    aug_types  = AUG_CONFIGS.copy()

    while generated < need:
        # 원본에서 랜덤 선택
        src_path = random.choice(originals)
        try:
            img = Image.open(src_path).convert("RGB")
        except Exception:
            continue

        # 1~2가지 증강 랜덤 조합
        num_augs = random.choices([1, 2], weights=[0.6, 0.4])[0]
        selected = random.sample(aug_types, num_augs)
        for aug in selected:
            img = augment_image(img, aug)

        out_path = output_dir / f"aug_{generated:06d}.jpg"
        img.save(out_path, "JPEG", quality=88)
        generated += 1

        if generated % 500 == 0 or generated == need:
            print(f"  진행: {generated}/{need} ({generated/need*100:.0f}%)")

    total = len(list(output_dir.glob("*.jpg"))) + len(list(output_dir.glob("*.png")))
    print(f"\n✅ 완료!")
    print(f"   최종 car 이미지: {total}장")
    print(f"   저장 위치: {output_dir}")
    print(f"\n다음 단계: keras_finetune_v13.py 실행 시 --data 에 이 폴더 포함")


if __name__ == "__main__":
    main()
