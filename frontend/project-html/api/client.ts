// 로그인 토큰 만료 처리: 안내 후 로그인 페이지로 이동 (중복 실행 방지)
let sessionExpiredHandled = false;
export function handleSessionExpired() {
  if (sessionExpiredHandled || typeof window === "undefined") return;
  sessionExpiredHandled = true;
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
  window.location.href = "/login";
}

export async function apiCall(path: any, options: any = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  // 🔥 [핵심 추가] 만약 주소가 /api/auth 처럼 Next.js 내부 API를 가리킨다면 그대로 호출합니다.
  // 그 외 백엔드 호출은 같은-origin Next 프록시(/api/proxy)를 경유시킵니다.
  // → 브라우저가 사설 IP(localhost:8000)로 직접 접근하지 않으므로 외부망에서도 동작.
  const isNextAuth = path.startsWith('/api/');
  const fullUrl = isNextAuth ? path : `/api/proxy${path}`;

  const res = await fetch(fullUrl, {
    headers: {
      "Content-Type": "application/json",
      // NextAuth 요청이 아닐 때만 Flask 토큰을 동봉합니다.
      ...(!isNextAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json();
    const detail = err.detail;
    const message = typeof detail === "string" ? detail : (detail?.message || "요청 실패");
    // 토큰 만료 → 로그인 페이지로 안내 후 이동
    if (typeof message === "string" && message.includes("토큰")) {
      handleSessionExpired();
      return new Promise(() => {}); // 로그인 페이지로 이동하므로 이후 처리 중단
    }
    throw Object.assign(new Error(message), { status: res.status, detail });
  }

  return res.json();
}