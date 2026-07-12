// app/profile/email/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../edit/profile.module.css";
import { Save, Mail, CheckCircle } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface EmailSettings {
  receive_notifications: boolean;
  receive_marketing: boolean;
  receive_system_alerts: boolean;
}

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  receive_notifications: true,
  receive_marketing: false,
  receive_system_alerts: true,
};

export default function EmailSettingsPage() {
  usePageTitle("이메일 변경");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // 이메일 설정 불러오기
    const fetchEmailSettings = async () => {
      try {
        const res = await apiCall("/settings/email", {
          method: "GET",
        });
        
        if (res && res.data) {
          setSettings({
            ...DEFAULT_EMAIL_SETTINGS,
            ...res.data,
            receive_notifications: Boolean(res.data.receive_notifications ?? DEFAULT_EMAIL_SETTINGS.receive_notifications),
            receive_marketing: Boolean(res.data.receive_marketing ?? DEFAULT_EMAIL_SETTINGS.receive_marketing),
            receive_system_alerts: Boolean(res.data.receive_system_alerts ?? DEFAULT_EMAIL_SETTINGS.receive_system_alerts),
          });
        }
      } catch (error) {
        console.error("이메일 설정 불러오기 실패:", error);
      }
    };

    fetchEmailSettings();
  }, [router]);

  const handleToggle = (key: keyof EmailSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await apiCall("/settings/email", {
        method: "PUT",
        body: JSON.stringify(settings),
      });

      if (res) {
        setSaved(true);
        setMessage({ type: "success", text: "이메일 설정이 성공적으로 저장되었습니다." });
        setTimeout(() => { setSaved(false); setMessage(null); }, 2500);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "설정 저장에 실패했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>SMS / 이메일 설정</h2>
        <p>어떤 알림을 받을지 선택하세요</p>
      </div>

      {message && (
        <div className={message.type === "success" ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h3>
          <Mail size={20} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
          알림 수신 설정
        </h3>
        <p>필요한 알림만 선택하여 구독해주세요</p>

        <form onSubmit={handleSubmit}>
          {/* 공지사항 */}
          <div className={`${styles.toggleBox} ${styles.alert}`}>
            <div className={styles.toggleBoxContent}>
              <h4 className={styles.toggleBoxTitle}>공지사항 및 업데이트</h4>
              <p className={styles.toggleBoxDesc}>
                새로운 기능과 중요 공지사항을 알려드립니다
              </p>
            </div>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={Boolean(settings.receive_notifications)}
                onChange={() => handleToggle("receive_notifications")}
              />
              <span className={styles.toggleSwitch}>
                <span className={styles.toggleDot} />
              </span>
            </label>
          </div>

          {/* 마케팅 이메일 */}
          <div className={`${styles.toggleBox} ${styles.marketing}`}>
            <div className={styles.toggleBoxContent}>
              <h4 className={styles.toggleBoxTitle}>마케팅 및 홍보</h4>
              <p className={styles.toggleBoxDesc}>
                특별 이벤트, 할인, 신제품 정보를 받아보세요
              </p>
            </div>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={Boolean(settings.receive_marketing)}
                onChange={() => handleToggle("receive_marketing")}
              />
              <span className={styles.toggleSwitch}>
                <span className={styles.toggleDot} />
              </span>
            </label>
          </div>

          {/* 시스템 알림 */}
          <div className={`${styles.toggleBox} ${styles.system}`}>
            <div className={styles.toggleBoxContent}>
              <h4 className={styles.toggleBoxTitle}>시스템 알림 (필수)</h4>
              <p className={styles.toggleBoxDesc}>
                보안 알림 및 계정 관련 중요 알림은 필수입니다
              </p>
            </div>
            <label className={`${styles.toggleLabel} ${styles.toggleLabelLocked}`}>
              <input
                type="checkbox"
                checked={Boolean(settings.receive_system_alerts)}
                onChange={() => handleToggle("receive_system_alerts")}
                disabled
              />
              <span className={styles.toggleSwitch}>
                <span className={styles.toggleDot} />
              </span>
            </label>
          </div>

          <div className={styles.buttonGroup}>
            <Link href="/" className={`${styles.btn} ${styles.cancelBtn}`}>
              취소
            </Link>
            <button
              type="submit"
              className={`${styles.btn} ${styles.submitBtn} ${saved ? styles.submitBtnSuccess : ""}`}
              disabled={isLoading}
            >
              {saved ? <CheckCircle size={18} /> : <Save size={18} />}
              {isLoading ? "저장 중..." : saved ? "저장됨" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
