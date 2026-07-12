"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "../resources.module.css";
import { FolderOpen, ArrowLeft, Check, Paperclip, X, FileText } from "lucide-react";
import { handleSessionExpired } from "@/api/client";
import "quill/dist/quill.snow.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface Attachment { file: File; previewUrl: string | null; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesWritePage() {
  usePageTitle("자료 올리기");
  const { showAlert } = useModal();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<any>(null);
  const isInitialized = useRef(false);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);

  useEffect(() => { void (async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { await showAlert("로그인이 필요합니다."); router.push("/login"); }
  })(); }, [router]);

  useEffect(() => { void (async () => {
    if (typeof window !== "undefined" && editorRef.current && !isInitialized.current) {
      const element = editorRef.current;
      isInitialized.current = true;
      import("quill").then((QuillModule) => {
        const Quill = QuillModule.default;
        if (!element) return;
        element.innerHTML = "";
        const quill = new Quill(element, {
          theme: "snow",
          modules: { toolbar: [[{ font: [] }], [{ color: [] }, { background: [] }], [{ align: [] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] },
          placeholder: "자료에 대한 설명을 입력해 주세요.",
        });
        quillInstance.current = quill;
        quill.on("text-change", () => {
          const html = element.querySelector(".ql-editor")?.innerHTML || "";
          setContent(html);
        });
      });
    }
  })(); }, []);

  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useEffect(() => { return () => { attachmentsRef.current.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); }); }; }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const added: Attachment[] = picked.map((file) => ({ file, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }));
    setAttachments((prev) => [...prev, ...added]);
    e.target.value = "";
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
    const quillText = quillInstance.current?.getText()?.trim() ?? "";
    const quillHtml = quillInstance.current?.root?.innerHTML?.trim() ?? content;
    if (!title.trim() || !quillText) { await showAlert("제목과 내용을 모두 입력해주세요."); return; }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const BASE_URL = "/api/proxy";
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", quillHtml);
      attachments.forEach((a) => formData.append("files", a.file));
      const res = await fetch(`${BASE_URL}/board/archives`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        const message = err.detail || "등록 실패";
        if (typeof message === "string" && message.includes("토큰")) { handleSessionExpired(); return; }
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      await showAlert("자료가 등록되었습니다.");
      router.push("/board/resources");
    } catch (err: any) {
      await showAlert(err.message || "등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><FolderOpen size={22} className={styles.titleIcon} /> 자료 올리기</h2>
        <p>이력서, 자소서, 발표자료, 회의록 등 팀원들과 공유할 자료를 업로드하세요.</p>
        <hr className={styles.titleLine} />
      </div>
      <form onSubmit={handleSubmit} className={styles.writeForm}>
        <div className={styles.formGroup}>
          <label htmlFor="title">제목</label>
          <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="자료 제목을 입력해 주세요." required className={styles.input} />
        </div>
        <div className={styles.formGroup}>
          <label>내용</label>
          <div className={styles.editorWrapper}><div ref={editorRef} style={{ minHeight: "200px" }} /></div>
        </div>
        <div className={styles.formGroup}>
          <label>파일 첨부</label>
          <label className={styles.fileSelectBtn}>
            <input type="file" multiple onChange={handleFileChange} className={styles.fileInput} />
            <Paperclip size={16} /> 파일 선택
          </label>
          {attachments.length > 0 && (
            <ul className={styles.fileList}>
              {attachments.map((a, idx) => (
                <li key={idx} className={styles.fileItem}>
                  {a.previewUrl ? <img src={a.previewUrl} alt={a.file.name} className={styles.filePreview} /> : <div className={styles.fileIconBox}><FileText size={26} /></div>}
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{a.file.name}</span>
                    <span className={styles.fileSize}>{formatSize(a.file.size)}</span>
                  </div>
                  <button type="button" className={styles.fileRemoveBtn} onClick={() => handleRemoveFile(idx)} aria-label="삭제"><X size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.buttonGroup}>
          <button type="button" className={styles.cancelBtn} onClick={() => router.back()} disabled={isSubmitting}><ArrowLeft size={16} /> 취소</button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}><Check size={16} /> {isSubmitting ? "업로드 중..." : "등록하기"}</button>
        </div>
      </form>
    </div>
  );
}
