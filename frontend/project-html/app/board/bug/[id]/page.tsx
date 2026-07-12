"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import styles from "./detail.module.css";
import { ArrowLeft, Send, Trash2, Pencil, CheckCircle, RotateCcw, Paperclip, Download } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import "quill/dist/quill.snow.css";
import { useModal } from "@/context/ModalContext";

interface BugComment {
  comment_no: number;
  bug_no: number;
  user_no: number;
  content: string;
  created_at: string;
}

interface Attachment {
  attachment_no: number;
  original_name: string;
  file_size: number;
  created_at: string;
}

interface BugDetail {
  bug_no: number;
  user_no: number;
  title: string;
  content: string;
  status: "OPEN" | "FIXED";
  created_at: string;
  updated_at: string;
  comments: BugComment[];
  attachments: Attachment[];
}

const BASE_URL = "/api/proxy";

function fileKind(name: string): "image" | "video" | "file" {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "image";
  if (["mp4", "webm", "mov"].includes(ext || "")) return "video";
  return "file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BugDetailPage() {
  usePageTitle("버그 게시판 상세");
  const { showAlert, showConfirm } = useModal();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [post, setPost] = useState<BugDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserNo, setCurrentUserNo] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setCurrentUserNo(u.user_no || 0);
      setIsAdmin(u.role === "admin");
    } catch {}
  }, []);

  const fetchPost = async () => {
    if (!id || isNaN(Number(id))) return;
    try {
      const res = await apiCall(`/board/bugs/${id}`);
      setPost(res.data);
    } catch {
      // no auth needed, try unauthenticated
      try {
        const res = await fetch(`${BASE_URL}/board/bugs/${id}`);
        if (res.ok) { const d = await res.json(); setPost(d.data); }
      } catch (e) { console.error(e); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPost(); }, [id]);

  useEffect(() => {
    if (!post?.attachments || post.attachments.length === 0) {
      setAttachmentUrls({});
      return;
    }
    let cancelled = false;
    const objectUrls: string[] = [];
    (async () => {
      const urls: Record<number, string> = {};
      for (const att of post.attachments) {
        try {
          const res = await fetch(`${BASE_URL}/board/bugs/attachments/${att.attachment_no}/download`);
          if (!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          urls[att.attachment_no] = url;
        } catch {
          // 개별 첨부 실패는 건너뜀
        }
      }
      if (!cancelled) setAttachmentUrls(urls);
    })();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [post?.attachments]);


  const handleDelete = async () => {
    if (!await showConfirm("이 게시물을 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/bugs/${id}`, { method: "DELETE" });
      await showAlert("삭제되었습니다.");
      router.push("/board/bug");
    } catch (err: any) {
      await showAlert(err.message || "삭제에 실패했습니다.");
    }
  };

  const handleStatusToggle = async () => {
    if (!post) return;
    const newStatus = post.status === "OPEN" ? "FIXED" : "OPEN";
    const label = newStatus === "FIXED" ? "수정완료" : "미수정";
    if (!await showConfirm(`상태를 '${label}'으로 변경하시겠습니까?`)) return;
    setStatusUpdating(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${BASE_URL}/board/bugs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
      await fetchPost();
    } catch (err: any) {
      await showAlert(err.message || "상태 변경에 실패했습니다.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${BASE_URL}/board/bugs/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) throw new Error("댓글 등록 실패");
      setCommentText("");
      await fetchPost();
    } catch (err: any) {
      await showAlert(err.message || "댓글 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentNo: number) => {
    if (!await showConfirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/bugs/comments/${commentNo}`, { method: "DELETE" });
      await fetchPost();
    } catch (err: any) {
      await showAlert(err.message || "댓글 삭제에 실패했습니다.");
    }
  };

  if (loading) return (
    <div className={styles.container}>
      <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>불러오는 중...</div>
    </div>
  );

  if (!post) return (
    <div className={styles.container}>
      <div className={styles.notFound}>
        <h2>게시물을 찾을 수 없습니다</h2>
        <Link href="/board/bug" className={styles.backLink}><ArrowLeft size={18} /> 목록으로</Link>
      </div>
    </div>
  );

  const isOwner = currentUserNo === post.user_no;

  return (
    <div className={styles.container}>
      <Link href="/board/bug" className={styles.backLink}><ArrowLeft size={18} /> 목록으로</Link>

      <div className={styles.postBox}>
        <div className={styles.postHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{post.title}</h1>
            <span className={post.status === "FIXED" ? styles.badgeFixed : styles.badgeOpen}>
              {post.status === "FIXED" ? "수정완료" : "미수정"}
            </span>
          </div>
          <div className={styles.metaInfo}>
            <span>작성일 · {post.created_at?.split("T")[0]}</span>
            <span>작성자 · #{post.user_no}</span>
            <span>댓글 · {post.comments?.length ?? 0}개</span>
          </div>
        </div>

        <div className={`${styles.postContent} ql-editor`}
          style={{ padding: 0, minHeight: "unset" }}
          dangerouslySetInnerHTML={{ __html: post.content }} />



        {post.attachments && post.attachments.length > 0 && (
          <div className={styles.attachmentSection}>
            <h4 className={styles.attachmentTitle}><Paperclip size={16} /> 첨부파일 {post.attachments.length}개</h4>
            <ul className={styles.attachmentList}>
              {post.attachments.map((att) => {
                const url = attachmentUrls[att.attachment_no];
                const kind = fileKind(att.original_name);
                return (
                  <li key={att.attachment_no} className={styles.attachmentItem}>
                    {kind === "image" && url && <img src={url} alt={att.original_name} className={styles.attachmentPreview} />}
                    {kind === "video" && url && <video src={url} controls className={styles.attachmentPreview} />}
                    {!url && <div className={styles.attachmentIcon}><Paperclip size={20} /></div>}
                    <div className={styles.attachmentMeta}>
                      <span className={styles.attachmentName}>{att.original_name}</span>
                      <span className={styles.attachmentSize}>{formatSize(att.file_size)}</span>
                    </div>
                    {url ? (
                      <a href={url} download={att.original_name} className={styles.attachmentDownload}>
                        <Download size={13} /> 다운로드
                      </a>
                    ) : (
                      <span className={styles.attachmentSize}>불러오는 중…</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(isOwner || isAdmin || isLoggedIn) && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {/* 상태 변경 버튼 (로그인 사용자 누구나) */}
            {isLoggedIn && (
              <button
                onClick={handleStatusToggle}
                disabled={statusUpdating}
                className={styles.statusToggleBtn}
                style={{
                  background: post.status === "OPEN" ? "#059669" : "#6b7280",
                  color: "#fff",
                }}
              >
                {post.status === "OPEN"
                  ? <><CheckCircle size={14} /> 수정완료로 변경</>
                  : <><RotateCcw size={14} /> 미수정으로 변경</>}
              </button>
            )}
            {/* 수정 / 삭제 (글쓴이 or 관리자) */}
            {(isOwner || isAdmin) && (
              <>
                {isOwner && (
                  <button
                    onClick={() => router.push(`/board/bug/edit/${id}`)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 13, border: "none", color: "#fff", borderRadius: 6, background: "#e11d48", cursor: "pointer" }}
                  >
                    <Pencil size={14} /> 수정
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 13, border: "1px solid #e53e3e", color: "#e53e3e", borderRadius: 6, background: "transparent", cursor: "pointer" }}
                >
                  <Trash2 size={14} /> 삭제
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 댓글 섹션 */}
      <div className={styles.commentSection}>
        <h3>댓글 {post.comments?.length ?? 0}개</h3>

        <div className={styles.commentList}>
          {(!post.comments || post.comments.length === 0) ? (
            <div className={styles.noComment}>첫 번째 댓글을 남겨주세요.</div>
          ) : (
            post.comments.map((c) => (
              <div key={c.comment_no} className={styles.commentItem}>
                <div className={styles.commentMeta}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.commentAuthor}>사용자 #{c.user_no}</span>
                    {c.content.trim().startsWith("수정") && (
                      <span className={styles.commentFixed}>수정완료</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{c.created_at?.split("T")[0]}</span>
                    {(currentUserNo === c.user_no || isAdmin) && (
                      <button className={styles.commentDeleteBtn} onClick={() => handleDeleteComment(c.comment_no)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.commentContent}>{c.content}</div>
              </div>
            ))
          )}
        </div>

        {isLoggedIn ? (
          <form onSubmit={handleAddComment} className={styles.commentForm}>
            <textarea
              className={styles.commentInput}
              placeholder="댓글을 입력하세요... (예: 수정했습니다)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
            <button type="submit" className={styles.commentSubmitBtn} disabled={isSubmitting || !commentText.trim()}>
              <Send size={14} /> {isSubmitting ? "등록 중..." : "댓글 등록"}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: 14, background: "var(--bg-sub)", borderRadius: 8 }}>
            댓글을 작성하려면 <Link href="/login" style={{ color: "#e11d48", textDecoration: "underline" }}>로그인</Link>이 필요합니다.
          </div>
        )}
      </div>
    </div>
  );
}
