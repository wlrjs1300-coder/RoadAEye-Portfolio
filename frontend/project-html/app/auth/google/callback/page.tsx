"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModal } from "@/context/ModalContext";

// 구글 콜백 처리 컴포넌트
function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useModal();

  useEffect(() => { void (async () => {
    const processCallback = async () => {
      // 1. URL에서 인증 코드 추출
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const state = searchParams.get("state");

      if (error) {
        console.error("구글 인증 에러:", error);
        await showAlert("구글 인증에 실패했습니다.");
        router.push("/login");
        return;
      }

      if (!code) {
        console.error("구글 인증 코드가 없습니다.");
        router.push("/login");
        return;
      }

      if (!state) {
        // state 누락 = CSRF 검증 불가. 문자열 "null"을 백엔드로 보내지 않고 차단
        console.error("구글 인증 state 값이 없습니다.");
        await showAlert("구글 인증에 실패했습니다. 다시 시도해 주세요.");
        router.push("/login");
        return;
      }

      try {
        // 2. Next.js 프록시를 통해 백엔드에 인증 코드 전송 (CORS 우회)
        const res = await fetch(`/api/proxy/auth/google/callback?code=${code}&state=${state}`, {
          method: "GET",
        });

        if (!res.ok) {
          if (res.status === 403) {
            router.push("/login?suspended=1");
            return;
          }
          throw new Error(`백엔드 응답 에러 (상태코드: ${res.status})`);
        }

        const data = await res.json();

        // 3. 백엔드에서 받은 토큰 저장
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);

          // 토큰으로 사용자 정보 조회 후 저장
          try {
            const API_URL = "/api/proxy";
            const meRes = await fetch(API_URL + "/auth/me", {
              headers: { Authorization: "Bearer " + data.access_token },
            });
            if (meRes.ok) {
              const userData = await meRes.json();
              if (userData.user_no) {
                localStorage.setItem("user", JSON.stringify(userData));
              }
            }
          } catch (_) {}

          console.log("구글 소셜 로그인 성공!");
          window.dispatchEvent(new Event("login-state-changed"));
          router.push("/main");
        } else {
          throw new Error("토큰을 받지 못했습니다.");
        }
      } catch (error: any) {
        console.error("구글 콜백 처리 실패:", error);
        if (error?.message?.includes("403")) {
          router.push("/login?suspended=1");
        } else {
          await showAlert("로그인 처리 중 오류가 발생했습니다.");
          router.push("/login");
        }
      }
    };

    processCallback();
    })(); }, [searchParams, router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <p>구글 로그인을 처리 중입니다. 잠시만 기다려 주세요...</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>페이지를 로딩하고 있습니다...</p>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
