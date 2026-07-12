# Road A Eye

> 고속도로 CCTV 영상 기반 AI 객체 감지 및 관제 시스템

## 소개

**Road A Eye**는 고속도로 CCTV 영상을 분석하여 고속도로 진입이 제한되거나 위험할 수 있는 객체를 감지하고, 관제 화면을 통해 감지 결과와 경보를 제공하는 시스템입니다.

본 저장소는 5인 팀 프로젝트로 개발한 Road A Eye를 개인 포트폴리오 공개 목적에 맞게 재구성한 저장소입니다.  
기존 팀 Git 이력은 포함하지 않았으며, 운영 환경의 인증정보, 내부 네트워크 주소, 로그, 사용자 데이터 및 백업 파일을 제거했습니다.

---

## 담당 역할

본인은 AI 모델 개발과 AI 서버 연동을 중심으로 담당했으며, 프론트엔드, 백엔드, DB 및 인프라는 팀원들과 역할을 분담하여 개발했습니다.

| 구분 | 내용 |
|---|---|
| 모델 학습 | Keras 기반 객체 분류 모델 반복 실험 및 성능 개선 |
| 모델 학습 | YOLOv11m 객체 탐지 모델 학습 및 성능 평가 |
| 서버 구축 | AI 추론 서버 구축 (FastAPI) |
| 연동 | AI 모델과 백엔드 서버 연동 |
| 분석 | 모델별 성능 및 추론 결과 비교 분석 |

---

## 전체 아키텍처

```
[브라우저]
    │
    ▼
[Frontend]         Next.js · React · TypeScript
    │  HTTP API / WebSocket / SSE
    ▼
[Backend]          FastAPI · Python · MySQL
    │  HTTP API
    ├──────────────────────────┐
    ▼                          ▼
[AI Server]               [Chatbot Service]
FastAPI · YOLO · Keras    FastAPI · LLM API · SSE
    │
    ▼
[CCTV 스트림]  ITS 공공 API / 직접 스트림

[DB]   MySQL (회원 · CCTV · 감지 결과 · 채팅 이력)
[HA]   Keepalived — VIP 기반 MySQL 장애 조치
```

---

## 주요 기술 스택

| 영역 | 기술 |
|---|---|
| **AI · ML** | Python · YOLOv11m (Ultralytics) · Keras (TensorFlow) · FastAPI |
| **Backend** | FastAPI · Python · SQLAlchemy · PyMySQL · MySQL 8 · JWT · Google OAuth 2.0 |
| **Frontend** | Next.js 16 · React 19 · TypeScript · WebSocket · SSE |
| **Infra** | systemd · Keepalived · rsync |

---

## 디렉터리 구조

```
RoadAEye/
├── ai/
│   ├── road-ai/                    # AI 추론 서버 (FastAPI)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── modules/            # keras / yolo / its / chat
│   │   │   ├── core/               # config, security, events
│   │   │   └── infrastructure/     # model_registry, database, storage
│   │   ├── models/                 # 모델 가중치 (미포함 — 하단 안내 참조)
│   │   ├── train_keras_gate_v15.py
│   │   ├── train_keras_v16.py
│   │   ├── upload_server.py
│   │   └── requirements.txt
│   └── highway-chatbot-server/     # AI 챗봇 서버 (LLM · SSE)
│       ├── main.py
│       ├── env.example
│       └── requirements.txt
├── backend/
│   └── FastAPI/                    # 백엔드 API 서버
│       ├── main.py
│       ├── routers/
│       ├── models/
│       ├── schemas/
│       ├── services/
│       └── core/
├── frontend/
│   └── project-html/               # Next.js 관제 대시보드
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── public/
└── infra/
    ├── systemd/
    │   └── roadeye-ai.example.service
    └── keepalived/
        ├── keepalived.example.conf
        ├── check_mysql.example.sh
        ├── mysql-healthcheck.example.cnf
        └── README.md
```

---

## 실행 방법

> 각 서비스는 별도 서버에서 운영되도록 설계되었습니다. 단일 머신에서 실행할 경우 포트 충돌에 유의하세요.

### 환경변수 설정

공개 예시 환경변수 파일이 제공되는 서비스는 해당 파일을 참고하여 로컬 `.env`를 작성해야 합니다. 실제 인증정보는 저장소에 포함되어 있지 않습니다.

```bash
# 예시 (highway-chatbot-server)
cp ai/highway-chatbot-server/env.example \
   ai/highway-chatbot-server/.env
```

### AI 서버 (road-ai)

```bash
cd ai/road-ai
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 챗봇 서버

```bash
cd ai/highway-chatbot-server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 백엔드 서버

```bash
cd backend/FastAPI
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 프론트엔드

```bash
cd frontend/project-html
npm install
npm run dev
```

### 모델 가중치 안내

`ai/road-ai/models/` 의 가중치 파일(`.pt`, `.keras`, `.h5` 등)은 저장소에 포함되어 있지 않습니다.  
가중치 파일과 환경변수 설정 없이는 AI 추론 기능이 즉시 실행되지 않습니다.  
실행 전 가중치 파일을 별도로 확보하고 `.env`의 모델 버전 경로를 확인하세요.

---

## 보안 및 공개 범위

| 항목 | 처리 방식 |
|---|---|
| 운영 서버 내부 네트워크 주소 | `localhost` 또는 예시값으로 교체 |
| `.env` 파일 (DB 비밀번호, API 키, JWT 시크릿 등) | `.gitignore` 제외 |
| 사용자 데이터, 로그 파일, 백업 파일 | 미포함 |
| 팀원 이미지, 캡처 영상 등 검토 미완료 미디어 | 미포함 |
| 모델 가중치 파일 | `.gitignore` 제외 (별도 관리) |

인증정보 설정 예시는 `env.example` 파일이 제공되는 서비스 디렉터리를 참고하세요.

---

## 향후 개선 계획

- [ ] 모델 가중치 파일 GitHub Releases 또는 외부 스토리지 연동
- [ ] Docker Compose 기반 로컬 실행 환경 구성
- [ ] ITS 공공 API 연동 설정 가이드 보완

---

## 기여 범위 안내

본 저장소는 5인 팀 프로젝트의 산출물을 바탕으로 구성되었습니다.  
저자는 AI 모델 학습, 성능 개선, AI 추론 서버 구축 및 백엔드 연동을 담당했습니다.  
그 외 프론트엔드, 백엔드, DB 및 인프라 영역은 팀원들과 역할을 분담하여 개발했습니다.
