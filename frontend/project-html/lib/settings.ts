// 사용자 환경설정 공유 모듈
// - 백엔드 user_settings API 연동 전까지 localStorage에 저장 (임시)
//   → 추후 백엔드 user_settings 읽기/쓰기 API가 생기면 이 모듈만 교체하면 됨

export interface NotificationPrefs {
  enabled: boolean; // 알림 전체 받기
  danger: boolean;  // 위험 감지 알림 (낙하물·역주행·과속 등)
  info: boolean;    // 시스템·정보 알림 (점검·CCTV 상태 등)
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: true, danger: true, info: true };
const KEY = "settings:notifications";

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* 파싱 실패 시 기본값 */
  }
  return DEFAULT_PREFS;
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* 저장 실패는 무시 */
  }
  // 헤더 종 배지 등이 같은 탭에서 즉시 갱신되도록 이벤트 발생
  window.dispatchEvent(new Event("settings-changed"));
}
