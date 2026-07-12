"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Megaphone } from "lucide-react";
import styles from "../../notice.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function NoticeEditPage() {
  usePageTitle("공지사항 수정");
  const { showAlert } = useModal();
  const params = useParams();
  const router = useRouter();
  const noticeId = params.id as string;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
        await showAlert("공지사항 수정은 관리자만 가능합니다.");
        router.push("/board/notice");
      }
    } catch {
      router.push("/login");
    }
    })(); }, [router]);

  useEffect(() => { void (async () => {
    if (!noticeId || isNaN(Number(noticeId))) return;
    const fetchNotice = async () => {
      try {
        const res = await apiCall(`/board/notices/${noticeId}`);
        setTitle(res.data.title || "");
        setContent(res.data.content || "");
        setIsPinned(!!res.data.is_pinned);
      } catch {
        await showAlert("공지사항 정보를 불러오는데 실패했습니다.");
        router.push("/board/notice");
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
    })(); }, [noticeId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      await showAlert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCall(`/board/notices/${noticeId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        }),
      });
      await showAlert("공지사항이 수정되었습니다.");
      router.push(`/board/notice/${noticeId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "공지사항 수정에 실패했습니다.";
      await showAlert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>불러오는 중...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><Megaphone size={28} className={styles.titleIcon} /> 공지사항 수정</h2>
        <p>등록된 공지사항의 제목, 내용, 고정 여부를 수정합니다.</p>
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
            <Check size={16} /> {isSubmitting ? "수정 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
