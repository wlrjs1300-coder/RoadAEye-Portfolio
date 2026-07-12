"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModal } from "@/context/ModalContext";

// 네이버 콜백 처리 컴포넌트
function NaverCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useModal();

  useEffect(() => { void (async () => {
    const processCallback = async () => {
      // 1. URL에서 인증 코드 추출
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        console.error("네이버 인증 에러:", error);
        await showAlert("네이버 인증에 실패했습니다.");
        router.push("/login");
        return;
      }

      if (!code) {
        console.error("네이버 인증 코드가 없습니다.");
        router.push("/login");
        return;
      }

      try {
        // 2. 백엔드에 인증 코드 전송 (백엔드가 네이버와 토큰 교환)
        const backendUrl = "/api/proxy";
        const res = await fetch(`${backendUrl}/auth/naver/callback?code=${code}&state=${state}`, {
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
          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
          }
          console.log("네이버 소셜 로그인 성공!");
          window.dispatchEvent(new Event("login-state-changed"));
          router.push("/main");
        } else {
          throw new Error("토큰을 받지 못했습니다.");
        }
      } catch (error: any) {
        console.error("네이버 콜백 처리 실패:", error);
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
      <p>네이버 로그인을 처리 중입니다. 잠시만 기다려 주세요...</p>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>페이지를 로딩하고 있습니다...</p>
      </div>
    }>
      <NaverCallbackContent />
    </Suspense>
  );
}
