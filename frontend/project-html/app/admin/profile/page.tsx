// app/admin/profile/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";
import { User, Mail, Shield, Bell, Settings, MessageSquare } from "lucide-react";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function AdminProfilePage() {
  usePageTitle("관리자 프로필");
  const { showAlert } = useModal();
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState({
    name: "",
    role: "",
    email: "",
    lastLogin: ""
  });

  useEffect(() => {
    const load = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user.role !== "admin") {
          await showAlert("관리자 권한이 필요합니다.");
          router.push("/main");
          return;
        }
        setAdminInfo({
          name: user.name || "",
          role: user.role === "admin" ? "시스템 관리자" : "일반 사용자",
          email: user.email || "",
          lastLogin: new Date().toLocaleString("ko-KR")
        });
      } catch {
        router.push("/login");
      }
    };
    load();
  }, [router]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>관리자 마이페이지</h2>
        <div className={styles.titleLine} /> {/* 디자인 통일성 유지 */}
      </div>

      <div className={styles.grid}>
        {/* 왼쪽: 관리자 기본 정보 카드 */}
        <div className={styles.card}>
          <h3><User size={20} /> 기본 정보</h3>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.label}>이름</span>
              <span className={styles.value}>{adminInfo.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>권한</span>
              <span className={styles.value}><Shield size={14} /> {adminInfo.role}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>이메일</span>
              <span className={styles.value}>{adminInfo.email}</span>
            </div>
          </div>
          <button className={styles.editBtn}>정보 수정</button>
        </div>

        {/* 오른쪽: 시스템 현황 요약 */}
        <div className={styles.card}>
          <h3><MessageSquare size={20} /> 활동 요약</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>미답변 문의</span>
              <span className={styles.statValue}>5</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>오늘 탐지 사고</span>
              <span className={styles.statValue}>12</span>
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 빠른 설정 메뉴 */}
      <div className={styles.quickMenu}>
        <button className={styles.menuItem}><Bell size={18} /> 알림 설정</button>
        <button className={styles.menuItem}><Settings size={18} /> 시스템 설정</button>
        <button className={styles.logoutBtn}>로그아웃</button>
      </div>
    </div>
  );
}