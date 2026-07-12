"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./detail.module.css";
import { ArrowLeft, Clock, User, Eye, Pin, PinOff, Pencil } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface Notice {
  notice_no: number;
  title: string;
  content: string;
  is_pinned: boolean;
  view_count: number;
  author_no: number;
  created_at: string;
}

export default function NoticeDetailPage() {
  usePageTitle("공지사항 상세");
  const { showAlert, showConfirm } = useModal();
  const params = useParams();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinUpdating, setPinUpdating] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch {}
    })(); }, []);

  useEffect(() => { void (async () => {
    if (!params.id || isNaN(Number(params.id))) return;
    const fetchNotice = async () => {
      try {
        const res = await apiCall(`/board/notices/${params.id}`);
        setNotice(res.data);
      } catch (err) {
        console.error("공지사항 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
    })(); }, [params.id]);

  const handlePinToggle = async () => {
    if (!notice || pinUpdating) return;

    const nextPinned = !notice.is_pinned;
    setPinUpdating(true);
    try {
      await apiCall("/board/notices/" + notice.notice_no, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: nextPinned }),
      });
      setNotice({ ...notice, is_pinned: nextPinned });
      await showAlert(nextPinned ? "상단 고정 공지로 설정했습니다." : "상단 고정을 해제했습니다.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "고정 설정에 실패했습니다.";
      await showAlert(message);
    } finally {
      setPinUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!await showConfirm("정말로 이 공지사항을 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/notices/${params.id}`, { method: "DELETE" });
      await showAlert("삭제되었습니다.");
      router.push("/board/notice");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "삭제에 실패했습니다.";
      await showAlert(message);
    }
  };

  if (loading) return <div className={styles.container}>불러오는 중...</div>;
  if (!notice) return <div className={styles.container}>글을 찾을 수 없습니다.</div>;

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => router.push("/board/notice")}>
        <ArrowLeft size={18} /> 목록으로 돌아가기
      </button>

      <div className={styles.article}>
        <header className={styles.articleHeader}>
          <h1 className={styles.title}>{notice.title}</h1>
          <div className={styles.meta}>
            <span className={styles.metaItem}><User size={14} /> 관리자</span>
            <span className={styles.metaItem}><Clock size={14} /> {notice.created_at?.split("T")[0]}</span>
            <span className={styles.metaItem}><Eye size={14} /> {notice.view_count}</span>
          </div>
        </header>

        <section className={styles.content}>
          <p className={styles.text} style={{ whiteSpace: "pre-wrap" }}>{notice.content}</p>
        </section>

        <footer className={styles.articleFooter}>
          <button className={styles.listBtn} onClick={() => router.push("/board/notice")}>
            목록
          </button>

          {isAdmin && (
            <div className={styles.adminActions}>
              <button
                className={[styles.pinBtn, notice.is_pinned ? styles.pinBtnActive : ""].join(" ")}
                onClick={handlePinToggle}
                disabled={pinUpdating}
              >
                {notice.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
                {pinUpdating ? "처리 중..." : notice.is_pinned ? "고정 해제" : "상단 고정"}
              </button>
              <button
                className={styles.editBtn}
                onClick={() => router.push(`/board/notice/edit/${notice.notice_no}`)}
              >
                <Pencil size={16} /> 수정
              </button>
              <button className={styles.deleteBtn} onClick={handleDelete}>
                삭제
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
