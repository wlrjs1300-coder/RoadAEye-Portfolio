"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, HelpCircle } from "lucide-react";
import styles from "../faq.module.css";
import { apiCall } from "@/api/client";
import { useModal } from "@/context/ModalContext";

interface FAQEditClientProps {
  faqNo?: string;
}

export default function FAQEditClient({ faqNo = "" }: FAQEditClientProps) {
  const router = useRouter();
  const { showAlert } = useModal();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void (async () => {
    if (!faqNo) return;

    const fetchFaq = async () => {
      try {
        const res = await apiCall("/board/faqs/" + faqNo);
        setQuestion(res.data.question || "");
        setAnswer(res.data.answer || "");
      } catch {
        await showAlert("FAQ 정보를 불러오는데 실패했습니다.");
        router.push("/board/faq");
      } finally {
        setLoading(false);
      }
    };

    fetchFaq();
    })(); }, [faqNo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqNo) {
      await showAlert("수정할 FAQ 번호를 찾을 수 없습니다.");
      return;
    }
    if (!question.trim() || !answer.trim()) {
      await showAlert("질문과 답변을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCall("/board/faqs/" + faqNo, {
        method: "PUT",
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
        }),
      });
      await showAlert("FAQ가 수정되었습니다.");
      router.push("/board/faq");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "수정에 실패했습니다.";
      await showAlert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!faqNo) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2><HelpCircle size={28} /> FAQ 수정</h2>
          <p>수정할 FAQ를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.formLoading}>FAQ 정보를 불러오는 중...</div>;
  }

  return (
    <div className={styles.container}>
      <button className={styles.backButton} type="button" onClick={() => router.back()}>
        <ArrowLeft size={18} /> 목록으로 돌아가기
      </button>

      <section className={styles.editPanel}>
        <div className={styles.editHeader}>
          <div>
            <span className={styles.editEyebrow}>FAQ 관리</span>
            <h2><HelpCircle size={24} /> 답변 수정</h2>
          </div>
          <p><br />질문과 답변을 확인하기 쉬운 문장으로 정리해 주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.writeForm}>
          <div className={styles.formGroup}>
            <label htmlFor="faq-question">질문</label>
            <input
              id="faq-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={styles.input}
              placeholder="질문을 입력하세요"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="faq-answer">답변</label>
            <textarea
              id="faq-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={styles.textarea}
              rows={12}
              placeholder="답변 내용을 입력하세요"
              required
            />
          </div>

          <div className={styles.buttonGroup}>
            <button className={styles.cancelButton} type="button" onClick={() => router.back()} disabled={isSubmitting}>
              취소
            </button>
            <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
              <Check size={16} />
              {isSubmitting ? "수정 중..." : "수정 완료"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
