// 알림 데이터 공유 모듈
// - 헤더(종 아이콘 배지)와 알림 이력 페이지가 같은 데이터를 보도록 localStorage에 저장
// - 역할(role)에 따라 보이는 알림이 다름:
//   · 관리자(admin) → 진입금지 차량 감지 + CCTV·시스템 알림
//   · 일반 사용자(user) → 새 공지 등록, 개인정보·환경설정 변경 알림
// - 처음 로그인 시 빈 상태로 시작, 실제 이벤트 발생 시에만 알림 추가

import { loadNotificationPrefs } from "./settings";

export interface AppNotification {
  id: number;
  type: "danger" | "info";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

// 스토리지 버전 — 변경 시 모든 기기의 기존 알림 캐시 클리어
const SEED_VERSION = "v5";

// 관리자용 시드 — 실제 AI 모델 9개 클래스 기반 진입금지 차량 감지 알림

type Role = "admin" | "user";

function getCurrentRole(): Role {
  if (typeof window === "undefined") return "user";
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.role === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

function storageKey(role: Role): string {
  return `notifications:${role}:${SEED_VERSION}`;
}

// 관리자 계정 전용 더미 알림 - 위험 감지 및 시스템 관제 상황 시연용
const ADMIN_SEED_VERSION = "demo:admin:v1";
const ADMIN_NOTIFICATIONS: AppNotification[] = [
  { id: 2001, type: "danger", title: "위험 차량 감지 알림", body: "경부선 판교분기점 CCTV에서 Electric Scooter(전동킥보드)가 감지됐습니다.", time: "2026-06-04 09:20", read: false },
  { id: 2002, type: "danger", title: "위험 차량 감지 알림", body: "수도권제1순환선 판교램프 구간에서 Stacker(지게차)가 감지됐습니다.", time: "2026-06-04 10:05", read: false },
  { id: 2003, type: "info",   title: "CCTV 스트림 상태",    body: "서울외곽선 성남IC CCTV 스트림이 정상 연결 상태로 전환됐습니다.", time: "2026-06-04 10:40", read: true  },
  { id: 2004, type: "danger", title: "위험 차량 감지 알림", body: "중부선 하남분기점 구간에서 Tractor(트랙터)가 감지됐습니다.", time: "2026-06-04 11:15", read: false },
  { id: 2005, type: "info",   title: "AI 분석 서버",        body: "Vision API 서버가 GPU 추론 모드로 정상 동작 중입니다.", time: "2026-06-04 12:00", read: true  },
  { id: 2006, type: "danger", title: "위험 차량 감지 알림", body: "영동선 신갈JC 인근 CCTV에서 Wheelchair(전동휠체어)가 감지됐습니다.", time: "2026-06-04 13:25", read: false },
];

// 일반 사용자 계정 전용 더미 알림 - 공지·개인정보·문의 답변 시연용
const DEMO_SEED_VERSION = "demo:user:v2";
const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 1101, type: "info", title: "공지사항 등록",      body: "[공지] Road A Eye 서비스 이용 안내가 등록됐습니다.",                time: "2026-07-01 09:10", read: false },
  { id: 1102, type: "info", title: "1:1 문의 답변 완료", body: "문의하신 실시간 CCTV 확인 방법에 대한 답변이 등록됐습니다.",        time: "2026-07-01 09:35", read: false },
  { id: 1103, type: "info", title: "알림 설정 변경",     body: "관심 공지 및 계정 알림 수신 설정이 저장됐습니다.",                time: "2026-07-01 10:00", read: false },
  { id: 1104, type: "info", title: "개인정보 변경 완료", body: "회원님의 연락처 정보가 정상적으로 변경됐습니다.",                 time: "2026-07-01 10:25", read: true  },
  { id: 1105, type: "info", title: "비밀번호 변경 안내", body: "계정 보안을 위해 비밀번호 변경이 완료됐습니다.",                  time: "2026-07-01 10:50", read: true  },
  { id: 1106, type: "info", title: "서버 점검 안내",     body: "오늘 23시부터 서비스 안정화를 위한 점검이 예정되어 있습니다.",    time: "2026-07-01 11:15", read: false },
  { id: 1107, type: "info", title: "FAQ 업데이트",       body: "자주 묻는 질문에 CCTV 영상 재생 관련 항목이 추가됐습니다.",        time: "2026-07-01 11:40", read: true  },
  { id: 1108, type: "info", title: "공지사항 등록",      body: "[공지] 알림 이력 기능 사용 방법이 새로 안내됐습니다.",            time: "2026-07-01 12:05", read: false },
];

// 알림 목록 로드 — localStorage에 저장된 실제 알림만 반환. 없으면 빈 배열.
export function loadNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const role = getCurrentRole();
  const key = storageKey(role);

  // 관리자 계정: 처음 알림 이력 진입 시 관제 시연용 더미 알림 seed
  if (role === "admin" && (!localStorage.getItem(ADMIN_SEED_VERSION) || !localStorage.getItem(key))) {
    let existing: AppNotification[] = [];
    try {
      const raw = localStorage.getItem(key);
      existing = raw ? JSON.parse(raw) as AppNotification[] : [];
    } catch {
      existing = [];
    }
    const existingIds = new Set(existing.map((n) => n.id));
    const next = [
      ...ADMIN_NOTIFICATIONS.filter((n) => !existingIds.has(n.id)),
      ...existing,
    ];
    localStorage.setItem(ADMIN_SEED_VERSION, "1");
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }

  // 일반 사용자 계정: 처음 로드 시 더미 알림 seed
  if (role === "user" && (!localStorage.getItem(DEMO_SEED_VERSION) || !localStorage.getItem(key))) {
    localStorage.setItem(DEMO_SEED_VERSION, "1");
    localStorage.setItem(key, JSON.stringify(DEMO_NOTIFICATIONS));
    return DEMO_NOTIFICATIONS;
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as AppNotification[];
  } catch {
    /* 파싱 실패 시 빈 배열 반환 */
  }
  return [];
}

// 알림 목록 저장 + 변경 이벤트 발생 (현재 역할의 키에 저장)
export function saveNotifications(list: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(getCurrentRole()), JSON.stringify(list));
  } catch {
    /* 저장 실패는 무시 */
  }
  window.dispatchEvent(new Event("notifications-changed"));
}

// 읽지 않은 알림 개수 — 환경설정(알림 받기/유형별 수신) 반영
export function getUnreadCount(): number {
  const prefs = loadNotificationPrefs();
  if (!prefs.enabled) return 0;
  return loadNotifications().filter((n) => {
    if (n.read) return false;
    return n.type === "danger" ? prefs.danger : prefs.info;
  }).length;
}
