"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function MainPage() {
  usePageTitle("");
  const { showAlert } = useModal();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  // 양방향 섹션 스냅: 히어로 ↔ 프로세스
  useEffect(() => {
    let locked = false;

    const onWheel = (e: WheelEvent) => {
      if (locked) { e.preventDefault(); return; }

      const processTop = document.getElementById("process")?.offsetTop ?? 0;
      const atHero = window.scrollY < 80;
      const atProcess = window.scrollY >= processTop - 80;

      if (e.deltaY > 0 && atHero) {
        // 히어로에서 아래로 → 프로세스로
        e.preventDefault();
        locked = true;
        document.getElementById("process")?.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => { locked = false; }, 1000);
      } else if (e.deltaY < 0 && atProcess) {
        // 프로세스에서 위로 → 히어로로
        e.preventDefault();
        locked = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => { locked = false; }, 1000);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // 모니터링 시작: 비로그인 → 로그인, 일반 사용자 → 접근 거부, 관리자 → 관제 대시보드
  const handleStartMonitoring = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role !== "admin") {
        await showAlert(
          "로그인 페이지로 이동하여\n관리자 계정으로 로그인해 주세요.",
          {
            variant: "error",
            heading: "관리자 권한이 필요합니다.",
            confirmText: "로그인",
            cancelText: "취소",
            onConfirm: () => router.push("/login"),
          }
        );
        return;
      }
      router.push("/dashboard");
    } catch {
      router.push("/login");
    }
  };

  return (
    <main className="main-container">
      {/* 1. Hero 섹션 */}
      <section className="hero">
        <div className="hero-content">
          <h1>
            ROAD <br />
            <span className="red">A</span> EYE
          </h1>
          <p className="tag">YOLOv11 AI · REAL-TIME</p>
          <p className="desc">
            CCTV와 AI를 결합한 고속도로 안전 관제 플랫폼.<br />
            위험 객체를 실시간으로 탐지하고 즉각 대응합니다.
          </p>
        </div>
      </section>

      {/* 2. 프로세스 섹션 */}
      <section id="process" className="process-section">
        <div className="section-header">
          <h2>AI 실시간 안전 관제 프로세스</h2>
          <p>ROAD A EYE는 24시간 멈추지 않고 고속도로의 안전을 지킵니다.</p>
        </div>

        <div className="process-grid">
          <div className="process-item">
            <div className="icon-box">📹</div>
            <h3>CCTV 영상 수집</h3>
            <p>전국 고속도로의 실시간 스트리밍 데이터를 수집합니다.</p>
          </div>
          <div className="process-item">
            <div className="icon-box">🤖</div>
            <h3>YOLOv11 AI 탐지</h3>
            <p>객체 인식 AI가 낙하물, 역주행, 사고를 즉각 탐지합니다.</p>
          </div>
          <div className="process-item">
            <div className="icon-box">💾</div>
            <h3>탐지 기록 저장</h3>
            <p>모든 위험 상황은 고해상도 스냅샷과 함께 DB에 기록됩니다.</p>
          </div>
          <div className="process-item">
            <div className="icon-box">🚨</div>
            <h3>신고 및 알림</h3>
            <p>탐지 즉시 관제 센터와 유관 기관에 긴급 알림을 전송합니다.</p>
          </div>
          <div className="process-item">
            <div className="icon-box">🛠️</div>
            <h3>처리 상태 관리</h3>
            <p>현장 출동 및 조치 완료까지 전체 프로세스를 관리합니다.</p>
          </div>
          <div className="process-item">
            <div className="icon-box">📊</div>
            <h3>통계 및 분석</h3>
            <p>데이터 기반 사고 다발 지역 분석 및 예방 대책을 제시합니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
