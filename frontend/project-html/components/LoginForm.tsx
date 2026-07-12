"use client";
import { CheckCircle } from "lucide-react";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// ❌ import { signIn } from "next-auth/react"; <-- 제거 (NextAuth를 사용하지 않습니다)
import { apiCall } from "@/api/client";
import { useModal } from "@/context/ModalContext";
import styles from "@/app/login/login.module.css";

// ── 정지 계정 모달 ──────────────────────────────────────────────────────────
function SuspendedModal({ loginId, suspensionReason, onClose }: { loginId: string; suspensionReason?: string | null; onClose: () => void }) {
  const router = useRouter();
  const { showAlert } = useModal();
  const [view, setView] = useState<"alert" | "inquiry">("alert");
  const [form, setForm] = useState({ login_id: loginId, email: "", message: "", code: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  // 이메일 인증 상태
  const [codeSent,    setCodeSent]    = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [verified,    setVerified]    = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  /** 이메일로 인증 코드 발송 */
  const handleSendCode = async () => {
    if (!form.email.trim()) { await showAlert("이메일을 입력해 주세요."); return; }
    setCodeLoading(true);
    try {
      await apiCall("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email: form.email }),
      });
      setCodeSent(true);
      setVerified(false);
    } catch (e: any) {
      await showAlert(e?.message ?? "인증 코드 발송에 실패했습니다.");
    } finally {
      setCodeLoading(false);
    }
  };

  /** 인증 코드 확인 */
  const handleVerifyCode = async () => {
    if (!form.code.trim()) { await showAlert("인증 코드를 입력해 주세요."); return; }
    setVerifyLoading(true);
    try {
      await apiCall("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email: form.email, code: form.code }),
      });
      setVerified(true);
    } catch (e: any) {
      await showAlert(e?.message ?? "인증 코드가 올바르지 않습니다.");
    } finally {
      setVerifyLoading(false);
    }
  };

  /** 문의 전송 (이메일 인증 완료 후) */
  const handleInquiry = async () => {
    if (!form.email.trim() || !form.message.trim()) {
      await showAlert("이메일과 문의사항을 입력해 주세요."); return;
    }
    if (!verified) { await showAlert("이메일 인증을 완료해 주세요."); return; }
    setSending(true);
    try {
      await apiCall("/auth/suspended-inquiry", {
        method: "POST",
        body: JSON.stringify({
          login_id:   form.login_id,
          email:      form.email,
          email_code: form.code,
          message:    form.message,
        }),
      });
      setSent(true);
    } catch (e: any) {
      await showAlert(e?.message ?? "문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg-card, #fff)", borderRadius: 16, padding: "32px 28px",
        width: "min(92vw, 420px)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
      }}>
        {view === "alert" ? (
          <>
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>🚫</div>
            <h3 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              정지된 아이디입니다
            </h3>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: suspensionReason ? 12 : 28 }}>
              해당 계정은 관리자에 의해 사용이 정지되었습니다.<br />
              문의가 필요하시면 아래 버튼을 눌러주세요.
            </p>
            {suspensionReason && (
              <div style={{
                margin: "0 0 20px", padding: "10px 14px", borderRadius: 8,
                background: "rgba(225,29,72,0.07)", border: "1px solid rgba(225,29,72,0.18)",
                fontSize: 13, color: "#64748b", lineHeight: 1.6,
              }}>
                <span style={{ fontWeight: 700, color: "#e11d48", display: "block", marginBottom: 4 }}>정지 사유</span>
                {suspensionReason}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { onClose(); router.push("/login"); }}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "none",
                  background: "#e11d48", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
                }}
              >확인</button>
              <button
                onClick={() => setView("inquiry")}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #e5e7eb",
                  background: "transparent", fontWeight: 700, cursor: "pointer", fontSize: 14,
                }}
              >문의하기</button>
            </div>
          </>
        ) : sent ? (
          <>
            <div style={{ width: "54px", height: "54px", margin: "0 auto 14px", borderRadius: "50%", background: "rgba(225, 29, 72, 0.1)", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle size={28} /></div>
            <h3 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              문의가 접수되었습니다
            </h3>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: 28 }}>
              확인 후 이메일로 답변 드리겠습니다.
            </p>
            <button
              onClick={() => { onClose(); router.push("/login"); }}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
                background: "#e11d48", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
              }}
            >확인</button>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>계정 정지 문의</h3>

            {/* 아이디 (읽기 전용) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>아이디</label>
              <input type="text" value={form.login_id} readOnly
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", boxSizing: "border-box", background: "#f8fafc", fontSize: 14 }} />
            </div>

            {/* 이메일 + 인증 발송 */}
            <div style={{ marginBottom: verified ? 14 : 8 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                이메일
                {verified && <span style={{ marginLeft: 6, fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✅ 인증 완료</span>}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="email" value={form.email} placeholder="example@email.com"
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setCodeSent(false); setVerified(false); }}
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${verified ? "#16a34a" : "#e5e7eb"}`, boxSizing: "border-box", fontSize: 14 }} />
                <button onClick={handleSendCode} disabled={codeLoading || verified}
                  style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: verified ? "#e5e7eb" : "#e11d48", color: verified ? "#999" : "#fff", fontWeight: 700, cursor: (codeLoading || verified) ? "not-allowed" : "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                  {codeLoading ? "발송 중..." : codeSent ? "재발송" : "인증 발송"}
                </button>
              </div>
            </div>

            {/* 인증 코드 입력 (발송 후 표시) */}
            {codeSent && !verified && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>인증 코드</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={form.code} placeholder="이메일로 받은 6자리 코드"
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", boxSizing: "border-box", fontSize: 14, letterSpacing: 2 }} />
                  <button onClick={handleVerifyCode} disabled={verifyLoading}
                    style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, cursor: verifyLoading ? "not-allowed" : "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                    {verifyLoading ? "확인 중..." : "인증 확인"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "5px 0 0" }}>이메일로 발송된 인증 코드를 입력해 주세요.</p>
              </div>
            )}

            {/* 문의사항 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>문의사항</label>
              <textarea rows={4} value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="문의하실 내용을 입력해 주세요."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", boxSizing: "border-box", resize: "vertical", fontSize: 14 }} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setView("alert")}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "transparent", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                뒤로
              </button>
              <button onClick={handleInquiry} disabled={sending || !verified}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: verified ? "#e11d48" : "#e5e7eb", color: verified ? "#fff" : "#999", fontWeight: 700, cursor: (sending || !verified) ? "not-allowed" : "pointer", fontSize: 14, opacity: sending ? 0.7 : 1 }}>
                {sending ? "전송 중..." : "문의 보내기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const { showAlert } = useModal();
  const [isLoading, setIsLoading] = useState(false);
  const [suspendedId, setSuspendedId] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);

  const [loginData, setLoginData] = useState({
    userId: "",
    password: "",
  });

  // 소셜 로그인 정지 계정 리다이렉트 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("suspended") === "1") {
      const loginId = params.get("login_id") || "소셜 계정";
      setSuspendedId(loginId);
    }
  }, []);

  // 뒤로가기(bfcache) 시 로딩 상태 강제 리셋
  useEffect(() => {
    const handlePageshow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsLoading(false);
      }
    };
    window.addEventListener("pageshow", handlePageshow);
    return () => {
      window.removeEventListener("pageshow", handlePageshow);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  // 일반 로그인 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;
    if (!loginData.userId || !loginData.password) {
      await showAlert("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          login_id: loginData.userId,
          password: loginData.password,
        }),
      });

      if (res && res.data) {
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        window.dispatchEvent(new Event("login-state-changed"));
        const userRole = res.data.user?.role;
        router.push(userRole === "admin" ? "/dashboard" : "/main");
      }
    } catch (error: any) {
      console.error(error);
      if (error.status === 403) {
        setSuspendedId(loginData.userId);
        const reason = typeof error.detail === "object" ? (error.detail?.suspension_reason ?? null) : null;
        setSuspensionReason(reason);
      } else {
        await showAlert(error.message || "아이디 또는 비밀번호가 일치하지 않습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🔓 [수정완료] 백엔드 기반(B안) 소셜 로그인 연동 처리
  const handleSocialLogin = async (e: React.MouseEvent, provider: "google" | "kakao" | "naver") => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    try {
      setIsLoading(true);

      // Next.js API 프록시를 통해 요청 — 외부(ngrok) 환경에서도 동작
      const res = await fetch(`/api/proxy/auth/${provider}`);

      if (!res.ok) {
        throw new Error(`백엔드 응답 에러 (상태코드: ${res.status})`);
      }

      const data = await res.json();

      // 3. 백엔드가 리턴해 준 인증 URL(data.url) 주소로 브라우저 창을 통째로 이동시킵니다.
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("백엔드로부터 유효한 리다이렉트 URL을 받지 못했습니다.");
      }

    } catch (error: any) {
      console.error(`${provider} 로그인 링크 요청 실패:`, error);
      await showAlert(`${provider} 로그인을 시작할 수 없습니다. 백엔드 서버를 확인해 주세요.`);
      setIsLoading(false);
    }
  };

  return (
    <>
      {suspendedId && (
        <SuspendedModal
          loginId={suspendedId}
          suspensionReason={suspensionReason}
          onClose={() => { setSuspendedId(null); setSuspensionReason(null); }}
        />
      )}
      <form onSubmit={handleSubmit} method="post" className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="userId">아이디</label>
          <input
            id="userId"
            name="userId"
            type="text"
            placeholder="아이디를 입력하세요"
            value={loginData.userId}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={loginData.password}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>

        <div className={styles.optionsRow}>
          <label className={styles.rememberMe}>
            <input type="checkbox" name="saveId" />
            <span>아이디 저장</span>
          </label>

          <div className={styles.findGroup}>
            <Link href="/find-id">아이디 찾기</Link>
            <span className={styles.dotDivider}>&middot;</span>
            <Link href="/find-password">비밀번호 찾기</Link>
          </div>
        </div>

        <button type="submit" className={styles.loginBtn} disabled={isLoading}>
          {isLoading ? "로그인 중..." : "로그인"}
        </button>
      </form >

      <div className={styles.divider}><span>또는</span></div>

      {/* 소셜 버튼 영역 */}
      <div className={styles.socialIcons}>
        <button
          onClick={(e) => handleSocialLogin(e, "kakao")}
          className={styles.iconBtn}
          type="button"
          disabled={isLoading}
          aria-label="카카오 로그인"
        >
          <img src="/kakao-icon.png" alt="Kakao" />
        </button>

        <button
          onClick={(e) => handleSocialLogin(e, "naver")}
          className={styles.iconBtn}
          type="button"
          disabled={isLoading}
          aria-label="네이버 로그인"
        >
          <img src="/naver-icon.jpg" alt="Naver" />
        </button>

        <button
          onClick={(e) => handleSocialLogin(e, "google")}
          className={styles.iconBtn}
          type="button"
          disabled={isLoading}
          aria-label="구글 로그인"
        >
          <img src="/google-icon.png" alt="Google" />
        </button>
      </div>
    </>
  );
}