"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation"; // 🌟 useRouter 임포트 추가
import styles from "./findPassword.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function PasswordResetPage() {
  usePageTitle("비밀번호 찾기");
  const router = useRouter(); // 🌟 라우터 객체 생성
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 진행 단계 제어 상태 (false: 1단계 이메일 인증 전, true: 2단계 비밀번호 입력)
  const [isCodeSent, setIsCodeSent] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🌟 "이전" 버튼을 눌렀을 때 처리할 로직
  const handleBack = () => {
    if (isCodeSent) {
      // 2단계 진행 중일 때 누르면 이전 이메일 입력 단계로 복귀
      setIsCodeSent(false);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess("");
    } else {
      // 1단계(처음 상태)일 때 누르면 로그인 창으로 이동
      router.push("/login");
    }
  };

  // 1단계: 이메일로 인증 코드 요청 (PasswordResetRequest)
  const handleRequestCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });

      if (response.ok) {
        setIsCodeSent(true);
        setSuccess("입력하신 이메일로 인증 코드가 전송되었습니다.");
      } else {
        const errData = await response.json();
        setError(errData.detail || "등록되지 않은 이메일이거나 오류가 발생했습니다.");
      }
    } catch (err) {
      setError("서버 통신 중 오류가 발생했습니다.");
    }
  };

  // 2단계: 인증 코드 및 비밀번호 재설정 확인 (PasswordResetConfirm)
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError("비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.");
      return;
    }

    if (code.length !== 6) {
      setError("인증 코드는 6자리 숫자여야 합니다.");
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          code: code,
          new_password: newPassword,
        }),
      });

      if (response.ok) {
        setSuccess("비밀번호 재설정이 완료되었습니다. 로그인을 진행해 주세요.");
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const errData = await response.json();
        setError(errData.detail || "인증 코드가 틀렸거나 만료되었습니다.");
      }
    } catch (err) {
      setError("서버 통신 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>비밀번호 재설정</h2>
        <p className={styles.subtitle}>이메일 인증을 통해 안전하게 비밀번호를 재설정하세요.</p>

        <form onSubmit={handleResetConfirm} className={styles.form}>
          
          {/* 1단계: 이메일 입력란 */}
          <div className={styles.inputGroup}>
            <label>이메일 *</label>
            <div className={styles.inputWithButton}>
              <input
                type="email"
                placeholder="가입하신 이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isCodeSent}
                required
              />
              <button 
                type="button" 
                onClick={handleRequestCode} 
                className={styles.checkButton}
                disabled={isCodeSent}
              >
                {isCodeSent ? "발송 완료" : "인증요청"}
              </button>
            </div>
          </div>

          {/* 1단계 상태일 때 노출되는 버튼 영역 (아이디 찾기와 동일 구조) */}
          {!isCodeSent && (
            <div className={styles.buttonGroup} style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button type="button" onClick={handleBack} className={styles.backButton} style={{ flex: 1 }}>
                ← 이전
              </button>
              <button type="button" onClick={handleRequestCode} className={styles.submitButton} style={{ flex: 2 }} disabled={!email}>
                인증 코드 받기
              </button>
            </div>
          )}

          {/* 2단계: 인증 코드 및 새 비밀번호 입력란 (코드가 발송된 후에만 노출) */}
          {isCodeSent && (
            <>
              <div className={styles.inputGroup}>
                <label>인증 코드 *</label>
                <input
                  type="text"
                  placeholder="6자리 인증 코드를 입력하세요"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label>새 비밀번호 *</label>
                <input
                  type="password"
                  placeholder="8자 이상, 영문·숫자·특수문자 포함"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label>새 비밀번호 확인 *</label>
                <input
                  type="password"
                  placeholder="새 비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {/* 2단계 상태일 때 노출되는 버튼 영역 */}
              <div className={styles.buttonGroup} style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={handleBack} className={styles.backButton} style={{ flex: 1 }}>
                  ← 재입력
                </button>
                <button type="submit" className={styles.submitButton} style={{ flex: 2 }}>
                  비밀번호 변경 완료
                </button>
              </div>
            </>
          )}

          {error && <p className={styles.errorMessage}>{error}</p>}
          {success && <p className={styles.successMessage}>{success}</p>}
        </form>
      </div>
    </div>
  );
}