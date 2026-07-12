# Keras 게이트 모델 — 전처리 · 증강 · 파인튜닝 방법론 가이드

> **모델**: MobileNetV2 기반 이진 분류 게이트 (512×512 입력)  
> **목적**: 고속도로 CCTV 프레임에서 "진입금지 차량 있음/없음" 판별  
> **문제**: 기존 v11/v12 모델이 모든 입력에 금지확률 100% 출력 → 수정 필요

---

## 1. 현재 문제 분석

### 왜 항상 100%가 나오는가?

```
학습 데이터:
  금지 차량 (prohibited) : 7,660장  ← 90%
  일반 차량 (car/safe)   :   880장  ← 10%

모델 입장에서:
  "어떤 이미지가 들어와도 '금지'라고 하면 90%는 맞는다"
  → 모델이 '항상 금지'라는 편법을 학습
```

**핵심**: 데이터 불균형이 원인. car 클래스 데이터를 늘리고 균형을 맞춰야 함.

---

## 2. 전처리 (Preprocessing)

### 2-1. 입력 크기 통일

모델 입력이 **512×512**이므로 모든 이미지를 동일 크기로 조정합니다.

```python
from PIL import Image

def preprocess(image_path, size=(512, 512)):
    img = Image.open(image_path).convert("RGB")   # 3채널 RGB 통일
    img = img.resize(size, Image.BILINEAR)         # 512×512 리사이즈
    return img
```

> **BILINEAR 보간법 선택 이유**: CCTV 영상처럼 저해상도 이미지를 확대할 때 자연스러운 결과 제공

### 2-2. 픽셀 정규화

```python
import numpy as np

arr = np.array(img, dtype=np.float32)
arr = arr / 255.0    # [0, 255] → [0.0, 1.0] 범위로 정규화
```

> MobileNetV2는 **[0, 1]** 범위의 입력을 기대합니다.  
> 일부 구현에서 [-1, 1]을 사용하기도 하지만, 현재 모델은 [0, 1] 기준으로 학습됐습니다.

### 2-3. 데이터 레이블링 규칙

| 이미지 내용 | 레이블 | 의미 |
|---|---|---|
| car(승용차)만 있는 프레임 | `0` (safe) | YOLO 건너뜀 |
| 빈 도로 | `0` (safe) | YOLO 건너뜀 |
| 진입금지 차량 포함 프레임 | `1` (prohibited) | YOLO 실행 |
| car + 진입금지 차량 혼재 | `1` (prohibited) | YOLO 실행 |

> **주의**: car와 금지 차량이 같은 프레임에 있으면 **prohibited(1)** 로 레이블

---

## 3. 데이터 증강 (Augmentation)

### 3-1. 증강이 필요한 이유

현재 car 원본 데이터: **1,610장** (기존 880 + 추가 730)  
목표 car 데이터: **5,000장**  
→ **3,390장 증강 필요** (원본의 약 2.1배)

### 3-2. CCTV 환경에 적합한 증강 전략

고속도로 CCTV는 **고정 카메라**이므로 다음 원칙을 따릅니다:

| 증강 종류 | 범위 | 사용 이유 | 주의 |
|---|---|---|---|
| **좌우 반전** | - | 상하행선 양방향 커버 | ✅ 적극 사용 |
| **밝기 조절** | ±15~45% | 날씨·시간대 변화 | ✅ 적극 사용 |
| **대비 조절** | ±15~50% | 흐림·선명도 변화 | ✅ 적극 사용 |
| **채도 낮춤** | -30~70% | 비·야간·터널 | ✅ 적극 사용 |
| **가우시안 노이즈** | σ=5~15 | CCTV 화질 열화 | ✅ 적극 사용 |
| **가벼운 블러** | r=0.5~1.2 | 원거리 차량 흐림 | ✅ 적극 사용 |
| **약한 크롭** | 3~8% | 카메라 미세 이동 | ⚠ 조금만 사용 |
| **회전** | - | 고정 카메라라 불필요 | ❌ 사용 안 함 |
| **상하 반전** | - | 현실적으로 불가 | ❌ 사용 안 함 |
| **강한 크롭/확대** | - | 화각이 고정됨 | ❌ 사용 안 함 |

### 3-3. 증강 조합 전략

단일 증강보다 **1~2가지 조합**이 더 다양한 경우의 수를 생성합니다:

```python
# 좋은 조합 예시
"밝기 감소" + "채도 낮춤"  → 비 오는 날 효과
"밝기 증가" + "대비 증가"  → 맑고 강한 햇빛 효과
"노이즈"    + "블러"       → 열화된 CCTV 화질 효과
```

### 3-4. 증강 실행

```bash
python augment_car_data.py \
  --input  ./dataset/train/car \
  --output ./dataset/car_augmented \
  --target 5000
```

완료 후 `car_augmented` 폴더의 이미지를 `dataset/train/car/`에 복사:

```bash
# Windows
copy /Y dataset\car_augmented\* dataset\train\car\

# Mac/Linux
cp dataset/car_augmented/* dataset/train/car/
```

---

## 4. 파인튜닝 전략 (Fine-tuning)

### 4-1. 전체 재학습 vs 파인튜닝

| | 전체 재학습 | 파인튜닝 (이번 방법) |
|---|---|---|
| 시간 | 3~5시간 | **15~25분** |
| 필요 데이터 | 모든 클래스 대량 | car 클래스 중심 |
| 위험성 | 기존 학습 완전 초기화 | 기존 학습 유지 |
| 목적 적합성 | 모델 전체 개선 | **특정 문제(편향) 수정** |

> 이번 문제는 `is_prohibited` 헤드만 편향됐으므로 **파인튜닝이 훨씬 효율적**입니다.

### 4-2. 2단계 파인튜닝 구조

```
[1단계] is_prohibited 헤드만 학습 (20 에폭)
──────────────────────────────────────────
백본 (MobileNetV2)     → 완전 동결 (변경 없음)
vehicle_class 헤드      → 완전 동결 (변경 없음)
is_prohibited 헤드      → 학습 대상 ★

효과: 항상 100% 출력하는 편향을 직접 수정
시간: GPU 약 8~12분

[2단계] 백본 상위 30 레이어 + 전체 헤드 (10 에폭)
──────────────────────────────────────────
백본 하위 레이어        → 동결 유지
백본 상위 30 레이어     → 학습 대상 (낮은 LR)
양쪽 헤드 모두          → 학습 대상

효과: 전반적인 표현력 향상
시간: GPU 약 5~10분
```

### 4-3. 학습률 설정 근거

| 단계 | 학습률 | 이유 |
|---|---|---|
| 1단계 | `1e-3` (0.001) | 헤드만 학습하므로 높은 LR 사용 가능 |
| 2단계 | `5e-5` (0.00005) | 백본 손상 방지를 위해 낮은 LR |

### 4-4. 클래스 가중치 (Class Weight)

증강 후에도 데이터 불균형이 남아있을 수 있으므로 클래스 가중치를 적용합니다:

```python
# 자동 계산 공식
total = n_safe + n_prohibited
weight_safe       = total / (2 * n_safe)        # safe 부족 시 가중치 높아짐
weight_prohibited = total / (2 * n_prohibited)   # prohibited 과다 시 낮아짐
```

**예시**: safe=4500, prohibited=7660 이면
- safe 가중치 = 12160 / (2×4500) = **1.35**
- prohibited 가중치 = 12160 / (2×7660) = **0.79**

### 4-5. 학습 중 모니터링 포인트

```
✅ 정상 학습:
  - val_loss 가 에폭마다 전반적으로 감소
  - val_accuracy 가 80% 이상 도달
  - 10 에폭 이내에 60% → 80% 이상으로 빠르게 상승

⚠ 주의:
  - val_loss 가 증가 추세 → 과적합 시작 (EarlyStopping이 자동 중단)
  - val_accuracy 가 50~60% 고정 → car 데이터가 train/car/ 에 없는 것

❌ 실패:
  - 모든 에폭에서 accuracy 50% 고정 → 데이터 경로 오류
  - OOM(메모리 부족) → BATCH_SIZE 를 16 → 8 로 줄이기
```

---

## 5. 전체 실행 순서

### Step 1. 폴더 준비

```
작업폴더/
├── augment_car_data.py
├── keras_finetune_v13.py
├── highway_model_v12.keras
└── dataset/
    ├── train/
    │   ├── car/              ← 원본 1,610장 (기존 880 + 추가 730)
    │   ├── Stacker/
    │   ├── Excavator/
    │   ├── Cultivator/
    │   ├── Electric Scooter/
    │   ├── Rear Car/
    │   ├── Tractor/
    │   ├── Wheelchair/
    │   ├── person/
    │   └── motorcycle/
    └── valid/
        ├── car/
        └── ...
```

### Step 2. 환경 설치

```bash
pip install tensorflow tf-keras pillow numpy pyyaml
```

### Step 3. 데이터 증강 (약 3~5분)

```bash
python augment_car_data.py \
  --input  ./dataset/train/car \
  --output ./dataset/car_augmented \
  --target 5000
```

### Step 4. 증강 이미지 병합

```bash
# Windows
copy /Y dataset\car_augmented\*.jpg dataset\train\car\

# Mac / Linux
cp dataset/car_augmented/*.jpg dataset/train/car/
```

### Step 5. 파인튜닝 (GPU 약 20분)

```bash
python keras_finetune_v13.py \
  --model  highway_model_v12.keras \
  --data   ./dataset \
  --output highway_model_v13.keras
```

### Step 6. 합격 기준 확인

스크립트 완료 시 자동으로 출력됩니다:

```
이상값 테스트:
  ✅ 흰색(255): 금지확률=xx.x%  ← 50% 미만이어야 합격
  ✅ 검은색(0):  금지확률=xx.x%  ← 50% 미만이어야 합격
```

두 항목 모두 ✅ 이면 성공입니다.

### Step 7. 서버 업로드

```
브라우저: http://localhost:8001/model-upload
→ Keras v3 선택 → highway_model_v13.keras 업로드
```

---

## 6. 자주 묻는 문제

### Q. BATCH_SIZE 관련 OOM 오류

```python
# keras_finetune_v13.py 파일 상단 수정
BATCH_SIZE = 8    # 기본 16 → 8로 줄이기
```

### Q. 1단계 후 이상값 테스트 실패 시

`--no-stage2` 없이 2단계까지 진행하거나, car 데이터가 충분한지 재확인

### Q. 학습 결과가 80% 이상이어도 실제 서버에서 여전히 100% 나올 때

서버에서 모델을 새로 로드하지 않은 것 → 서버 재시작 후 재테스트

---

## 7. 기대 결과

| 항목 | v12 (현재) | v13 (목표) |
|---|---|---|
| 일반 CCTV 금지확률 | ❌ 100% | ✅ 20~50% |
| 흰색 화면 금지확률 | ❌ 100% | ✅ 10~30% |
| 정확도 | ❌ 측정 불가 | ✅ 80% 이상 |
| 게이트 역할 | ❌ 항상 통과 | ✅ 실제 필터링 |
