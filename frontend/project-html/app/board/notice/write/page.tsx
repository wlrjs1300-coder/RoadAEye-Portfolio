"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Megaphone } from "lucide-react";
import styles from "../notice.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function NoticeWritePage() {
  usePageTitle("공지사항 작성");
  const { showAlert } = useModal();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const token = localStorage.getItem("access_token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!token) {
        await showAlert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }
      if (user.role !== "admin") {
        await showAlert("공지사항 작성은 관리자만 가능합니다.");
        router.push("/board/notice");
      }
    } catch {
      router.push("/login");
    }
    })(); }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      await showAlert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCall("/board/notices", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        }),
      });
      await showAlert("공지사항이 등록되었습니다.");
      router.push("/board/notice");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "공지사항 등록에 실패했습니다.";
      await showAlert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><Megaphone size={28} className={styles.titleIcon} /> 공지사항 글쓰기</h2>
        <p>서비스 점검, 업데이트, 운영 안내를 등록합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.writeForm}>
        <div className={styles.formGroup}>
          <label htmlFor="title">제목</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목을 입력해 주세요."
            className={styles.input}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="content">내용</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="공지 내용을 입력해 주세요."
            className={styles.textarea}
            rows={14}
            required
          />
        </div>

        <label className={styles.pinToggleRow}>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
          />
          <span>상단 고정 공지로 등록</span>
        </label>

        <div className={styles.buttonGroup}>
          <button type="button" className={styles.cancelBtn} onClick={() => router.back()} disabled={isSubmitting}>
            <ArrowLeft size={16} /> 취소
          </button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            <Check size={16} /> {isSubmitting ? "등록 중..." : "등록하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
