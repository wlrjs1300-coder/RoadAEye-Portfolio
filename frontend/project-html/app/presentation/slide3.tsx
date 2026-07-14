'use client';
// Chapter 1 - 조원 소개
import { useState } from 'react';
import styles from './presentation.module.css';

type DetailCard = { badge: string; group?: string; title: string; items: string[]; numbered?: boolean };
type Member = {
  name: string;
  role: string;
  img: string;
  accent: string;
  tags: string[];
  desc: string;
  detail?: DetailCard[];
  detailTitle?: string;
};

// 팀원 D — 백엔드 작업 내역 (원문 그대로)
const G1 = 'FastAPI 백엔드 전체 구축';
const backendDetail: DetailCard[] = [
  { badge: '1-1', group: G1, title: '아키텍처', items: [
    'FastAPI REST API 서버',
    'SQLAlchemy 비동기 ORM (AsyncSession)',
    'Pydantic 스키마 유효성 검사',
    '라우터 · 서비스 · 스키마 · 모델 계층 분리',
    '인증 · 보안',
  ] },
  { badge: '1-2', group: G1, title: 'JWT 액세스 토큰 발급 · 검증', items: [
    '비밀번호 해싱 (bcrypt)',
    '소셜 로그인 OAuth2 (네이버 · 카카오 · 구글)',
    '이메일 인증 코드 발송 · 검증',
    '아이디 · 비밀번호 찾기',
    'Brute Force 방지 (로그인 시도 횟수 제한)',
    '역할 기반 권한 (user · admin / require_admin)',
    'CORS 설정',
  ] },
  { badge: '1-3', group: G1, title: '사용자', items: [
    '회원가입 · 로그인 · 로그아웃',
    '소셜 계정 연동',
    '개인정보 조회 · 수정',
    '이메일 변경 (인증 포함)',
    '비밀번호 변경 · 재설정',
    '계정 정지 · 활성화 (is_active)',
    '회원 탈퇴',
  ] },
  { badge: '1-4', group: G1, title: '게시판', items: [
    '공지사항 CRUD',
    '1:1 문의 CRUD + 첨부파일',
    '관리자 답변 등록 · 수정 · 삭제',
    'FAQ CRUD',
    '자료실 CRUD + 첨부파일',
    '파일 업로드 · 다운로드',
  ] },
  { badge: '1-5', group: G1, title: 'CCTV · AI 감지', items: [
    'CCTV 등록 · 관리',
    'OpenCV 기반 영상 스트리밍',
    '위험 차량 감지 · 기록',
    '감지 상태 관리 (UNREAD · CONFIRMED · DISMISSED)',
    '감지 통계 · 히트맵',
  ] },
  { badge: '1-6', group: G1, title: '관리자', items: [
    '사용자 목록 · 검색 · 역할 변경 · 정지 · 삭제',
    '활동 로그 기록 · 조회',
    '시스템 설정',
  ] },
  { badge: '1-7', group: G1, title: '기타', items: [
    'WebSocket 실시간 알림',
    'ITS 외부 API 연동',
    '환경변수 기반 설정 관리 (pydantic-settings)',
    'FastAPI-Mail 이메일 발송',
    '서버 자동 시작 (nohup·systemd)',
  ] },
  { badge: '2', title: '버그 수정', numbered: true, items: [
    '공지사항 수정 : PATCH → PUT 변경',
    "챗봇 2번째 메시지 오류 : 'MessageRole enum values_callable' 추가 (소문자 · 대문자 불일치)",
    "회원 탈퇴 CORS 오류 : FK 제약 ('user_settings' 먼저 삭제 후 'users' 삭제)",
    "is_active 차단 미작동 : 로그인 시 'is_active' 체크 누락 → 추가",
    "개인정보 수정 초기화 : 'update_me()'에 'address', 'address_detail' 저장 코드 누락 → 추가 + DB 컬럼 추가",
    "수정 페이지 접속 불가 : 'router.push' 템플릿 리터럴에서 '${id}' 누락",
  ] },
  { badge: '3', title: '자체 모달 시스템', numbered: true, items: [
    "'AlertModal' 컴포넌트 신규 제작",
    "variant prop : 'error (XCircle)', 'success (CheckCircle)'",
    '포인트 색상 #e11d48 전체 통일',
    '두 버튼 모드 (onConfirm prop), 버튼 순서 · 색상 조정',
    '간격(padding) 균등 조정',
    'ConfirmModal : dangerBtn 색상 #dc2626 → #e11d48',
    "ModalContext : 전역 'showAlert', 'showConfirm' 제공",
    "22개 페이지 : 'native alert()', 'confirm()' → 자체 모달로 일괄 교체",
  ] },
  { badge: '4', title: '접근 제어 · 인증', numbered: true, items: [
    '헤더 역할 기반 : 비회원 로그인 시 분석 센터 메뉴 숨김 (loginOnly 속성)',
    '모니터링 시작 : 관리자 권한 없는 사용자에게 접근 제한 모달 표시',
    "계정 정지 로그인 차단 : 일반 로그인 + 소셜 로그인 모두 'is_active=False' 시 403 반환",
    '소셜 로그인 정지 처리 : /auth/callback?error=suspended → /login?suspended=1 리다이렉트',
    'SuspendedModal 위치 통일 : 소셜 · 일반 정지 모달 동일한 로그인 페이지에서 표시',
    "정지 계정 문의 : POST /board/inquiries/anonymous (비인증 허용), 'user_no=0' 저장",
  ] },
  { badge: '5', title: '기능 추가', numbered: true, items: [
    '1:1 문의 수정 기능',
    '백엔드 : PUT /board/inquiries/{id} 엔드포인트, InquiryUpdate 스키마',
    '프론트 : /board/qna/edit/[id] 편집 페이지, 수정 버튼 (본인만 노출)',
    '회원 탈퇴 : DELETE /profile 엔드포인트, delete_me() 서비스 함수',
    '알림 이력 버튼',
    '클릭 읽음 제거 → 읽음 · 안읽음 토글 버튼 + 삭제 버튼',
    '삭제 완료 팝업 추가',
    '관리자 정지 문의 탭',
    '더미 데이터 15건 (접수 · 처리 중 · 완료 혼합)',
    '페이지네이션 10개씩',
    '삭제 버튼 (DELETE /board/inquiries/{id})',
    "개인정보 저장 : 'address_detail DB' 컬럼 추가, ORM · 스키마 · 서비스 반영",
  ] },
  { badge: '6', title: '인프라 · 빌드', numbered: true, items: [
    '프론트 빌드 : Node.js 20 (nvm 경로) 명시 사용',
    'OOM 반복 : VS Code 프로세스 메모리 과점유가 원인, 접속 해제로 해결',
    '빌드 명령 : next build --webpack (Turbopack 비호환)',
  ] },
];

// 팀원 C — 프론트엔드 작업 내역 (원문 그대로)
const FA = '프론트 작업 내역';
const FB = '백엔드 연결 운영 방식';
const frontDetail: DetailCard[] = [
  { badge: 'A-1', group: FA, title: '사용 스택', items: [
    'Next.js 16 (App Router) · React 19 · TypeScript',
    'CSS Modules + CSS 변수 기반 다크/라이트 테마',
  ] },
  { badge: 'A-2', group: FA, title: '공통 UI', items: [
    '반응형 글로벌 헤더 — 멀티컬럼 드롭다운, 권한별(관리자/일반) 메뉴 노출',
    '테마 토글 (다크/라이트, 새로고침 깜빡임 방지)',
    '공통 모달 시스템 (확인/상세/입력)',
    'AI 챗봇 플로팅 어시스턴트',
  ] },
  { badge: 'A-3', group: FA, title: '인증', items: [
    '소셜 로그인 (Google · Kakao · Naver) + 콜백 처리',
    '로그인 상태 실시간 반영 (헤더/마이페이지 연동)',
  ] },
  { badge: 'B-1', group: FB, title: '실시간 관제 (관리자)', items: [
    '통합 관제 대시보드 — 실시간 CCTV 뷰',
    '스트림 관리 — 전국 CCTV 검색 → AI 분석 시작/중지',
    'AI 모델 비교 — 이미지 업로드로 3개 모델 결과 비교',
  ] },
  { badge: 'B-2', group: FB, title: '분석 센터', items: [
    '통계 리포트 — 기간별 감지 추이·유형별 현황·CCTV 순위 (차트 + 캘린더 범위 선택)',
    '위험 구간 지도(히트맵)',
    '감지 기록 — 감지 로그 검토 → 확인/반려 처리',
    'AI 모델 관리',
  ] },
  { badge: 'B-3', group: FB, title: '관리자 시스템', items: [
    '사용자 관리 — 권한 변경·정지·삭제·활동 이력',
    '활동 로그 — 시스템 동작 이력 (사용자 최적화를 위해 DB 키워드 프론트 내부에서 변경)',
    '정지 문의 — 문의 확인 → 정지 해제/반려 + 사유 답변',
  ] },
  { badge: 'B-4', group: FB, title: '게시판 · 기타', items: [
    '공지사항 · FAQ · 1:1 문의(QnA)',
    '알림 이력 · 환경설정 · 마이페이지',
  ] },
];

// 팀원 B — YOLO 객체 탐지 작업 내역 (원문 그대로)
const yoloDetail: DetailCard[] = [
  { badge: '1', title: '데이터 수집', items: [
    '전동킥보드', '경운기(Cultivator)', '굴착기(Excavator)', '리어카(Rear Car)', '전동휠체어(Wheelchair)',
    '지게차(Stacker)', '트랙터(Tractor)', '사람(Person)', '차량(Car)', '오토바이(Motorcycle)',
  ] },
  { badge: '2', title: '데이터셋 구축 및 라벨링', items: [
    'CCTV 환경 데이터 수집',
    '고속도로/IC/톨게이트/분기점 이미지 확보',
    '객체별 이미지 정리 및 분류',
    '학습용 데이터셋 구조 구성',
    'train / valid / test 데이터셋 구성',
    '클래스 정의 및 라벨 설정',
    '전동킥보드 라벨링 완료',
    '경운기 라벨링 완료',
    '리어카 라벨링 완료',
    '트랙터 라벨링 완료',
    '지게차 라벨링 완료',
    '기타 클래스 라벨링 진행',
    'YOLO 형식(Ultralytics YOLO Detection) Export',
  ] },
  { badge: '4', title: '데이터 전처리', items: [
    '라벨 검증', '라벨 오류 수정', 'UTF-8 BOM 제거', '데이터셋 정리 및 통합', '클래스 구조 검증',
  ] },
  { badge: '5', title: 'YOLO 모델 학습', items: [
    'YOLOv8n 학습 수행',
    'Precision / Recall / mAP50 / mAP50-95 성능 분석',
    'Confusion Matrix 분석',
    'PR Curve 분석',
    '학습 로그 및 결과 정리',
  ] },
];

// 이지건 — AI 모델 작업 내역 (원문 그대로)
const K1 = '1. Keras 분류 모델';
const K2 = '2. YOLOv11m 탐지 모델';
const K3 = '3. AI 서버 모델 연동';
const K4 = '4. 발표자료 · 결과 정리';
const aiModelDetail: DetailCard[] = [
  { badge: '1-1', group: K1, title: '모델 구조', items: [
    'Keras MobileNetV2 기반 전이학습 모델 구축',
    '고속도로 CCTV 이미지 기반 교통수단 분류 모델 설계',
    '금지 교통수단 여부를 1차 판별하는 게이트 모델 역할로 구성',
    '.keras 모델과 TFLite FP16 경량화 모델을 AI 서버에 등록',
    '입력 이미지 크기 자동 감지 및 추론 전처리 구조 구성',
  ] },
  { badge: '1-2', group: K1, title: '학습 및 성능 개선', items: [
    'Keras 1차부터 11차까지 반복 학습 실험 진행',
    'Optimizer, learning rate, weight decay, 입력 해상도, backbone 변경 실험',
    'MobileNetV2, EfficientNetB3 등 backbone 비교',
    'Adam, AdamW, Nadam 등 optimizer별 성능 변화 분석',
    '10차 EfficientNetB3 실험 실패 원인 분석 : EfficientNet 계열 전처리 충돌로 성능 급락 확인',
    '11차 모델을 최종 후보로 선정 : MobileNetV2 + AdamW 기반 안정적 성능 확보',
  ] },
  { badge: '1-3', group: K1, title: '주요 성능 분석', items: [
    '테스트 정확도, Top-2 Accuracy, AUC, 금지차량 Recall 비교',
    '클래스별 Precision / Recall / F1-score 분석',
    'Confusion Matrix 및 평가 리포트 기반 오분류 원인 확인',
    '단순 정확도보다 금지차량 미탐지 최소화를 핵심 기준으로 모델 선정',
    '실시간 CCTV 환경 적용을 고려해 정확도와 추론 속도 균형 검토',
  ] },
  { badge: '1-4', group: K1, title: '데이터 수집 및 전처리', items: [
    '고속도로 진입 금지 교통수단 이미지 데이터 수집',
    '클래스별 데이터 정리 및 라벨 기준 통일',
    'CCTV 환경을 고려한 이미지 전처리 수행',
    '해상도 조정, 정규화, 학습/검증/테스트셋 분리',
    '부족 클래스 성능 개선을 위한 데이터 증강 방향 검토',
    'Keras 재학습용 안전 프레임 수집 구조와 연계 검토',
  ] },
  { badge: '2-1', group: K2, title: '모델 구조', items: [
    'Ultralytics YOLOv11m 기반 객체 탐지 모델 학습',
    'CCTV 영상 내 금지 교통수단 위치 탐지를 위한 detection 모델 구성',
    'AI 서버에 yolov11m_v3_best.pt 모델 등록',
    '이미지 업로드 예측, 실시간 프레임 예측, 영상 분석 기능과 연동',
  ] },
  { badge: '2-2', group: K2, title: '학습 및 개선', items: [
    'YOLOv11m 1차, 2차, 3차 학습 결과 비교',
    '1차 모델을 기준 성능 모델로 설정',
    '2차 학습 실패 원인 분석 : imgsz 832와 multi_scale 0.5 동시 적용으로 학습 시간 증가 및 성능 하락',
    '3차 학습 안정화 전략 적용 : imgsz 640 복귀 · multi_scale 제거 · lr0 0.001로 축소 · box loss·copy_paste 강도 완화 · cos_lr·mixup 유지',
    '3차 모델을 최종 YOLOv11 배포 후보로 선정',
  ] },
  { badge: '2-3', group: K2, title: '주요 성능 분석', items: [
    '1차 대비 3차 Best mAP50 개선 : 99.15% → 99.22%',
    '1차 대비 3차 Best mAP50-95 개선 : 83.88% → 84.30%',
    '학습 시간 정상화 : 2차 약 750분 → 3차 약 95분으로 개선',
    'mAP, Precision, Recall, Loss 지표를 기준으로 성능 안정성 검증',
    '최종 권장 모델 : yolov11m_v3/weights/best.pt',
    '※ 위 수치는 프로젝트 학습 당시 측정 결과이며, 학습 데이터셋·가중치·학습 스크립트는 본 저장소에 포함되어 있지 않음',
  ] },
  { badge: '3-1', group: K3, title: 'Keras 모델 연동', items: [
    'FastAPI 기반 AI 서버에 Keras 추론 API 구성',
    '/api/v1/keras/classify 형태의 분류 API 제공',
    'Keras 모델 메타데이터 기반 클래스명, 금지 클래스 정보 로드',
    '.keras 및 .tflite 모델 모두 추론 가능하도록 구성',
    'TFLite 모델 동시 추론 안정성을 위해 interpreter lock 적용',
  ] },
  { badge: '3-2', group: K3, title: 'YOLOv11 모델 연동', items: [
    'YOLOv11 v3 모델을 AI 서버에 등록',
    '/api/v1/yolo/predict/v3 예측 API 구성',
    '업로드 이미지 저장 후 YOLOv11 탐지 결과 반환',
    '탐지 클래스, 신뢰도, bounding box 결과 제공',
    '실시간 관제 및 AI 모델 테스트 페이지와 연동',
  ] },
  { badge: '3-3', group: K3, title: '앙상블 구조 연계', items: [
    'Keras를 1차 게이트 모델로 활용하는 구조 설계',
    'Keras가 금지 교통수단 가능성을 판단한 뒤 YOLO 탐지 모델 실행',
    'YOLOv8과 YOLOv11 결과를 Soft Voting 방식으로 병합',
    'YOLOv11에 더 높은 가중치를 부여해 최종 탐지 신뢰도 계산',
    '이미지 분석뿐 아니라 영상 업로드 분석까지 확장',
    '프레임 단위 샘플링 후 Keras, YOLOv8, YOLOv11 결과 비교 가능하도록 구성',
  ] },
  { badge: '4-1', group: K4, title: 'Keras 모델 리포트 작성', items: [
    'Keras 1차~11차 학습 결과 비교 페이지 구성',
    '각 차수별 핵심 변경 사항, Accuracy, macro F1, Recall 정리',
    '최종 선정 모델과 선정 이유 시각화',
    '그래프 기반 성능 비교 자료 구성',
  ] },
  { badge: '4-2', group: K4, title: 'YOLOv11 모델 리포트 작성', items: [
    'YOLOv11m 1차~3차 학습 결과 비교 페이지 구성',
    '2차 실패 원인과 3차 개선 전략 정리',
    'mAP50, mAP50-95, Precision, Recall, Loss 지표 비교',
    '최종 배포 권장 모델과 근거 정리',
  ] },
  { badge: '4-3', group: K4, title: '최종 AI 방향 정리', items: [
    'Keras 단독 분류, YOLOv11 단독 탐지의 장단점 분석',
    '최종 방향을 Keras 게이트 + YOLOv8/YOLOv11 Soft Voting 앙상블로 정리',
    '실시간 CCTV 환경에서 연산량 절감과 탐지 정확도 향상을 동시에 고려한 구조 제안',
  ] },
];

// 팀원 A — DB · 인프라 작업 내역 (4개 서버 실측 기반)
const dbDetail: DetailCard[] = [
  { badge: '1', title: 'DB 설계 · 구축', items: [
    '4개 데이터베이스 설계 : member_db · ai_db · board_db · chat_db',
    '도메인별 DB 분리 (회원 / AI / 게시판 / 챗봇)',
    '4개 서버 분산 배치 구조 설계 (AI · Back · Front · DB)',
    'MySQL 8.0.46 · Ubuntu 24.04 LTS 환경 표준화',
  ] },
  { badge: '2', title: '이중화(HA) · 멀티마스터 복제', items: [
    'MySQL 멀티마스터 복제 구성 (AI server-id 1 ↔ Back server-id 2)',
    'auto_increment_increment=2, offset 1·2 → PK 충돌 방지 액티브-액티브',
    'DB 서버(server-id 3) 복제 노드 구성 (relay-log 기반)',
    'log_bin(mysql-bin) 바이너리 로그 기반 복제',
  ] },
  { badge: '3', title: 'Keepalived 자동 페일오버', items: [
    'VRRP 가상 IP(VIP) 이중화 구성',
    'ai_db VIP localhost (246 ↔ 장애 시 249)',
    'member · board · chat_db VIP localhost (247 ↔ 장애 시 249)',
    'check_mysql.sh 헬스체크 (2초 간격, mysqladmin ping)',
    '장애 감지 시 priority -20 → 대기 노드로 무중단 전환',
  ] },
  { badge: '4', title: '백업 · 데이터 보호', items: [
    '일일 자동 백업 (cron 매일 03:00, backup_mysql.sh)',
    '4개 DB mysqldump (--single-transaction · routines · triggers · GTID)',
    'gzip 압축 저장 · 최근 7일 보관',
    '~/.my.cnf(600) 인증 + 백업 성공/실패 로그 기록',
  ] },
  { badge: '5', title: '서버 인프라 · 배포', items: [
    '4개 서버 분산 인프라 구축 (AI 246 · Back 247 · Front 248 · DB 249)',
    'systemd 서비스 등록 : roadeye-ai · roadeye-backend · roadeye-frontend',
    '서버 부팅 시 자동 기동 · auto-restart 구성',
    'SSH alias 기반 4개 서버 통합 관리 체계',
  ] },
  { badge: '6', title: '프로젝트 총괄 (Leader)', items: [
    '4조 팀 리더 — 일정 · 역할 분배 총괄',
    'AI · Back · Front · DB 4개 파트 통합 조율',
    '서버 간 연동 구조(VIP · 복제 · API) 설계 · 의사결정',
  ] },
];

export default function Chapter1() {
  const [open, setOpen] = useState<string | null>(null);

  const members: Member[] = [
    { name: '팀원 A', role: 'Leader · DB', img: '/members/팀원A.png', accent: '#c0392b', tags: ['MySQL', 'Keepalived', 'Replication'], desc: 'DB 설계 · 이중화 · 인프라 총괄', detail: dbDetail, detailTitle: 'DB · 인프라 작업 내역' },
    { name: '이지건', role: 'Keras-AI', img: '/members/이지건이모지.png', accent: '#2e7d8a', tags: ['Keras', 'TensorFlow', 'Deep Learning'], desc: 'Keras 정확도 99.11% · Recall 100%', detail: aiModelDetail, detailTitle: 'AI 모델 작업 내역' },
    { name: '팀원 B', role: 'YOLO-AI', img: '/members/팀원B.png', accent: '#2e7d5b', tags: ['YOLOv8s', 'ITS API', 'Stream'], desc: '객체 탐지 모델 · mAP50 94.8%', detail: yoloDetail, detailTitle: 'YOLO 객체 탐지 작업 내역' },
    { name: '팀원 C', role: 'Front-end', img: '/members/팀원C.png', accent: '#7b5ea7', tags: ['Next.js', 'Tailwind', 'recharts'], desc: '33개 페이지 · 9개 컴포넌트 구현', detail: frontDetail, detailTitle: '프론트엔드 작업 내역' },
    { name: '팀원 D', role: 'Back-end', img: '/members/팀원D.png', accent: '#c47a1a', tags: ['FastAPI', 'JWT', 'SQLAlchemy'], desc: '8개 API 라우터 · 4개 DB 연동', detail: backendDetail, detailTitle: '백엔드 작업 내역' },
  ];

  const active = members.find((m) => m.name === open && m.detail);

  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ padding: '80px 60px 20px' }}>
        <div className={styles.chapterBadge}>Chapter 1</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 32 }}>조원 소개</h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 22,
          width: '100%',
          padding: '0 20px',
          boxSizing: 'border-box',
          alignItems: 'stretch',
        }}>
          {members.map((m) => (
            <div
              key={m.name}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 18px 38px rgba(91,140,174,0.30)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 26px rgba(91,140,174,0.18)'; }}
              style={{
                position: 'relative',
                background: '#ffffff',
                borderRadius: 18,
                border: '1px solid #e6eef4',
                boxShadow: '0 8px 26px rgba(91,140,174,0.18)',
                padding: '30px 18px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: m.accent }} />

              <div style={{
                width: 128, height: 128, borderRadius: '50%',
                background: 'linear-gradient(135deg, #eef4f8 0%, #d3e0ea 100%)',
                border: `3px solid ${m.accent}`,
                boxShadow: `0 6px 16px rgba(0,0,0,0.12), 0 0 0 6px ${m.accent}1f`,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={m.img} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div style={{ marginTop: 16, fontSize: 26, fontWeight: 800, color: '#1f2d3d', letterSpacing: '-0.3px' }}>{m.name}</div>

              <div style={{
                marginTop: 9, background: m.accent, color: '#fff', fontSize: 16, fontWeight: 700,
                padding: '6px 18px', borderRadius: 20, letterSpacing: '0.2px', whiteSpace: 'nowrap',
              }}>{m.role}</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                {m.tags.map((t) => (
                  <span key={t} style={{
                    background: '#f0f5f9', color: '#46627a', border: '1px solid #dde8f0',
                    padding: '4px 11px', borderRadius: 7, fontSize: 15, fontWeight: 600,
                  }}>{t}</span>
                ))}
              </div>

              {m.detail && (
                <button
                  data-nav="true"
                  onClick={(e) => { e.stopPropagation(); setOpen(m.name); }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${m.accent}80`; e.currentTarget.style.filter = 'brightness(1.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 12px ${m.accent}59`; e.currentTarget.style.filter = 'none'; }}
                  style={{
                    marginTop: 24, alignSelf: 'stretch',
                    background: m.accent, color: '#fff', border: 'none', borderRadius: 10,
                    padding: '12px 14px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: `0 4px 12px ${m.accent}59`, fontFamily: 'inherit',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
                  }}
                >
                  작업 내역 보기 <span style={{ fontSize: 17, lineHeight: 1 }}>›</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.pageNumber}>3</div>

      {/* ===== 상세 모달 ===== */}
      {active && (
        <div
          data-nav="true"
          onClick={(e) => { e.stopPropagation(); setOpen(null); }}
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 1344, height: '100%', maxHeight: 752,
              background: '#fff', borderRadius: 20, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
            }}
          >
            {/* 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 28px', borderBottom: `3px solid ${active.accent}`,
              background: `linear-gradient(90deg, #fff 0%, ${active.accent}14 100%)`,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
                border: `3px solid ${active.accent}`, flexShrink: 0,
                background: 'linear-gradient(135deg, #eef4f8, #d3e0ea)',
              }}>
                <img src={active.img} alt={active.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#1f2d3d' }}>{active.name}</span>
                  <span style={{
                    background: active.accent, color: '#fff', fontSize: 13, fontWeight: 700,
                    padding: '3px 12px', borderRadius: 14,
                  }}>{active.role}</span>
                </div>
                <span style={{ fontSize: 15, color: '#7a8896', fontWeight: 600 }}>{active.detailTitle}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(null); }}
                style={{
                  marginLeft: 'auto', width: 40, height: 40, borderRadius: '50%',
                  border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
                  fontSize: 22, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
                }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 본문 — 3열 그리드 */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '24px 30px 30px',
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18,
              alignContent: 'start', alignItems: 'start', gridAutoRows: 'max-content',
            }}>
              {active.detail!.map((c, i) => (
                <div key={c.title + i} style={{
                  background: '#fbfcfe', border: '1px solid #e8eef4', borderRadius: 13,
                  padding: '17px 18px 18px', minHeight: 0, height: 'fit-content', alignSelf: 'start', overflow: 'visible',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13,
                    paddingBottom: 11, borderBottom: '1px solid #eef2f6',
                  }}>
                    <span style={{
                      flexShrink: 0, fontSize: 13.2, fontWeight: 850, color: '#fff',
                      background: active.accent, borderRadius: 6, padding: '4px 9px', letterSpacing: '0.5px',
                    }}>{c.badge}</span>
                    <span style={{ fontSize: 17.8, fontWeight: 850, color: '#28323d', lineHeight: 1.28, minWidth: 0, overflowWrap: 'anywhere' }}>{c.title}</span>
                    {c.group && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 12.2, fontWeight: 800, color: active.accent,
                        background: `${active.accent}14`, border: `1px solid ${active.accent}33`, borderRadius: 10, padding: '3px 9px',
                        whiteSpace: 'nowrap',
                      }}>{c.group}</span>
                    )}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {c.items.map((it, j) => (
                      <li key={j} style={{ display: 'flex', gap: 8, fontSize: 15.2, color: '#46586a', lineHeight: 1.58, fontWeight: 650, alignItems: 'flex-start' }}>
                        {c.numbered ? (
                          <span style={{
                            flexShrink: 0, minWidth: 20, fontSize: 14.2, fontWeight: 850,
                            color: active.accent, textAlign: 'right',
                          }}>{j + 1}.</span>
                        ) : (
                          <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: active.accent, marginTop: 8 }} />
                        )}
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
