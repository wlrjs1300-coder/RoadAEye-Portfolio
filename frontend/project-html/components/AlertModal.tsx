"use client";

import { useEffect } from "react";
import { XCircle, CheckCircle } from "lucide-react";
import styles from "./AlertModal.module.css";

interface AlertModalProps {
  open: boolean;
  message: string;
  variant?: "error" | "success";
  heading?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export default function AlertModal({
  open,
  message,
  variant = "success",
  heading,
  confirmText,
  cancelText = "확인",
  onConfirm,
  onClose,
}: AlertModalProps) {
  const hasTwoButtons = !!onConfirm;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !hasTwoButtons) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, hasTwoButtons]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="alertdialog" aria-modal="true">
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>

        {/* 본문 */}
        <div className={styles.body}>
          <div className={variant === "error" ? styles.iconWrap : styles.iconWrapSuccess}>
            {variant === "error" ? <XCircle size={28} /> : <CheckCircle size={28} />}
          </div>
          {heading && <h3 className={styles.heading}>{heading}</h3>}
          <div className={styles.message}>
            {message.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* 버튼 영역 */}
        {hasTwoButtons ? (
          <div className={styles.footer}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnRed}`}
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => { onConfirm?.(); onClose(); }}
              autoFocus
            >
              {confirmText || "로그인"}
            </button>
          </div>
        ) : (
          <div className={styles.footerSingle}>
            <button
              type="button"
              className={styles.btnSingle}
              onClick={onClose}
              autoFocus
            >
              {cancelText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
