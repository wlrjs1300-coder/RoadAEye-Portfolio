"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import styles from "./detail.module.css";
import { ArrowLeft, Lock, Send, Trash2, Paperclip, Download, Pencil, X } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import "quill/dist/quill.snow.css";
import { useModal } from "@/context/ModalContext";

interface Attachment {
  attachment_no: number;
  original_name: string;
  file_size: number;
  created_at: string;
}

interface InquiryDetail {
  inquiry_no: number;
  user_no: number;
  title: string;
  content: string;
  answer: string | null;
  answered_at: string | null;
  status: "PENDING" | "ANSWERED";
  created_at: string;
  is_private?: number | boolean;
  attachments: Attachment[];
}

// 파일 크기 표시 (B / KB / MB)
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 파일명 확장자로 종류 판별
function fileKind(name: string): "image" | "video" | "file" {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv", "ogg"].includes(ext)) return "video";
  return "file";
}

const BASE_URL = "/api/proxy";

export default function QNADetailPage() {
  usePageTitle("Q&A 상세");
  const { showAlert, showConfirm } = useModal();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserNo, setCurrentUserNo] = useState(0);
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const [editAnswerText, setEditAnswerText] = useState("");
  // 첨부파일 미리보기/다운로드용 URL (attachment_no → object URL)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<number, string>>({});

  useEffect(() => { void (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.role === "admin");
      setCurrentUserNo(user.user_no || 0);
    } catch {}
    })(); }, []);

  useEffect(() => { void (async () => {
    const fetchInquiry = async () => {
      if (!id || isNaN(Number(id))) return;
      try {
        const res = await apiCall(`/board/inquiries/${id}`);
        setInquiry(res.data);
      } catch (err: unknown) {
        console.error("문의 조회 실패:", err);
        const apiError = err as Error & { status?: number };
        if (apiError.status === 403) {
          await showAlert(apiError.message || "비공개 문의는 작성자와 관리자만 조회할 수 있습니다.");
          router.push("/board/qna");
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInquiry();
    })(); }, [id, router]);

  // 첨부파일은 인증이 필요한 다운로드 API라, 토큰을 실어 받아온 뒤 미리보기용 URL로 변환
  useEffect(() => { void (async () => {
    if (!inquiry || inquiry.attachments.length === 0) return;

    const token = localStorage.getItem("access_token");
    const urls: Record<number, string> = {};
    let cancelled = false;

    (async () => {
      for (const att of inquiry.attachments) {
        try {
          const res = await fetch(
            `${BASE_URL}/board/inquiries/attachments/${att.attachment_no}/download`,
            { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
          );
          if (!res.ok) continue;
          const blob = await res.blob();
          if (cancelled) return;
          urls[att.attachment_no] = URL.createObjectURL(blob);
        } catch {
          /* 개별 첨부 실패는 건너뜀 */
        }
      }
      if (!cancelled) setAttachmentUrls({ ...urls });
    })();

    return () => {
      cancelled = true;
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
    })(); }, [inquiry]);

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim()) return;

    setIsSubmitting(true);
    try {
      await apiCall(`/board/inquiries/${id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer: answerText }),
      });
      await showAlert("답변이 등록되었습니다!");
      const res = await apiCall(`/board/inquiries/${id}`);
      setInquiry(res.data);
      setAnswerText("");
    } catch (err: any) {
      await showAlert(err.message || "답변 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAnswer = async () => {
    if (!editAnswerText.trim()) return;
    setIsSubmitting(true);
    try {
      await apiCall(`/board/inquiries/${id}/answer`, {
        method: "PUT",
        body: JSON.stringify({ answer: editAnswerText }),
      });
      await showAlert("답변이 수정되었습니다!");
      const res = await apiCall(`/board/inquiries/${id}`);
      setInquiry(res.data);
      setIsEditingAnswer(false);
    } catch (err: any) {
      await showAlert(err.message || "답변 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnswer = async () => {
    if (!await showConfirm("답변을 삭제하시겠습니까? 문의 상태가 '답변 대기중'으로 변경됩니다.")) return;
    try {
      await apiCall(`/board/inquiries/${id}/answer`, { method: "DELETE" });
      await showAlert("답변이 삭제되었습니다.");
      const res = await apiCall(`/board/inquiries/${id}`);
      setInquiry(res.data);
      setIsEditingAnswer(false);
    } catch (err: any) {
      await showAlert(err.message || "답변 삭제에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    if (!await showConfirm("이 문의를 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/inquiries/${id}`, { method: "DELETE" });
      await showAlert("삭제되었습니다.");
      router.push("/board/qna");
    } catch (err: any) {
      await showAlert(err.message || "삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h2>문의를 찾을 수 없습니다</h2>
          <Link href="/board/qna" className={styles.backButton}>
            <ArrowLeft size={18} /> 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = currentUserNo === inquiry.user_no;
  const isPrivateInquiry = inquiry.is_private === true || Number(inquiry.is_private) === 1;
  const statusLabel = inquiry.status === "ANSWERED" ? "답변완료" : "답변 대기중";

  return (
    <div className={styles.container}>
      <Link href="/board/qna" className={styles.backLink}>
        <ArrowLeft size={18} /> 목록으로
      </Link>

      <div className={styles.questionBox}>
        <div className={styles.questionHeader}>
          <div className={styles.titleRow}>
            {isPrivateInquiry && <Lock size={18} className={styles.lockIcon} />}
            <h1 className={styles.title}>{inquiry.title}</h1>
          </div>
          <div className={styles.metaInfo}>
            <span className={styles.date}>{inquiry.created_at?.split("T")[0]}</span>
            <span className={`${styles.status} ${styles[inquiry.status === "ANSWERED" ? "completed" : "pending"]}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div
          className={`${styles.questionContent} ql-editor`}
          style={{ padding: 0, minHeight: "unset" }}
          dangerouslySetInnerHTML={{ __html: inquiry.content }}
        />

        {/* 첨부파일 */}
        {inquiry.attachments && inquiry.attachments.length > 0 && (
          <div className={styles.attachmentSection}>
            <h4 className={styles.attachmentTitle}>
              <Paperclip size={16} /> 첨부파일 {inquiry.attachments.length}개
            </h4>
            <ul className={styles.attachmentList}>
              {inquiry.attachments.map((att) => {
                const url = attachmentUrls[att.attachment_no];
                const kind = fileKind(att.original_name);
                return (
                  <li key={att.attachment_no} className={styles.attachmentItem}>
                    {kind === "image" && url && (
                      <img src={url} alt={att.original_name} className={styles.attachmentPreview} />
                    )}
                    {kind === "video" && url && (
                      <video src={url} controls className={styles.attachmentPreview} />
                    )}
                    <div className={styles.attachmentMeta}>
                      <span className={styles.attachmentName}>{att.original_name}</span>
                      <span className={styles.attachmentSize}>{formatSize(att.file_size)}</span>
                      {url ? (
                        <a href={url} download={att.original_name} className={styles.attachmentDownload}>
                          <Download size={14} /> 다운로드
                        </a>
                      ) : (
                        <span className={styles.attachmentSize}>불러오는 중…</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(isOwner || isAdmin) && (
          <div style={{ textAlign: "right", marginTop: "12px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            {isOwner && !isAdmin && (
              <button onClick={() => router.push(`/board/qna/edit/${id}`)} style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "6px 14px", fontSize: "13px", border: "none",
                color: "#fff", borderRadius: "6px", background: "#e11d48", cursor: "pointer",
              }}>
                <Pencil size={14} /> 수정
              </button>
            )}
            <button onClick={handleDelete} style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "6px 14px", fontSize: "13px", border: "1px solid #e53e3e",
              color: "#e53e3e", borderRadius: "6px", background: "transparent", cursor: "pointer",
            }}>
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        )}
      </div>

      {inquiry.answer ? (
        <div className={styles.answerBox}>
          <div className={styles.answerHeader}>
            <h3>관리자 답변</h3>
            <span className={styles.answerDate}>{inquiry.answered_at?.split("T")[0]}</span>
          </div>
          {isEditingAnswer ? (
            <div>
              <textarea
                className={styles.textarea}
                value={editAnswerText}
                onChange={(e) => setEditAnswerText(e.target.value)}
                rows={5}
                disabled={isSubmitting}
                style={{ marginTop: "12px" }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setIsEditingAnswer(false)}
                  disabled={isSubmitting}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "6px 14px", fontSize: "13px",
                    border: "1px solid var(--border-color)", color: "var(--text)",
                    borderRadius: "6px", background: "transparent", cursor: "pointer",
                  }}
                >
                  <X size={14} /> 취소
                </button>
                <button
                  onClick={handleUpdateAnswer}
                  disabled={isSubmitting || !editAnswerText.trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "6px 14px", fontSize: "13px",
                    border: "none", color: "#fff", borderRadius: "6px",
                    background: "#e11d48", cursor: "pointer",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  <Send size={14} /> {isSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.answerContent} style={{ whiteSpace: "pre-wrap" }}>
                {inquiry.answer.split("\n").map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setEditAnswerText(inquiry.answer || ""); setIsEditingAnswer(true); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "6px 14px", fontSize: "13px",
                      border: "none", color: "#fff", borderRadius: "6px",
                      background: "#e11d48", cursor: "pointer",
                    }}
                  >
                    <Pencil size={14} /> 수정
                  </button>
                  <button
                    onClick={handleDeleteAnswer}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "6px 14px", fontSize: "13px",
                      border: "1px solid #e53e3e", color: "#e53e3e",
                      borderRadius: "6px", background: "transparent", cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={styles.noAnswer}>
          <p>아직 답변이 없습니다. 곧 답변해드리겠습니다.</p>
        </div>
      )}

      {isAdmin && inquiry.status !== "ANSWERED" && (
        <form onSubmit={handleSubmitAnswer} className={styles.answerForm}>
          <h3>답변 작성</h3>
          <textarea
            className={styles.textarea}
            placeholder="답변을 입력하세요..."
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            rows={5}
            disabled={isSubmitting}
          />
          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || !answerText.trim()}
            >
              <Send size={16} /> {isSubmitting ? "전송 중..." : "답변 등록"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
