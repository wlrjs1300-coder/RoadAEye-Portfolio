// app/profile/delete/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../edit/profile.module.css";
import { AlertTriangle, Trash2 } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function DeleteAccountPage() {
    usePageTitle("회원 탈퇴");
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [agree, setAgree] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();

        if (confirmText !== "회원탈퇴") {
            setMessage({ type: "error", text: "'회원탈퇴'를 정확히 입력해주세요." });
            return;
        }

        if (!agree) {
            setMessage({ type: "error", text: "약관에 동의해주세요." });
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            await apiCall("/profile", {
                method: "DELETE",
            });

            setMessage({ type: "success", text: "계정이 삭제되었습니다." });

            // 로컬스토리지 정리
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");

            // 2초 후 홈으로 이동
            setTimeout(() => {
                window.location.href = "/";
            }, 2000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "계정 삭제에 실패했습니다." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>회원탈퇴</h2>
                <p>계정을 삭제하시면 모든 데이터가 영구적으로 제거됩니다</p>
            </div>

            {message && (
                <div className={message.type === "success" ? styles.successMessage : styles.errorMessage}>
                    {message.text}
                </div>
            )}

            {/* 경고 박스 */}
            <div className={styles.warningBox}>
                <div className={styles.warningBoxIcon}>
                    <AlertTriangle size={24} color="#dc2626" />
                </div>
                <div>
                    <h4 className={styles.warningBoxTitle}>주의사항</h4>
                    <ul className={styles.warningBoxList}>
                        <li>계정 삭제 후 30일 이내에는 같은 이메일로 재가입할 수 없습니다.</li>
                        <li>모든 저장된 데이터가 영구적으로 삭제되며, 복구할 수 없습니다.</li>
                        <li>구독 중인 서비스는 즉시 종료됩니다.</li>
                    </ul>
                </div>
            </div>

            <div className={styles.section}>
                <h3>계정 삭제 확인</h3>
                <p>계정 삭제를 진행하려면 아래 절차를 따르세요</p>

                <form onSubmit={handleDelete}>
                    <div className={styles.formGroup}>
                        <label>삭제 확인 입력</label>
                        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "8px" }}>
                            아래 입력 칸에 <strong>"회원탈퇴"</strong>라고 정확히 입력하세요
                        </p>
                        <input
                            type="text"
                            className={styles.input}
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="회원탈퇴"
                            data-valid={confirmText === "회원탈퇴"}
                        />
                    </div>

                    <div className={styles.confirmCheckbox}>
                        <input
                            id="agree"
                            type="checkbox"
                            checked={agree}
                            onChange={(e) => setAgree(e.target.checked)}
                        />
                        <label htmlFor="agree">
                            위 내용을 확인하였으며, 계정 삭제에 동의합니다.
                        </label>
                    </div>

                    <div className={styles.buttonGroup}>
                        <Link href="/main" className={`${styles.btn} ${styles.cancelBtn}`}>
                            취소
                        </Link>
                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.dangerBtn}`}
                            disabled={isLoading || !agree || confirmText !== "회원탈퇴"}
                        >
                            <Trash2 size={18} /> {isLoading ? "삭제 중..." : "삭제"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
