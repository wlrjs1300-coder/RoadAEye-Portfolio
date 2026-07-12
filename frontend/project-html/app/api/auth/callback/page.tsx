"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      console.error("토큰이 없습니다.");
      router.push("/login");
      return;
    }

    localStorage.setItem("access_token", token);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    fetch(API_URL + "/auth/me", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => {
        // /auth/me 는 UserResponse 직접 반환 (success 래퍼 없음)
        if (data.user_no) {
          localStorage.setItem("user", JSON.stringify(data));
          window.dispatchEvent(new Event("login-state-changed"));
          router.push(data.role === "admin" ? "/dashboard" : "/main");
        } else {
          router.push("/main");
        }
      })
      .catch(() => {
        router.push("/main");
      });
  }, [searchParams, router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <p>소셜 로그인 인증을 처리 중입니다. 잠시만 기다려 주세요...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>페이지를 로딩하고 있습니다...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
