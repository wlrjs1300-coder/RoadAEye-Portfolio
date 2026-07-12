"use client";

import React from "react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm"; // 🧩 조립할 로그인 일꾼 컴포넌트 불러오기
import styles from "./login.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function LoginPage() {
  usePageTitle("로그인");
  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.loginCard}>
          <div className={styles.header}>
            <Link href="/" className="logo">
              ROAD {" "}<span className="red">A</span>{" "} EYE
            </Link>
            <p className={styles.subtitle}>고속도로 안전 관제 시스템 로그인</p>
          </div>

          {/* 🧩 비즈니스 로직과 입력창들이 모여있는 컴포넌트 장착 */}
          <LoginForm />

          <div className={styles.footer}>
            계정이 없으신가요? <Link href="/register">회원가입</Link>
          </div>
        </div>
      </div>
    </>
  );
}