"use client";

import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import styles from "./ConfirmModal.module.css";

/**
 * 자체 디자인 확인 모달. `window.confirm()` 대체용.
 *
 * 사용:
 *   const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
 *   ...
 *   <ConfirmModal open={!!confirmState} {...confirmState} onCancel={() => setConfirmState(null)} />
 *
 * 닫는 방법: ✕ 버튼 / 취소 버튼 / 배경 클릭 / ESC 키. onConfirm 후에는 호출자가 직접 닫아야 함
 * (비동기 작업 결과를 보고 닫을 시점을 결정할 수 있도록).
 */

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;       // 빨강 강조 (삭제·중지)
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true">
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* 우상단 작은 ✕ — 헤더 바 없이 모달 모서리에 배치 */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onCancel}
          aria-label="닫기"
        >
          <X size={18} />
        </button>

        {/* 본문 — 큰 아이콘 + 제목 + 메시지를 가운데 정렬로 위계 명확하게 */}
        <div className={styles.body}>
          {danger && (
            <div className={styles.iconCircle}>
              <AlertTriangle size={28} />
            </div>
          )}
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.message}>
            {message.split("\n").map((line, i) => (
              <p key={i} className={styles.line}>{line}</p>
            ))}
          </div>
        </div>

        {/* 푸터 — 버튼 가로 균등 분포, 명확한 위계 */}
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.btn} ${styles.cancelBtn}`}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${danger ? styles.dangerBtn : styles.confirmBtn}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
