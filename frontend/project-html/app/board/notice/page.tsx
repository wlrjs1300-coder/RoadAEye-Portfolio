"use client";

import React, { useState, useEffect } from "react";
import styles from "./notice.module.css";
import Link from "next/link";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface Notice {
  notice_no: number;
  title: string;
  is_pinned: boolean;
  view_count: number;
  author_no: number;
  created_at: string;
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

function getPageItems(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: (number | string)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push("...");
    items.push(p);
  });
  return items;
}

export default function NoticePage() {
  usePageTitle("공지사항");
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.role === "admin");
    } catch {}
  }, []);

  useEffect(() => {
    const fetchAllNotices = async () => {
      try {
        setLoading(true);
        const all: Notice[] = [];
        let p = 1;
        while (true) {
          const res = await apiCall(`/board/notices?page=${p}&per_page=100`);
          const items: Notice[] = res.data.items || [];
          all.push(...items);
          const total = res.data.total ?? all.length;
          if (items.length === 0 || all.length >= total) break;
          p += 1;
        }
        setNotices(all);
      } catch (err) {
        console.error("공지사항 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllNotices();
  }, []);


  const pinnedNotices = notices.filter((n) => n.is_pinned);
  const regularNotices = notices.filter((n) => !n.is_pinned);

  const displayNumbers: Record<number, number> = {};
  regularNotices.forEach((n, i) => {
    displayNumbers[n.notice_no] = i + 1;
  });

  const totalPages = Math.max(1, Math.ceil(regularNotices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRegulars = regularNotices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageItems = [...pinnedNotices, ...pageRegulars];

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>공지사항</h2>
        <p>주요 소식과 점검 안내를 확인하세요.</p>
      </div>

      {!loading && notices.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text)" }}>
            페이지당 글 수
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "var(--bg)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <div className={styles.noticeList}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              불러오는 중...
            </div>
          ) : notices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              등록된 공지사항이 없습니다.
            </div>
          ) : (
            pageItems.map((notice) => (
              <div
                key={notice.notice_no}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Link
                  href={`/board/notice/${notice.notice_no}`}
                  className={`${styles.noticeCard} ${notice.is_pinned ? styles.priority : ""}`}
                  style={{ flex: 1 }}
                >
                  <div className={styles.cardBadge}>
                    {notice.is_pinned ? "공지" : displayNumbers[notice.notice_no]}
                  </div>
                  <div className={styles.cardContent}>
                    <span className={styles.cardTitle}>
                      {notice.title}
                    </span>
                    <div className={styles.cardMeta}>
                      <span>관리자</span>
                      <span className={styles.divider}>|</span>
                      <span>{notice.created_at?.split("T")[0]}</span>
                      <span className={styles.divider}>|</span>
                      <span>조회수 {notice.view_count}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "20px" }}>
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              background: "transparent",
              color: "var(--text)",
              cursor: currentPage === 1 ? "default" : "pointer",
              opacity: currentPage === 1 ? 0.4 : 1,
            }}
          >
            이전
          </button>

          {getPageItems(currentPage, totalPages).map((item, idx) =>
            item === "..." ? (
              <span key={`ellipsis-${idx}`} style={{ padding: "6px 4px", color: "var(--text-muted)" }}>
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item as number)}
                style={{
                  padding: "6px 12px",
                  border: currentPage === item ? "1px solid #e11d48" : "1px solid var(--border-color)",
                  borderRadius: "6px",
                  background: currentPage === item ? "#e11d48" : "transparent",
                  color: currentPage === item ? "#fff" : "var(--text)",
                  fontWeight: currentPage === item ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {item}
              </button>
            )
          )}

          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              background: "transparent",
              color: "var(--text)",
              cursor: currentPage === totalPages ? "default" : "pointer",
              opacity: currentPage === totalPages ? 0.4 : 1,
            }}
          >
            다음
          </button>
        </div>
      )}

      {isAdmin && (
        <div className={styles.actions}>
          <Link href="/board/notice/write" className={styles.writeBtn}>글쓰기</Link>
        </div>
      )}
    </div>
  );
}
