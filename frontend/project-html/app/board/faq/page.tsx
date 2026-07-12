"use client";

import React, { useState, useEffect } from "react";
import styles from "./faq.module.css";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import Link from "next/link";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface FAQ {
  faq_no: number;
  question: string;
  answer: string;
  sort_order: number;
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

// 페이지 번호 목록 (처음·끝·현재 주변 + "..." 생략) — 공지사항과 동일 방식
function getPageItems(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: (number | string)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push("...");
    items.push(p);
  });
  return items;
}

export default function FAQPage() {
  usePageTitle("자주 묻는 질문");
  const { showAlert, showConfirm } = useModal();
  const [openId, setOpenId] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => { void (async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch { }
    })(); }, []);

  useEffect(() => { void (async () => {
    const fetchFaqs = async () => {
      try {
        const res = await apiCall("/board/faqs");
        setFaqs(res.data.faqs || []);
      } catch (err) {
        console.error("FAQ 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
    })(); }, []);

  const toggleFaq = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  const handleDelete = async (faq_no: number) => {
    if (!await showConfirm("이 FAQ를 삭제하시겠습니까?")) return;
    try {
      await apiCall(`/board/faqs/${faq_no}`, { method: "DELETE" });
      setFaqs(faqs.filter((f) => f.faq_no !== faq_no));
    } catch (err: any) {
      await showAlert(err.message || "삭제에 실패했습니다.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(faqs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = faqs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>FAQ</h2>
        <p>서비스 이용에 대해 궁금하신 점을 확인해 보세요.</p>
      </div>

      {/* 페이지당 질문 수 선택창 */}
      {!loading && faqs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)" }}>
            페이지당 질문 수
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              style={{ padding: "6px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (<option key={n} value={n}>{n}개</option>))}
            </select>
          </label>
        </div>
      )}

      <div className={styles.faqList}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            불러오는 중...
          </div>
        ) : faqs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            등록된 FAQ가 없습니다.
          </div>
        ) : (
          pageItems.map((item) => (
            <div
              key={item.faq_no}
              className={`${styles.faqItem} ${openId === item.faq_no ? styles.active : ""}`}
            >
              <div className={styles.question} onClick={() => toggleFaq(item.faq_no)}>
                <div className={styles.questionLabel}>
                  <HelpCircle size={20} className={styles.icon} />
                  <span>{item.question}</span>
                </div>
                {openId === item.faq_no ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {openId === item.faq_no && (
                <div className={styles.answer}>
                  <p style={{ whiteSpace: "pre-wrap" }}>{item.answer}</p>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      {/* 수정 버튼: 페이지 이동 */}
                      <Link
                        href={"/board/faq/edit?faq_no=" + item.faq_no}
                        style={{
                          padding: "6px 14px", fontSize: "13px",
                          border: "1px solid var(--primary)", color: "#fff", borderRadius: "6px",
                          background: "#e11d48", cursor: "pointer", textDecoration: "none"
                        }}
                      >
                        수정
                      </Link>

                      {/* 삭제 버튼: 기존 코드 */}
                      <button
                        onClick={() => handleDelete(item.faq_no)}
                        style={{
                          padding: "6px 14px", fontSize: "13px",
                          border: "1px solid #e53e3e", color: "#e53e3e", borderRadius: "6px",
                          background: "transparent", cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "32px" }}>
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{ padding: "6px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "transparent", color: "var(--text)", cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}
          >
            이전
          </button>
          {getPageItems(currentPage, totalPages).map((it, idx) =>
            it === "..." ? (
              <span key={`ellipsis-${idx}`} style={{ padding: "6px 4px", color: "var(--text-muted)" }}>…</span>
            ) : (
              <button
                key={it}
                onClick={() => setPage(it as number)}
                style={{
                  padding: "6px 12px",
                  border: currentPage === it ? "1px solid #e11d48" : "1px solid var(--border-color)",
                  borderRadius: "6px",
                  background: currentPage === it ? "#e11d48" : "transparent",
                  color: currentPage === it ? "#fff" : "var(--text)",
                  fontWeight: currentPage === it ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {it}
              </button>
            )
          )}
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{ padding: "6px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "transparent", color: "var(--text)", cursor: currentPage === totalPages ? "default" : "pointer", opacity: currentPage === totalPages ? 0.4 : 1 }}
          >
            다음
          </button>
        </div>
      )}

      <div className={styles.qnaSection}>
        <p className={styles.qnaText}>다른 질문을 남기고 싶다면?</p>
        <Link href="/board/qna" className={styles.qnaButton}>
          1:1 문의하기
        </Link>
      </div>
    </div>
  );
}
