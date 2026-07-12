"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./qna.module.css";
import { Lock, PenSquare } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface Inquiry {
  inquiry_no: number;
  user_no: number;
  title: string;
  status: "PENDING" | "ANSWERED";
  created_at: string;
  is_private?: number | boolean;
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

export default function QNAPage() {
  usePageTitle("Q&A");
  const [qnaList, setQnaList] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("access_token"));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(u.role === "admin");
    } catch {}
  }, []);

  useEffect(() => {
    const fetchInquiries = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const endpoint = user.role === "admin" ? "/board/inquiries" : "/board/inquiries/my";
        // 전체 문의를 한 번에 받아옴 (백엔드 per_page 상한 100) — 페이징은 화면단에서 처리
        const all: Inquiry[] = [];
        let p = 1;
        while (true) {
          const res = await apiCall(`${endpoint}?page=${p}&per_page=100`);
          const items: Inquiry[] = res.data.items || [];
          all.push(...items);
          const total = res.data.total ?? all.length;
          if (items.length === 0 || all.length >= total) break;
          p += 1;
        }
        setQnaList(all);
      } catch (err) {
        console.error("문의 목록 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInquiries();
  }, []);

  const statusLabel = (s: string) => (s === "ANSWERED" ? "답변완료" : "답변 대기중");
  const statusClass = (s: string) => (s === "ANSWERED" ? styles.completed : styles.pending);
  const isPrivateInquiry = (item: Inquiry) => item.is_private === true || Number(item.is_private) === 1;

  // DB 글번호(inquiry_no) 대신, 작성 순서대로 1번부터 표시용 번호를 매김 (전체 기준)
  const displayNo: Record<number, number> = {};
  [...qnaList]
    .sort((a, b) => a.inquiry_no - b.inquiry_no)
    .forEach((it, i) => { displayNo[it.inquiry_no] = i + 1; });

  const totalPages = Math.max(1, Math.ceil(qnaList.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = qnaList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>1:1 문의</h2>
        <p>주요 문의 사항과 답변을 확인하세요.</p>
      </div>

      {!isLoggedIn ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <p>로그인 후 문의 내역을 확인할 수 있습니다.</p>
          <Link href="/login" style={{ color: "var(--accent)", textDecoration: "underline", marginTop: "12px", display: "inline-block" }}>
            로그인하기
          </Link>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
          불러오는 중...
        </div>
      ) : (
        <>
          {/* 페이지당 글 수 선택창 */}
          {qnaList.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)" }}>
                페이지당 글 수
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

          <table className={styles.table}>
            <thead>
              <tr>
                <th>번호</th>
                <th>제목</th>
                <th>등록일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {qnaList.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                    등록된 문의가 없습니다.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.inquiry_no} className={styles.row}>
                    <td>{displayNo[item.inquiry_no]}</td>
                    <td className={styles.titleCell}>
                      <Link href={`/board/qna/${item.inquiry_no}`} className={styles.titleLink}>
                        {isPrivateInquiry(item) && <Lock size={16} className={styles.lockIcon} />}
                        <span>{item.title}</span>
                      </Link>
                    </td>
                    <td>{item.created_at?.split("T")[0]}</td>
                    <td><span className={statusClass(item.status)}>{statusLabel(item.status)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "20px" }}>
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

          <div className={styles.footer}>
            {isAdmin ? (
              // 관리자일 경우: 비활성화된 버튼 스타일
              <button className={styles.writeButton} disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                <PenSquare size={18} /> 글쓰기
              </button>
            ) : (
              // 일반 사용자일 경우: 기존처럼 작동
              <Link href="/board/qna/write" className={styles.writeButton}>
                <PenSquare size={18} /> 글쓰기
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
