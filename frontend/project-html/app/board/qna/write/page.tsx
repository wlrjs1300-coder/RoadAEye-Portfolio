"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "../qna.module.css";
import { PenSquare, ArrowLeft, Check, Paperclip, X, FileText } from "lucide-react";
import { handleSessionExpired } from "@/api/client";
import "quill/dist/quill.snow.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface Attachment {
  file: File;
  previewUrl: string | null; // 이미지 파일일 때만 미리보기 URL
}

// 파일 크기 표시 (B / KB / MB)
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function QNAWritePage() {
  usePageTitle("Q&A 작성");
  const { showAlert } = useModal();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<any>(null);
  const isInitialized = useRef(false);
  const [content, setContent] = useState("");

  // 첨부파일
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);

  useEffect(() => { void (async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      await showAlert("로그인이 필요합니다.");
      router.push("/login");
    }
    })(); }, [router]);

  useEffect(() => { void (async () => {
    if (typeof window !== "undefined" && editorRef.current && !isInitialized.current) {
      const element = editorRef.current;
      isInitialized.current = true;

      import("quill").then((QuillModule) => {
        const Quill = QuillModule.default;
        const modules = {
          toolbar: [
            [{ font: [] }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"],
          ],
        };

        if (!element) return;
        element.innerHTML = "";

        const quill = new Quill(element, {
          theme: "snow",
          modules: modules,
          placeholder: "문의하실 내용을 상세히 입력해 주세요. (개인정보가 포함되지 않도록 유의해 주세요)",
        });

        quillInstance.current = quill;

        quill.on("text-change", () => {
          const html = element.querySelector(".ql-editor")?.innerHTML || "";
          setContent(html);
        });
      });
    }
    })(); }, []);

  // 컴포넌트 언마운트 시 생성한 미리보기 URL 정리 (메모리 누수 방지)
  useEffect(() => { void (async () => {
    attachmentsRef.current = attachments;
    })(); }, [attachments]);
  useEffect(() => { void (async () => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
    })(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const added: Attachment[] = picked.map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setAttachments((prev) => [...prev, ...added]);
    e.target.value = ""; // 같은 파일을 다시 선택할 수 있도록 초기화
  };

  const handleRemoveFile = (idx: number) => {
    setAttachments((prev) => {
      const target = prev[idx];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      await showAlert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const BASE_URL = "/api/proxy";

      const plainText = quillInstance.current?.root?.innerHTML?.trim() || content;

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", plainText);
      formData.append("is_private", isPrivate ? "1" : "0");
      // 첨부파일 (백엔드 /board/inquiries 의 files 필드, 여러 개 가능)
      attachments.forEach((a) => formData.append("files", a.file));

      const res = await fetch(`${BASE_URL}/board/inquiries`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        const message = err.detail || "등록 실패";
        // 토큰 만료 → 로그인 페이지로 안내 후 이동
        if (typeof message === "string" && message.includes("토큰")) {
          handleSessionExpired();
          return;
        }
        throw new Error(message);
      }

      await showAlert("문의가 성공적으로 등록되었습니다.");
      router.push("/board/qna");
    } catch (err: any) {
      await showAlert(err.message || "문의 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><PenSquare size={28} className={styles.titleIcon} /> 1:1 문의하기</h2>
        <p>시스템 이용 불편 사항이나 제휴 문의를 남겨주시면 신속히 답변드리겠습니다.</p>
        <div className={styles.titleLine} />
      </div>

      <form onSubmit={handleSubmit} className={styles.writeForm}>
        <div className={styles.formGroup}>
          <label htmlFor="title">제목</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해 주세요."
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label>내용</label>
          <div className={styles.editorWrapper}>
            <div ref={editorRef} style={{ minHeight: "300px" }} />
          </div>
        </div>

        <label className={styles.secretToggleRow}>
          <span className={`${styles.checkbox} ${isPrivate ? styles.checkedSecret : ""}`}>
            {isPrivate && <Check size={16} />}
          </span>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ display: "none" }}
          />
          <span className={styles.checkboxLabel}>
            비공개 문의
            <span className={styles.subLabel}>작성자와 관리자만 열람할 수 있습니다.</span>
          </span>
        </label>

        {/* 본문 아래 별도 파일 첨부 영역 */}
        <div className={styles.formGroup}>
          <label>파일 첨부</label>
          <label className={styles.fileSelectBtn}>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            <Paperclip size={16} /> 파일 선택
          </label>

          {attachments.length > 0 && (
            <ul className={styles.fileList}>
              {attachments.map((a, idx) => (
                <li key={idx} className={styles.fileItem}>
                  {a.previewUrl ? (
                    <img src={a.previewUrl} alt={a.file.name} className={styles.filePreview} />
                  ) : (
                    <div className={styles.fileIconBox}>
                      <FileText size={26} />
                    </div>
                  )}
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{a.file.name}</span>
                    <span className={styles.fileSize}>{formatSize(a.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    onClick={() => handleRemoveFile(idx)}
                    aria-label="첨부 삭제"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
