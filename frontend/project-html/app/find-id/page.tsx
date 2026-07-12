"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Search, ArrowLeft, KeyRound } from "lucide-react";
import styles from "./findId.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function FindIdPage() {
  usePageTitle("아이디 찾기");
  const { showAlert } = useModal();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [maskedId, setMaskedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFindId = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/find-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        await showAlert(data.message || "일치하는 회원 정보가 없습니다. 다시 확인해 주세요.");
        setIsLoading(false);
        return;
      }

      if (data.data && data.data.login_id) {
        setMaskedId(data.data.login_id);
      }
    } catch (error) {
      console.error("아이디 찾기 통신 에러:", error);
      await showAlert("서버 연결에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        
        {/* 상단 헤더 타이틀 영역 */}
        <div className={styles.titleArea}>
          <Search size={24} style={{ color: "var(--red)" }} />
          <h2 className={styles.title}>아이디 찾기</h2>
        </div>
        <p className={styles.subtitle}>가입 시 등록한 이름과 이메일 주소를 입력해 주세요.</p>

        {!maskedId ? (
          /* [상태 1] 입력 폼 화면 */
          <form onSubmit={handleFindId} className={styles.form}>
            
            {/* 이름 입력란 */}
            <div className={styles.inputGroup}>
              <label>이름</label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 이메일 입력란 */}
            <div className={styles.inputGroup}>
              <label>이메일 주소</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input
                  type="email"
                  placeholder="example@roadaye.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 버튼 컨트롤 영역 */}
            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => router.push("/login")} className={styles.backButton}>
                <ArrowLeft size={16} /> 이전
              </button>
              <button type="submit" className={styles.submitButton} disabled={isLoading}>
                {isLoading ? "조회 중..." : "아이디 찾기"}
              </button>
            </div>

          </form>
        ) : (
          /* [상태 2] 아이디 조회 성공 결과 화면 */
          <div className={styles.resultArea}>
            <p className={styles.subtitle} style={{ fontSize: "15px", color: "var(--text)" }}>
              입력하신 정보와 일치하는 아이디를 찾았습니다.
            </p>
            
            <div className={styles.resultBox}>
              <span className={styles.resultId}>{maskedId}</span>
            </div>
            
            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => router.push("/find-password")} className={styles.backButton} style={{ width: "100%" }}>
                <KeyRound size={16} /> 비밀번호 찾기
              </button>
              <button type="button" onClick={() => router.push("/login")} className={styles.submitButton} style={{ width: "100%" }}>
                로그인하기
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}