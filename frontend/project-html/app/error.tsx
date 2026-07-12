// app/error.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface GlobalErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  const router = useRouter();

  const errorMessage = error.message || "요청하신 페이지를 처리하는 중 일시적인 서버 오류가 발생했거나, 네트워크 연결이 원활하지 않습니다.";
  const isChunkLoadError =
    error.name === "ChunkLoadError" ||
    errorMessage.includes("Failed to load chunk") ||
    errorMessage.includes("Loading chunk");
  const isNetworkError = errorMessage.includes("네트워크") || errorMessage.includes("fetch");

  useEffect(() => {
    console.error("시스템 전역 에러 가로챔:", error);

    if (!isChunkLoadError) return;
    const key = "roadeye:chunk-reload-once";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }, [error, isChunkLoadError]);

  return (
    <div className="error-container">
      <div className="error-box">
        <div className="error-icon-wrapper">
          <AlertTriangle size={48} className="error-icon-red" />
        </div>
        
        <h2 className="error-title">
          {isChunkLoadError ? "새 화면을 불러오는 중입니다" : "시스템 오류가 발생했습니다"}
        </h2>
        
        <div className="error-details">
          <p className="error-description">
            {isChunkLoadError
              ? "화면 파일이 새 버전으로 교체되어 페이지를 다시 불러와야 합니다. 자동 복구되지 않으면 다시 시도를 눌러주세요."
              : errorMessage}
          </p>

          {/* 에러 ID (디버깅용) */}
          {error.digest && (
            <p className="error-id">
              에러 ID: <code>{error.digest}</code>
            </p>
          )}

          {/* 상태에 따른 추가 정보 */}
          {isChunkLoadError && (
            <p className="error-hint">
              새 빌드 반영 직후 한 번 발생할 수 있는 일시적인 오류입니다.
            </p>
          )}

          {!isChunkLoadError && isNetworkError && (
            <p className="error-hint">
              네트워크 연결을 확인하고 다시 시도해주세요.
            </p>
          )}
        </div>

        <div className="error-btn-group">
          <button onClick={() => isChunkLoadError ? window.location.reload() : reset()} className="error-btn-retry">
            <RotateCcw size={16} /> 다시 시도
          </button>
          <button onClick={() => router.push("/")} className="error-btn-home">
            <Home size={16} /> 메인 화면으로
          </button>
        </div>
      </div>
    </div>
  );
}