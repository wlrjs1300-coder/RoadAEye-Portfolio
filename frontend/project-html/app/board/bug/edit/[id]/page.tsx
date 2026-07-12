"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "../../bug.module.css";
import { PenSquare, ArrowLeft, Check, Paperclip, X, FileText } from "lucide-react";
import { apiCall } from "@/api/client";
import "quill/dist/quill.snow.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface ExistingAtt { attachment_no: number; original_name: string; file_size: number; }
interface NewAtt { file: File; previewUrl: string | null; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BASE_URL = "/api/proxy";

export default function BugEditPage() {
  usePageTitle("버그 수정");
  const { showAlert, showConfirm } = useModal();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingAtts, setExistingAtts] = useState<ExistingAtt[]>([]);
  const [newAtts, setNewAtts] = useState<NewAtt[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const initialized = useRef(false);
  const contentToLoad = useRef("");

  // 기존 데이터 로드
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    apiCall(`/board/bugs/${id}`).then((res) => {
      const d = res.data;
      setTitle(d.title || "");
      setExistingAtts(d.attachments || []);
      contentToLoad.current = d.content || "";
      if (quillRef.current) {
        quillRef.current.clipboard.dangerouslyPasteHTML(d.content || "");
      }
    }).catch(() => showAlert("게시물을 불러오지 못했습니다."));
  }, [id]);

  // Quill 초기화
  useEffect(() => {
    if (typeof window === "undefined" || !editorRef.current || initialized.current) return;
    initialized.current = true;
    import("quill").then((m) => {
      const Quill = m.default;
      editorRef.current!.innerHTML = "";
      const quill = new Quill(editorRef.current!, {
        theme: "snow",
        modules: { toolbar: [[{ font: [] }], [{ color: [] }, { background: [] }], [{ align: [] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]] },
        placeholder: "내용을 입력해 주세요.",
      });
      quillRef.current = quill;
      if (contentToLoad.current) {
        quill.clipboard.dangerouslyPasteHTML(contentToLoad.current);
      }
    });
  }, []);

  const handleDeleteExisting = async (attNo: number, name: string) => {
    if (!await showConfirm(`"${name}" 파일을 삭제하시겠습니까?`)) return;
    try {
      await apiCall(`/board/bugs/attachments/${attNo}`, { method: "DELETE" });
      setExistingAtts((prev) => prev.filter((a) => a.attachment_no !== attNo));
    } catch (err: any) {
      await showAlert(err.message || "파일 삭제에 실패했습니다.");
    }
  };

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setNewAtts((prev) => [...prev, ...picked.map((f) => ({ file: f, previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }))]);
    e.target.value = "";
  };

  const handleRemoveNew = (idx: number) => {
    setNewAtts((prev) => {
      if (prev[idx]?.previewUrl) URL.revokeObjectURL(prev[idx].previewUrl!);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quillText = quillRef.current?.getText()?.trim() ?? "";
    const quillHtml = quillRef.current?.root?.innerHTML?.trim() ?? "";
    if (!title.trim() || !quillText) { await showAlert("제목과 내용을 모두 입력해주세요."); return; }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", quillHtml);
      newAtts.forEach((a) => formData.append("files", a.file));
      const res = await fetch(`${BASE_URL}/board/bugs/${id}`, {
        method: "PUT",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "수정 실패");
      }
      await showAlert("수정되었습니다.");
      router.push(`/board/bug/${id}`);
    } catch (err: any) {
      await showAlert(err.message || "수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><PenSquare size={22} className={styles.titleIcon} /> 버그 신고 수정</h2>
        <hr className={styles.titleLine} />
      </div>
      <form onSubmit={handleSubmit} className={styles.writeForm}>
        <div className={styles.formGroup}>
          <label>제목</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해 주세요." required className={styles.input} />
        </div>
        <div className={styles.formGroup}>
          <label>내용</label>
          <div className={styles.editorWrapper}><div ref={editorRef} style={{ minHeight: "300px" }} /></div>
        </div>

        {/* 기존 첨부파일 */}
        {existingAtts.length > 0 && (
          <div className={styles.formGroup}>
            <label>기존 첨부파일</label>
            <ul className={styles.fileList}>
              {existingAtts.map((a) => (
                <li key={a.attachment_no} className={styles.fileItem}>
                  <div className={styles.fileIconBox}><FileText size={22} /></div>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{a.original_name}</span>
                    <span className={styles.fileSize}>{formatSize(a.file_size)}</span>
                  </div>
                  <button type="button" className={styles.fileRemoveBtn}
                    onClick={() => handleDeleteExisting(a.attachment_no, a.original_name)}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 새 파일 추가 */}
        <div className={styles.formGroup}>
          <label>파일 추가</label>
          <label className={styles.fileSelectBtn}>
            <input type="file" multiple onChange={handleAddFile} className={styles.fileInput} />
            <Paperclip size={16} /> 파일 선택
          </label>
          {newAtts.length > 0 && (
            <ul className={styles.fileList}>
              {newAtts.map((a, idx) => (
                <li key={idx} className={styles.fileItem}>
                  {a.previewUrl
                    ? <img src={a.previewUrl} alt={a.file.name} className={styles.filePreview} />
                    : <div className={styles.fileIconBox}><FileText size={22} /></div>}
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{a.file.name}</span>
                    <span className={styles.fileSize}>{formatSize(a.file.size)}</span>
                  </div>
                  <button type="button" className={styles.fileRemoveBtn} onClick={() => handleRemoveNew(idx)}>
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
            <Check size={16} /> {isSubmitting ? "저장 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
