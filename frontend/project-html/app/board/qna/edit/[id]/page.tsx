"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "../../qna.module.css";
import { PenSquare, ArrowLeft, Check } from "lucide-react";
import { apiCall } from "@/api/client";
import "quill/dist/quill.snow.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function QNAEditPage() {
  usePageTitle("Q&A 수정");
  const { showAlert } = useModal();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<any>(null);
  const isInitialized = useRef(false);
  const [content, setContent] = useState("");

  // 기존 문의 데이터 로드 + 권한 확인
  useEffect(() => { void (async () => {
    if (!id || isNaN(Number(id))) return;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await apiCall(`/board/inquiries/${id}`);
      const inquiry = res.data;

      // 본인 글이 아니면 접근 불가
      if (inquiry.user_no !== user.user_no || user.role === "admin") {
        await showAlert("본인이 작성한 문의만 수정할 수 있습니다.");
        router.push(`/board/qna/${id}`);
        return;
      }

      setTitle(inquiry.title);
      setIsPrivate(inquiry.is_private === 1 || inquiry.is_private === true);
      setContent(inquiry.content);
    } catch (err: any) {
      await showAlert(err.message || "문의를 불러오는 데 실패했습니다.");
      router.push("/board/qna");
    } finally {
      setLoading(false);
    }
  })(); }, [id, router]);

  // Quill 초기화 (데이터 로드 후)
  useEffect(() => { void (async () => {
    if (loading || typeof window === "undefined" || !editorRef.current || isInitialized.current) return;
    isInitialized.current = true;
    const element = editorRef.current;

    import("quill").then((QuillModule) => {
      const Quill = QuillModule.default;
      element.innerHTML = "";
      const quill = new Quill(element, {
        theme: "snow",
        modules: {
          toolbar: [
            [{ font: [] }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["clean"],
          ],
        },
        placeholder: "내용을 입력해 주세요.",
      });
      quillInstance.current = quill;

      // 기존 내용 삽입
      if (content) {
        quill.clipboard.dangerouslyPasteHTML(content);
      }

      quill.on("text-change", () => {
        const html = element.querySelector(".ql-editor")?.innerHTML || "";
        setContent(html);
      });
    });
  })(); }, [loading, content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalContent = quillInstance.current?.root?.innerHTML?.trim() || content;
    if (!title.trim() || !finalContent.trim()) {
      await showAlert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCall(`/board/inquiries/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          content: finalContent,
          is_private: isPrivate ? 1 : 0,
        }),
      });
      await showAlert("문의가 수정되었습니다.");
      router.push(`/board/qna/${id}`);
    } catch (err: any) {
      await showAlert(err.message || "수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><PenSquare size={28} className={styles.titleIcon} /> 1:1 문의 수정</h2>
        <p>문의 내용을 수정합니다.</p>
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

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.push(`/board/qna/${id}`)}
            disabled={isSubmitting}
          >
            <ArrowLeft size={16} /> 취소
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            <Check size={16} /> {isSubmitting ? "수정 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </div>
  );
}
