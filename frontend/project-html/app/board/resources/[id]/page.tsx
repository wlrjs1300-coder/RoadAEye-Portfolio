"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import styles from "./detail.module.css";
import { ArrowLeft, Paperclip, Download, Trash2, Pencil } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import "quill/dist/quill.snow.css";
import { useModal } from "@/context/ModalContext";

interface Attachment { attachment_no: number; original_name: string; file_size: number; created_at: string; }
interface ArchiveDetail {
  archive_no: number; user_no: number; author_no: number;
  title: string; content: string; view_count: number;
  created_at: string; updated_at: string; attachments: Attachment[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(name: string): "image" | "video" | "file" {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["jpg","jpeg","png","gif","webp","bmp","svg"].includes(ext)) return "image";
  if (["mp4","webm","mov","avi","mkv","ogg"].includes(ext)) return "video";
  return "file";
}

const BASE_URL = "/api/proxy";

export default function ResourceDetailPage() {
  usePageTitle("자료 상세");
  const { showAlert, showConfirm } = useModal();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [post, setPost] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserNo, setCurrentUserNo] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setCurrentUserNo(u.user_no || 0);
      setIsAdmin(u.role === "admin");
    } catch {}
  }, []);

  useEffect(() => {
    if (!id || isNaN(Number(id))) return;
    apiCall(`/board/archives/${id}`)
      .then((res) => setPost(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!post || post.attachments.length === 0) return;
    const token = localStorage.getItem("access_token");
    const urls: Record<number, string> = {};
    let cancelled = false;
    (async () => {
      for (const att of post.attachments) {
        try {
          const res = await fetch(`${BASE_URL}/board/archives/attachments/${att.attachment_no}/download`,
            { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (cancelled) return;
          urls[att.attachment_no] = URL.createObjectURL(blob);
        } catch {}
      }
      if (!cancelled) setAttachmentUrls({ ...urls });
    })();
    return () => { cancelled = true; Object.values(urls).forEach((u) => URL.revokeObjectURL(u)); };
  }, [post]);

  const handleDelete = async () => {
    if (!await showConfirm("이 자료를 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/archives/${id}`, { method: "DELETE" });
      await showAlert("삭제되었습니다.");
      router.push("/board/resources");
    } catch (err: any) {
      await showAlert(err.message || "삭제에 실패했습니다.");
    }
  };

  if (loading) return <div className={styles.container}><div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>불러오는 중...</div></div>;
  if (!post) return <div className={styles.container}><div className={styles.notFound}><h2>자료를 찾을 수 없습니다</h2><Link href="/board/resources" className={styles.backLink}><ArrowLeft size={18} /> 목록으로</Link></div></div>;

  const isOwner = currentUserNo === (post.author_no ?? post.user_no);

  return (
    <div className={styles.container}>
      <Link href="/board/resources" className={styles.backLink}><ArrowLeft size={18} /> 목록으로</Link>

      <div className={styles.postBox}>
        <div className={styles.postHeader}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.metaInfo}>
            <span>등록일 · {post.created_at?.split("T")[0]}</span>
            <span>작성자 · #{post.author_no ?? post.user_no}</span>
            <span>조회수 · {post.view_count}</span>
            {post.attachments?.length > 0 && <span>첨부파일 · {post.attachments.length}개</span>}
          </div>
        </div>

        <div className={`${styles.postContent} ql-editor`}
          style={{ padding: 0, minHeight: "unset" }}
          dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.attachments?.length > 0 && (
          <div className={styles.attachmentSection}>
            <h4 className={styles.attachmentTitle}><Paperclip size={16} /> 첨부파일 {post.attachments.length}개</h4>
            <ul className={styles.attachmentList}>
              {post.attachments.map((att) => {
                const url = attachmentUrls[att.attachment_no];
                const kind = fileKind(att.original_name);
                return (
                  <li key={att.attachment_no} className={styles.attachmentItem}>
                    {kind === "image" && url && <img src={url} alt={att.original_name} className={styles.attachmentPreview} />}
                    {kind === "video" && url && <video src={url} controls className={styles.attachmentPreview} style={{ maxWidth: 200 }} />}
                    <div className={styles.attachmentMeta}>
                      <span className={styles.attachmentName}>{att.original_name}</span>
                      <span className={styles.attachmentSize}>{formatSize(att.file_size)}</span>
                    </div>
                    {url ? (
                      <a href={url} download={att.original_name} className={styles.attachmentDownload}>
                        <Download size={12} /> 다운로드
                      </a>
                    ) : (
                      <span className={styles.attachmentLoading}>불러오는 중…</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(isOwner || isAdmin) && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            {isOwner && (
              <button onClick={() => router.push(`/board/resources/edit/${id}`)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 13, border: "none", color: "#fff", borderRadius: 6, background: "#e11d48", cursor: "pointer" }}>
                <Pencil size={14} /> 수정
              </button>
            )}
            <button onClick={handleDelete}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", fontSize: 13, border: "1px solid #e53e3e", color: "#e53e3e", borderRadius: 6, background: "transparent", cursor: "pointer" }}>
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
