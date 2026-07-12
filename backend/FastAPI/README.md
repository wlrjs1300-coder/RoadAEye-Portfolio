# Road A Eye
### AI 기반 고속도로 CCTV 위험차량 감지 관제 시스템

> 실시간 CCTV 스트리밍 · YOLO 기반 위험차량 자동 감지 · AI 관제 어시스턴트를 하나의 플랫폼에서 제공합니다.

---

## 링크

| 구분 | URL |
|------|-----|
| FastAPI 자동 문서 | http://localhost:8000/docs |
| GitHub | https://github.com/sys8815701-creator/Road-A-Eye |

---

## 배경

국토교통부 통계에 따르면 고속도로 교통사고의 주요 원인 중 하나는 킥보드·오토바이·건설 차량 등 **통행 금지 차량의 진입**과 **역주행**입니다. 이러한 사고는 짧은 시간 안에 다중 추돌로 이어져 인명 피해가 크지만, 기존 관제 방식은 수십 개의 CCTV 화면을 관제 요원이 육안으로 모니터링하는 구조여서 즉각적인 대응에 한계가 있습니다.

이 과정에서 발생하는 구조적 문제는 크게 세 가지입니다.

**첫째, 육안 모니터링의 집중력 한계입니다.**
수십 개의 CCTV를 동시에 주시하는 것은 인지 부하 측면에서 근본적인 한계를 가집니다. 짧은 순간 화면을 놓치면 위험 상황을 인지하지 못한 채 지나칠 수 있습니다.

**둘째, 이상 상황 탐지의 지연입니다.**
위험 차량이 진입한 뒤 관제 요원이 이를 인지하고 대응 조치를 취하기까지 걸리는 시간이 사고 발생 여부를 결정짓는 핵심 변수입니다. 수동 모니터링 체계에서는 이 탐지 지연을 최소화하기 어렵습니다.

**셋째, 반복 패턴 데이터 부재입니다.**
특정 구간에서 위험 차량이 반복적으로 출현하더라도, 수기 기록 방식으로는 패턴을 통계적으로 분석하고 예방 조치를 취하는 것이 사실상 불가능합니다.

---

## 목적

**CCTV 영상 → YOLO 자동 감지 → 관제 대시보드 실시간 반영**

---

## 목표

| 단계 | 목표 |
|------|------|
| 1차 | CCTV 실시간 MJPEG 스트리밍 및 등록·관리 |
| 2차 | YOLO 기반 위험차량 자동 감지 및 감지 기록 저장 |
| 3차 | 감지 통계·히트맵·반복 출현 차량 분석 |
| 4차 | ITS API 연동을 통한 고속도로 CCTV 자동 동기화 |
| 최종 | AI 관제 어시스턴트 + 소셜 로그인 + 게시판 + 모델 버전 관리를 통합한 고속도로 CCTV AI 관제 플랫폼 구축 |

---

## 시스템 구조

```
관제 요원 (브라우저)
   ↓
React 프론트엔드
   ↓
FastAPI 백엔드 (localhost:8000)
   ↓         ↓
MySQL DB   AI 감지 서버 (localhost:8001)
(localhost)      ↓
              YOLO 위험차량 감지
                     ↓
              고속도로 CCTV 스트림 (RTSP/HTTP)
```

---

## 전체 디렉토리 구조

```
FastAPI/                                           # FastAPI 백엔드
├── main.py                                        # 앱 진입점 (lifespan, 라우터 등록)
├── env.example                                    # 환경변수 템플릿
├── requirements.txt
├── core/
│   ├── config.py                                  # Pydantic Settings (멀티-DB URL 생성)
│   ├── database.py                                # async SQLAlchemy 멀티-DB 엔진
│   └── security.py                                # JWT 발급·검증, get_current_user
├── models/
│   ├── orm.py                                     # User, EmailVerification, UserSetting, CCTV, ForbiddenClass, Detection
│   ├── board_orm.py                               # Notice, Inquiry, FAQ, Archive, BugPost 등
│   ├── chat_orm.py                                # ChatSession, ChatMessage
│   ├── model_orm.py                               # ModelVersion
│   └── admin_orm.py                               # ActivityLog, SystemConfig
├── routers/
│   ├── auth.py                                    # 회원가입·로그인·이메일 인증·소셜 로그인
│   ├── cctv.py                                    # CCTV 관리·스트림·금지 클래스·감지 기록·통계
│   ├── board.py                                   # 게시판 (공지·문의·FAQ·자료실·버그)
│   ├── chat.py                                    # AI 챗봇 (SSE 스트리밍)
│   ├── model.py                                   # AI 모델 버전 관리
│   ├── ws.py                                      # WebSocket 실시간 알림
│   ├── its.py                                     # ITS API CCTV 동기화
│   ├── admin.py                                   # 관리자 대시보드
│   └── settings.py                                # 사용자 설정·프로필
├── services/
│   ├── auth_service.py                            # 인증 비즈니스 로직, 관리자 시딩
│   ├── cctv_service.py                            # CCTV·감지·통계 쿼리
│   ├── stream_service.py                          # StreamManager (OpenCV MJPEG)
│   ├── board_service.py                           # 게시판 CRUD
│   ├── chat_service.py                            # LLM 호출·세션·메시지 관리
│   ├── model_service.py                           # 모델 버전 CRUD
│   ├── admin_service.py                           # 관리자 통계·활동 로그
│   ├── settings_service.py                        # 사용자 설정 저장
│   └── ws_service.py                              # WebSocket 브로드캐스트
├── schemas/                                       # Pydantic 요청/응답 스키마
│   ├── auth_schema.py / cctv_schema.py / board_schema.py
│   ├── chat_schema.py / model_schema.py
│   ├── admin_schema.py / settings_schema.py
└── captures/                                      # AI 서버가 전송한 감지 이미지 (gitignore)
```

---

## 기술 스택

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| FastAPI | 0.115.0 | REST API 서버 |
| Python | 3.11+ | 비즈니스 로직 |
| Uvicorn | 0.30.6 | ASGI 서버 |
| SQLAlchemy | 2.0.36 | 비동기 ORM |
| aiomysql | 0.2.0 | MySQL 비동기 드라이버 |
| MySQL | 8.0+ | 멀티-DB (member / board / ai / chat) |
| PyJWT | 2.10.1 | JWT 인증 |
| bcrypt | 4.2.1 | 비밀번호 암호화 |
| OpenCV (headless) | 4.10.0 | RTSP→MJPEG 스트리밍 |
| OpenAI SDK | latest | AI 관제 어시스턴트 |
| fastapi-mail | 1.4.1 | 이메일 인증 (Gmail SMTP) |
| httpx | 0.27.2 | 소셜 로그인 토큰 교환 |
| pydantic-settings | 2.5.2 | 환경변수 관리 |

### AI 서버 (별도)
| 기술 | 용도 |
|------|------|
| YOLO | 위험차량 실시간 감지 |
| Python | 감지 결과 → FastAPI 전송 |

### Frontend (별도 저장소)
| 기술 | 용도 |
|------|------|
| React | 관제 대시보드 UI |
| WebSocket / SSE | 실시간 알림·챗봇 스트리밍 |

---

## 주요 기능

### 1) 사용자 관리
- 회원가입 / 로그인 / JWT 인증
- 이메일 인증 기반 가입 (`/auth/email/send-code` → `/auth/email/verify` → `/auth/register`)
- 소셜 로그인 (네이버 · 카카오 · 구글)
- 사용자 설정 · 프로필 관리

### 2) CCTV 관리
- CCTV 수동 등록 · 수정 · 삭제 (비활성 처리)
- ITS API 자동 동기화 (`POST /cctv/its/sync`)
- 활성 / 비활성 토글

### 3) 실시간 스트리밍
- RTSP · HTTP 스트림을 MJPEG으로 변환하여 브라우저에 직접 전송
- `StreamManager`가 CCTV별 OpenCV `VideoCapture` 캐싱 및 재사용
- 단일 프레임 스냅샷 `GET /cctv/{id}/snapshot`

### 4) 위험차량 감지
- AI 서버(YOLO)가 감지 시 `POST /cctv/detections`로 이미지·메타데이터 전송
- 감지 기록 저장: CCTV번호 · 감지 클래스 · 신뢰도 · 이미지 경로 · 상태
- 상태 관리: 신규 → 확인 중 → 처리 완료
- 금지 클래스 설정 (킥보드 · 오토바이 · 건설차량 · 역주행 차량 등)

### 5) 통계 및 분석
| 엔드포인트 | 내용 |
|-----------|------|
| `GET /cctv/stats/daily` | 일별 감지 건수 추이 |
| `GET /cctv/stats/heatmap` | CCTV별 위험도 히트맵 |
| `GET /cctv/stats/repeat` | 반복 출현 차량 패턴 |
| `GET /cctv/stats/unread` | 미확인 감지 건수 |

### 6) AI 관제 어시스턴트
- GPT-4o 기반 자연어 질의응답
- 세션별 최근 대화 히스토리 유지 (최대 20개)
- SSE 스트리밍으로 토큰 단위 실시간 전송 (`GET /chat/stream`)
- 감지 기록·CCTV 현황 기반 상황 분석 및 조언

### 7) 게시판
| 유형 | 기능 |
|------|------|
| 공지사항 | 관리자 작성 · 전체 열람 |
| 문의 | 사용자 문의 · 관리자 답변 · 첨부 이미지 |
| FAQ | 자주 묻는 질문 카테고리별 관리 |
| 자료실 | 파일 첨부 자료 업로드·다운로드 |
| 버그 리포트 | 댓글 · 이미지 첨부 |

### 8) AI 모델 버전 관리
- 배포된 YOLO 모델 버전 이력 등록
- 활성 모델 지정 및 메모 관리

---

## AI 탐지 대상

### 1) 위험차량 감지 (`services/cctv_service.py`, AI 서버 → `POST /cctv/detections`)

| 탐지 대상 | 설명 |
|-----------|------|
| 킥보드 | 고속도로 통행 금지 이동 수단 |
| 오토바이 | 고속도로 진입 금지 이륜차 |
| 건설 차량 | 허가 없이 진입한 공사·작업 차량 |
| 역주행 차량 | 반대 방향 주행 차량 |
| 기타 금지 클래스 | 관리자가 동적으로 추가·수정 가능 |

### 2) AI 관제 어시스턴트 분석 항목 (`services/chat_service.py`)

| 분석 대상 | 예시 질문 |
|-----------|-----------|
| 감지 현황 요약 | "오늘 감지된 위험차량은 몇 건인가요?" |
| 위험 구간 분석 | "가장 위험 감지가 많은 CCTV 구간은 어디인가요?" |
| 반복 패턴 파악 | "이번 주 반복 출현 차량 패턴이 있나요?" |
| 미처리 건 안내 | "처리되지 않은 감지 기록이 있나요?" |
| CCTV 운영 현황 | "현재 비활성 상태인 CCTV가 있나요?" |
| 시스템 상태 | "AI 모델 현재 버전은 무엇인가요?" |

### 3) 탐지 한계 및 보완 방식
- **감지 정확도**: YOLO 모델의 신뢰도(confidence) 임계값을 조정하여 오탐·미탐 균형 유지. AI 모델 버전 관리 기능으로 모델 교체 이력 추적.
- **스트리밍 품질**: 네트워크 상태에 따라 RTSP 스트림 품질이 저하될 수 있으며, `StreamManager`가 자동으로 재연결을 시도합니다.

---

## 데이터베이스 구조

본 시스템은 역할별로 4개의 MySQL 데이터베이스를 분리하여 운영합니다.

| DB | 담당 테이블 | 설명 |
|----|------------|------|
| `member_db` | User, EmailVerification, UserSetting, ActivityLog, SystemConfig | 회원 인증 및 관리자 |
| `board_db` | Notice, Inquiry, FAQ, Archive, BugPost 등 | 게시판 전체 |
| `ai_db` | CCTV, ForbiddenClass, Detection | CCTV 관리·감지 기록 (AI 서버 공유) |
| `chat_db` | ChatSession, ChatMessage | AI 챗봇 대화 |

---

## JWT 인증 흐름

### 이메일 · 비밀번호 로그인
```
1. 이메일 인증 코드 발송   POST /auth/email/send-code
2. 인증 코드 확인          POST /auth/email/verify
3. 회원가입                POST /auth/register
4. 로그인                  POST /auth/login
5. FastAPI: bcrypt 검증 → JWT 발급 (core/security.py)
6. 프론트: localStorage 저장
7. 이후 요청: Authorization: Bearer <JWT> → get_current_user() 검증
```

### 소셜 로그인 (네이버 · 카카오 · 구글)
```
1. 로그인 버튼 → GET /auth/{provider}/login
2. FastAPI: OAuth 인가 URL 생성 → Provider 리다이렉트
3. Provider 인증 완료 → 콜백 GET /auth/{provider}/callback?code=...
4. FastAPI: Authorization Code → Access Token 교환 → 사용자 정보 조회
           → DB 신규 등록 또는 기존 계정 연동 → 자체 JWT 발급
5. /auth/callback?token=<JWT> 리다이렉트 → 프론트 localStorage 저장
```

### 보안 설계 포인트
- JWT Payload에 `user_no`, `login_id`만 포함하여 민감 정보 노출 최소화
- 이메일 인증 완료 후에만 로그인 허용 (`EmailVerification` 모델 분리)
- 관리자 엔드포인트에 `require_admin` 의존성으로 권한 분리
- Pydantic Settings `extra='ignore'` 설정으로 환경변수 누락 시 기본값 적용

---

## 실시간 처리 구조

```
관제 요원 브라우저
  │
  ├─ HTTP (REST API)
  │    └─ axios / fetch → FastAPI 라우터 → SQLAlchemy → MySQL
  │
  ├─ MJPEG 스트림
  │    └─ <img src="/cctv/{id}/stream">
  │         └─ stream_service.StreamManager (OpenCV VideoCapture 캐싱)
  │
  ├─ SSE (AI 챗봇 스트리밍)
  │    └─ EventSource /chat/stream
  │         └─ chat_service → OpenAI API 토큰 단위 전달
  │
  └─ WebSocket (실시간 알림)
       └─ ws.py → 감지 이벤트 브로드캐스트
```

---

## 로컬 실행

### 요구 사항
- Python 3.11+
- MySQL 8.0+ (4개 DB 생성 필요)
- OpenCV 의존성 (`libglib2.0-0`, `libgl1-mesa-glx` 등)

### 백엔드
```bash
cd FastAPI
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env
# .env 파일에서 DB 접속 정보, JWT_SECRET_KEY, OPENAI_API_KEY 등 입력
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 데이터베이스 초기화
서버 최초 실행 시 SQLAlchemy `create_all`로 테이블이 자동 생성되고, 기본 관리자 계정이 시딩됩니다 (`ADMIN_*` 환경변수 참조).

### API 문서
서버 실행 후 http://localhost:8000/docs 에서 Swagger UI를 확인할 수 있습니다.

---

## 환경변수

| 변수 | 위치 | 설명 |
|------|------|------|
| `DB_MEMBER_*` | backend `.env` | member_db 접속 정보 |
| `DB_BOARD_*` | backend `.env` | board_db 접속 정보 |
| `DB_AI_*` | backend `.env` | ai_db 접속 정보 |
| `DB_CHAT_*` | backend `.env` | chat_db 접속 정보 |
| `JWT_SECRET_KEY` | backend `.env` | JWT 서명 키 (최소 32자) |
| `OPENAI_API_KEY` | backend `.env` | AI 관제 어시스턴트 LLM |
| `ITS_API_KEY` | backend `.env` | 한국 교통정보시스템 CCTV 동기화 |
| `MAIL_*` | backend `.env` | Gmail SMTP 이메일 인증 |
| `NAVER/KAKAO/GOOGLE_*` | backend `.env` | 소셜 로그인 OAuth |
| `ADMIN_*` | backend `.env` | 초기 관리자 계정 |
| `FRONTEND_ORIGIN` | backend `.env` | CORS 허용 프론트 도메인 |
| `AI_SERVER_URL` | backend `.env` | AI 감지 서버 주소 |
| `AI_API_KEY` | backend `.env` | AI 서버 인증 키 |

전체 변수 목록은 `env.example`을 참조하세요.

---

## 기대 효과

| 효과 | 설명 |
|------|------|
| 위험 탐지 자동화 | YOLO가 CCTV 영상을 실시간으로 분석하여 위험차량을 즉시 감지. 관제 요원의 육안 부담 최소화 |
| 대응 시간 단축 | 감지 즉시 대시보드 알림 및 WebSocket Push로 관제 요원이 신속하게 상황 파악 |
| 데이터 기반 예방 | 감지 이력·히트맵·반복 패턴 통계를 통해 위험 구간을 사전에 파악하고 예방 조치 수립 |
| AI 관제 지원 | 자연어로 감지 현황·CCTV 운영 상태를 즉시 조회. 회계 지식 없이 재무 현황 파악 가능 |
| 확장 가능한 아키텍처 | 멀티-DB 분리 + async SQLAlchemy로 대규모 CCTV 확장 및 타 감지 모델 교체에 유연하게 대응 |

---

## 향후 프로젝트 확장 방향

1. **차량 번호판 인식 (LPR) 연동** — 위험 차량 번호판 자동 추출 및 DB 등록
2. **모바일 관제 앱** — 현장 관제 요원용 모바일 알림·스트리밍
3. **고속도로 VMS 연동** — 위험 감지 시 전광판 자동 경고 메시지 발송
4. **다중 감지 모델 A/B 테스트** — 모델 버전 관리 기능을 활용한 성능 비교
5. **엣지 컴퓨팅 배포** — 현장 카메라 장비에 경량 YOLO 모델 직접 탑재
