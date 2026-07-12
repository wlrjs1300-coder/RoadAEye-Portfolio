# Keras 게이트 모델 재학습 가이드

> **목적**: `is_prohibited` 이진 헤드 편향 수정 (항상 100% 문제 해결)  
> **방법**: car 클래스 데이터 증강 → 이진 헤드 집중 파인튜닝  
> **목표**: 일반 차량(car) 프레임에서 금지확률 50% 미만 출력

---

## 1. 환경 준비

### 필수 패키지 설치

```bash
pip install tensorflow tf-keras pillow numpy pyyaml
```

> **TensorFlow 버전**: 2.15 이상 권장  
> **GPU**: CUDA 지원 GPU 사용 시 학습 속도 대폭 향상 (15~25분)  
> **CPU만**: 약 1~2시간 소요

---

## 2. 파일 구성

학습 전 다음 파일들을 같은 폴더에 준비합니다:

```
작업폴더/
├── augment_car_data.py       ← 증강 스크립트
├── keras_finetune_v13.py     ← 파인튜닝 스크립트
├── highway_model_v12.keras   ← 기존 학습 모델 (12차)
└── dataset/                  ← 기존 데이터셋 폴더
    ├── train/
    │   ├── car/              ← 현재 880장
    │   ├── Stacker/
    │   ├── Excavator/
    │   └── ...
    └── valid/
        ├── car/
        └── ...
```

---

## 3. 왜 증강이 필요한가?

현재 데이터 불균형 상태:

| 클래스 | 이미지 수 | 비율 |
|---|---|---|
| 금지 차량 9종 합계 | 7,660장 | **90%** |
| car (안전) | 880장 | **10%** |

모델이 "안전" 상태를 학습할 기회가 거의 없어서 항상 금지(100%)로 판단합니다.

**목표 비율**: car 5,000장 vs 금지 7,660장 = **4:6 비율**

---

## 4. Step 1 — Car 데이터 증강

### 스크립트 실행

```bash
python augment_car_data.py \
  --input  ./dataset/train/car \
  --output ./dataset/car_augmented \
  --target 5000
```

| 옵션 | 설명 | 예시 |
|---|---|---|
| `--input` | 원본 car 이미지 폴더 | `./dataset/train/car` |
| `--output` | 증강 이미지 저장 폴더 | `./dataset/car_augmented` |
| `--target` | 최종 목표 이미지 수 | `5000` |

### 실행 결과

```
원본 car 이미지: 880장
목표 이미지 수:  5000장
증강 생성 필요:  4120장

원본 이미지 복사 중...
✅ 원본 880장 복사 완료

증강 이미지 4120장 생성 중...
  진행: 500/4120 (12%)
  진행: 1000/4120 (24%)
  ...
✅ 완료!
   최종 car 이미지: 5000장
```

**소요 시간**: 약 2~5분

### 증강 방식 (10가지 — CCTV 환경 반영)

| 증강 종류 | 실제 의미 |
|---|---|
| 좌우 반전 | 반대 방향 차선 |
| 밝기 증가 (+15~45%) | 맑은 날 역광 |
| 밝기 감소 (-20~45%) | 흐린 날 / 터널 |
| 대비 증가 | 선명한 화질 |
| 대비 감소 | 안개 낀 날씨 |
| 채도 낮춤 (-30~70%) | 비 오는 날 / 야간 |
| 노이즈 추가 | CCTV 화질 열화 |
| 가벼운 블러 | 원거리 차량 흐림 |
| 약한 크롭 (3~8%) | 카메라 시야 변화 |
| 날씨 복합 | 밝기+채도 동시 변화 |

---

## 5. Step 2 — 데이터셋 폴더 구성

증강 완료 후 파인튜닝 스크립트가 인식할 수 있도록 폴더를 구성합니다.

### 방식 A: 클래스별 폴더 구조 (권장)

```
dataset/
├── train/
│   ├── car/          ← car_augmented 폴더 내용을 여기로 이동 또는 경로 지정
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

> **주의**: `car_augmented` 폴더의 이미지를 `train/car/` 폴더 안에 복사해 넣거나,  
> `--data` 옵션에 `car_augmented` 상위 폴더를 직접 지정해도 됩니다.

### 방식 B: Roboflow YOLO 형식 (data.yaml 있는 경우)

```
dataset/
├── data.yaml          ← 클래스 이름 목록 포함
├── train/
│   ├── images/
│   └── labels/        ← YOLO 형식 txt 파일
└── valid/
    ├── images/
    └── labels/
```

---

## 6. Step 3 — 파인튜닝 실행

### 스크립트 실행

```bash
python keras_finetune_v13.py \
  --model  highway_model_v12.keras \
  --data   ./dataset \
  --output highway_model_v13.keras
```

| 옵션 | 설명 | 기본값 |
|---|---|---|
| `--model` | 기존 모델 파일 경로 | `highway_model_v12.keras` |
| `--data` | 데이터셋 루트 폴더 | 필수 입력 |
| `--output` | 저장할 모델 파일명 | `highway_model_v13.keras` |
| `--no-stage2` | 2단계 파인튜닝 건너뜀 (빠름) | 사용 안 함 |

### 학습 단계

#### 1단계: is_prohibited 이진 헤드만 학습 (20 에폭)
- 백본 + 10클래스 헤드 완전 동결
- `is_prohibited` 출력 레이어만 학습
- **목적**: 항상 100% 출력하는 편향 직접 수정
- 클래스 가중치 자동 적용 (car 부족분 보정)

#### 2단계: 상위 레이어 파인튜닝 (10 에폭)
- 백본 상위 30개 레이어 해제
- 낮은 학습률 (5e-5)로 전체 최적화
- **목적**: 전반적인 정확도 향상

> **시간 절약**: `--no-stage2` 옵션 추가 시 1단계만 진행 (약 10분)

### 학습 로그 예시

```
데이터 폴더: ./dataset
✅ safe(car):    5000장
✅ prohibited:  7660장
균형 조정 후 → safe=5000, prohibited=7500

학습셋: 11250장 | 검증셋: 1250장
클래스 가중치: safe=1.13, prohibited=1.50

========================================
  1단계: is_prohibited 이진 헤드 파인튜닝
========================================
Epoch 1/20
  loss: 0.6821 - val_loss: 0.5234 - val_accuracy: 0.7812
Epoch 2/20
  loss: 0.4523 - val_loss: 0.3891 - val_accuracy: 0.8634
...
```

---

## 7. 정상 학습 판단 기준

### 학습 중 확인할 것

| 지표 | 정상 범위 | 비정상 |
|---|---|---|
| `val_loss` | 에폭마다 감소 | 전혀 안 줄거나 증가 |
| `val_accuracy` | 80% 이상 도달 | 50~60%에서 정체 |

### 최종 검증 결과 (스크립트 자동 출력)

```
========================================
  최종 검증
========================================
  정확도:   88.5%
  정밀도:   91.2%
  재현율:   87.3%
  F1 Score: 89.2%

  혼동 행렬:
    TP(금지→금지)=437  FP(안전→금지)=42
    FN(금지→안전)=63   TN(안전→안전)=458

  이상값 테스트:
    ✅ 흰색(255): 금지확률=12.4%  (0.5 미만이어야 정상)
    ✅ 검은색(0):  금지확률=8.7%   (0.5 미만이어야 정상)
```

### 합격 기준

| 항목 | 합격 | 불합격 |
|---|---|---|
| 정확도 | **80% 이상** | 80% 미만 |
| 흰색 화면 금지확률 | **50% 미만** | 50% 이상 |
| 검은색 화면 금지확률 | **50% 미만** | 50% 이상 |

> 이상값 테스트에서 두 항목 모두 ✅이면 기존 v11/v12의 "항상 100%" 문제가 해결된 것입니다.

---

## 8. Step 4 — 모델 업로드

학습 완료 후 서버에 업로드합니다.

```
브라우저에서: http://localhost:8001/model-upload

1. 모델 타입 → Keras v3 선택
2. 파일 선택 → highway_model_v13.keras
3. 업로드 클릭
```

업로드 완료 후 서버에서 자동으로 테스트를 진행합니다.

---

## 9. 문제 해결

### car 이미지를 찾을 수 없습니다

```
❌ car 이미지를 찾을 수 없습니다.
```

→ `--data` 경로 내에 `car` 폴더가 있는지 확인  
→ 폴더명이 정확히 `car` 인지 확인 (대소문자 구분)

### CUDA out of memory

```
ResourceExhaustedError: OOM when allocating tensor
```

→ `keras_finetune_v13.py` 파일 상단의 `BATCH_SIZE = 16` 을 `8` 로 줄이기

### 학습이 전혀 개선되지 않음 (val_accuracy 50% 고정)

→ car 증강 이미지가 실제로 `train/car/` 폴더에 포함됐는지 재확인  
→ `augment_car_data.py` 를 다시 실행하고 출력된 경로 확인

---

## 10. 전체 흐름 요약

```
① python augment_car_data.py --input ./car --output ./car_aug --target 5000
        ↓ (약 3분)
② car_aug 폴더 내용 → dataset/train/car/ 에 복사
        ↓
③ python keras_finetune_v13.py --model v12.keras --data ./dataset --output v13.keras
        ↓ (GPU 약 20분)
④ 최종 검증에서 이상값 테스트 ✅ 확인
        ↓
⑤ http://localhost:8001/model-upload → Keras v3 → v13.keras 업로드
```
