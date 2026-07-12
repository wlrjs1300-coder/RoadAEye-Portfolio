// app/profile/edit/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./profile.module.css";
import { Save } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function EditProfilePage() {
  usePageTitle("프로필 수정");
  const { showAlert } = useModal();
  const router = useRouter();

  // 편집 가능
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");

  // 표시 전용
  const [loginId, setLoginId] = useState("");

  // 입력 가능
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");

  // 주소
  const [address, setAddress] = useState("");
  const [originalAddress, setOriginalAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [originalAddressDetail, setOriginalAddressDetail] = useState("");

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 이메일 인증
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 카카오 우편번호 스크립트 로드
  useEffect(() => { void (async () => {
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
    })(); }, []);

  const openAddressSearch = async () => {
    const daum = (window as any).daum;
    if (!daum) { await showAlert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요."); return; }
    new daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.roadAddress || data.jibunAddress;
        setAddress(addr);
        setAddressDetail("");
      },
    }).open();
  };

  useEffect(() => { void (async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // localStorage 캐시로 빠르게 채우고, 이후 서버에서 최신값 동기화
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      if (u.name) { setName(u.name); setOriginalName(u.name); }
      if (u.login_id) setLoginId(u.login_id);
      if (u.email) { setEmail(u.email); setOriginalEmail(u.email); }
      if (u.phone) { setPhone(u.phone); setOriginalPhone(u.phone); }
      if (u.address) { setAddress(u.address); setOriginalAddress(u.address); }
      if (u.address_detail) { setAddressDetail(u.address_detail); setOriginalAddressDetail(u.address_detail); }
    } catch {
      /* 무시 */
    }

    (async () => {
      try {
        const res: any = await apiCall("/profile");
        if (res) {
          setName(res.name || "");
          setOriginalName(res.name || "");
          setLoginId(res.login_id || "");
          setEmail(res.email || "");
          setOriginalEmail(res.email || "");
          setPhone(res.phone || "");
          setOriginalPhone(res.phone || "");
          setAddress(res.address || "");
          setOriginalAddress(res.address || "");
          setAddressDetail(res.address_detail || "");
          setOriginalAddressDetail(res.address_detail || "");
        }
      } catch (err) {
        console.error("사용자 정보 불러오기 실패:", err);
      }
    })();
    })(); }, [router]);

  // 이메일이 바뀌면 기존 인증을 무효화
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (v !== originalEmail) {
      setIsEmailVerified(false);
      setIsCodeSent(false);
      setVerificationCode("");
    }
  };

  const sendEmailCode = async () => {
    setMessage(null);
    if (!email) {
      setMessage({ type: "error", text: "이메일을 입력해 주세요." });
      return;
    }
    try {
      await apiCall("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setIsCodeSent(true);
      setMessage({ type: "success", text: "인증 코드를 이메일로 발송했습니다." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "코드 발송에 실패했습니다." });
    }
  };

  const verifyEmailCode = async () => {
    setMessage(null);
    if (!verificationCode) {
      setMessage({ type: "error", text: "인증 코드를 입력해 주세요." });
      return;
    }
    try {
      await apiCall("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email, code: verificationCode }),
      });
      setIsEmailVerified(true);
      setMessage({ type: "success", text: "이메일 인증이 완료되었습니다." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "인증에 실패했습니다." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 변경된 항목 판별
    const wantsNameChange    = name.trim() !== originalName;
    const wantsPhoneChange   = phone !== originalPhone;
    const wantsEmailChange   = email !== originalEmail;
    const wantsAddressChange = address !== originalAddress || addressDetail !== originalAddressDetail;
    const wantsPwChange = !!(currentPassword || newPassword || confirmPassword);

    // 아무것도 바뀌지 않았으면 안내 후 중단
    if (!wantsNameChange && !wantsPhoneChange && !wantsEmailChange && !wantsAddressChange && !wantsPwChange) {
      setMessage({ type: "error", text: "변경된 내용이 없습니다. 변경할 항목을 입력해 주세요." });
      return;
    }

    // 비밀번호 변경 검사
    if (wantsPwChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setMessage({ type: "error", text: "비밀번호를 변경하려면 모든 비밀번호 칸을 입력해 주세요." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage({ type: "error", text: "새 비밀번호가 일치하지 않습니다." });
        return;
      }
    }

    // 이메일 변경 시 인증 필수
    if (wantsEmailChange && !isEmailVerified) {
      setMessage({ type: "error", text: "이메일을 변경하려면 인증을 완료해 주세요." });
      return;
    }

    // 요청 본문 — 실제 변경할 필드만 포함
    const body: Record<string, string> = {};
    if (wantsNameChange)  body.name  = name.trim();
    if (wantsPhoneChange) body.phone = phone;
    if (wantsEmailChange) body.email = email;
    if (wantsAddressChange) {
      body.address = address;
      body.address_detail = addressDetail;
    }
    if (wantsPwChange) {
      body.current_password = currentPassword;
      body.new_password = newPassword;
    }

    setIsLoading(true);
    try {
      const res: any = await apiCall("/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      });

      // localStorage 의 user 정보 동기화 + 헤더 표시 갱신
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        const next = { ...u, name: res?.name ?? name, phone: res?.phone ?? phone, email: res?.email ?? email, address: res?.address ?? address, address_detail: res?.address_detail ?? addressDetail };
        localStorage.setItem("user", JSON.stringify(next));
        window.dispatchEvent(new Event("login-state-changed"));
      } catch {
        /* 무시 */
      }

      // 성공 후 상태 정리
      if (wantsNameChange) setOriginalName(name.trim());
      if (wantsPhoneChange) setOriginalPhone(phone);
      if (wantsAddressChange) {
        setOriginalAddress(address);
        setOriginalAddressDetail(addressDetail);
      }
      if (wantsEmailChange) {
        setOriginalEmail(email);
        setIsEmailVerified(false);
        setIsCodeSent(false);
        setVerificationCode("");
      }
      if (wantsPwChange) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
      setMessage({ type: "success", text: "개인정보가 변경되었습니다." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "변경에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>개인정보 변경</h2>
        <p>계정 정보를 수정하세요</p>
      </div>

      {message && (
        <div className={message.type === "success" ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h3>기본 정보</h3>
        <p>아래 정보를 수정하여 계정을 관리하세요</p>

        <form onSubmit={handleSubmit}>
          {/* 아이디 — 표시만 */}
          <div className={styles.formGroup}>
            <label>아이디</label>
            <div className={styles.readOnlyValue}>{loginId || "—"}</div>
          </div>

          {/* 이름 — 편집 가능 */}
          <div className={styles.formGroup}>
            <label htmlFor="name">이름</label>
            <input
              id="name"
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>

          {/* 비밀번호 변경 */}
          <div className={styles.formGroup}>
            <label>비밀번호 변경 <span style={{ fontWeight: 400, fontSize: 13, color: "var(--text-muted)" }}>(변경하지 않으려면 비워두세요)</span></label>
            <input
              type="password"
              placeholder="현재 비밀번호"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
              autoComplete="current-password"
            />
            <input
              type="password"
              placeholder="새 비밀번호 (8자 이상, 영문·숫자·특수문자 포함)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              style={{ marginTop: 8 }}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              style={{ marginTop: 8 }}
              autoComplete="new-password"
            />
          </div>

          {/* 이메일 — 변경 시 인증 필요 */}
          <div className={styles.formGroup}>
            <label htmlFor="email">이메일</label>
            <div className={styles.addressRow}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="이메일을 입력하세요"
                className={styles.input}
                style={{ flex: 1 }}
              />
              {email !== originalEmail && !isEmailVerified && (
                <button
                  type="button"
                  onClick={sendEmailCode}
                  className={styles.sideBtn}
                >
                  {isCodeSent ? "재발송" : "인증 코드 발송"}
                </button>
              )}
            </div>

            {email !== originalEmail && isCodeSent && !isEmailVerified && (
              <div className={styles.addressRow}>
                <input
                  type="text"
                  placeholder="인증 코드 입력"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className={styles.input}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={verifyEmailCode} className={styles.sideBtn}>
                  확인
                </button>
              </div>
            )}

            {email !== originalEmail && isEmailVerified && (
              <p style={{ color: "#22c55e", fontSize: 13, marginTop: 6 }}>
                ✓ 이메일 인증이 완료되었습니다. 저장 시 적용됩니다.
              </p>
            )}
            {email === originalEmail && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                이메일을 변경하면 인증이 필요합니다.
              </p>
            )}
          </div>

          {/* 휴대폰 번호 */}
          <div className={styles.formGroup}>
            <label htmlFor="phone">휴대폰 번호</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </div>

          {/* 주소 */}
          <div className={styles.formGroup}>
            <label>주소</label>
            <div className={styles.addressRow}>
              <input
                type="text"
                className={styles.input}
                value={address}
                readOnly
                placeholder="주소 찾기 버튼을 클릭하여 검색해 주세요"
                style={{ flex: 1, cursor: "default", background: "var(--bg-sub)" }}
              />
              <button type="button" onClick={openAddressSearch} className={styles.sideBtn}>
                주소 찾기
              </button>
            </div>
            {address && (
              <input
                type="text"
                className={styles.input}
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="상세주소 입력 (동, 호수, 층 등)"
                style={{ marginTop: 6 }}
              />
            )}
          </div>

          <div className={styles.buttonGroup}>
            <Link href="/" className={`${styles.btn} ${styles.cancelBtn}`}>
              취소
            </Link>
            <button
              type="submit"
              className={`${styles.btn} ${styles.submitBtn}`}
              disabled={isLoading}
            >
              <Save size={18} /> {isLoading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
