"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./resources.module.css";
import { PenSquare, FolderOpen, Paperclip } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface Archive {
  archive_no: number;
  title: string;
  view_count: number;
  author_no: number;
  created_at: string;
  attachments: { attachment_no: number }[];
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

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

export default function ResourcesPage() {
  usePageTitle("자료 게시판");
  const [posts, setPosts] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setIsLoggedIn(typeof window !== "undefined" && !!localStorage.getItem("access_token"));
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const all: Archive[] = [];
        let p = 1;
        while (true) {
          const res = await apiCall(`/board/archives?page=${p}&per_page=100`);
          const items: Archive[] = res.data.items || [];
          all.push(...items);
          const total = res.data.total ?? all.length;
          if (items.length === 0 || all.length >= total) break;
          p += 1;
        }
        setPosts(all);
      } catch (err) {
        console.error("자료 게시판 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const displayNo: Record<number, number> = {};
  [...posts].sort((a, b) => a.archive_no - b.archive_no).forEach((p, i) => { displayNo[p.archive_no] = i + 1; });

  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><FolderOpen size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />자료 게시판</h2>
        <p>이력서, 자기소개서, 발표자료, 회의록 등 프로젝트 관련 자료를 공유합니다.</p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text)" }}>
          페이지당 글 수
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ padding: "6px 10px", border: "1px solid var(--border-color)", borderRadius: 6, background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}>
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}개</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>불러오는 중...</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>번호</th>
                <th>제목</th>
                <th style={{ width: 90 }}>첨부파일</th>
                <th style={{ width: 80 }}>조회수</th>
                <th style={{ width: 110 }}>등록일</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                    등록된 자료가 없습니다.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.archive_no} className={styles.row}>
                    <td>{displayNo[item.archive_no]}</td>
                    <td className={styles.titleCell}>
                      <Link href={`/board/resources/${item.archive_no}`} className={styles.titleLink}>
                        {item.title}
                      </Link>
                    </td>
                    <td>
                      {item.attachments?.length > 0 ? (
                        <span className={styles.attachBadge}>
                          <Paperclip size={12} />{item.attachments.length}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>
                      )}
                    </td>
                    <td>{item.view_count}</td>
                    <td>{item.created_at?.split("T")[0]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20 }}>
              <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}
                style={{ padding: "6px 12px", border: "1px solid var(--border-color)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: currentPage === 1 ? "default" : "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}>
                이전
              </button>
              {getPageItems(currentPage, totalPages).map((it, idx) =>
                it === "..." ? (
                  <span key={`e${idx}`} style={{ padding: "6px 4px", color: "var(--text-muted)" }}>…</span>
                ) : (
                  <button key={it} onClick={() => setPage(it as number)}
                    style={{ padding: "6px 12px", border: currentPage === it ? "1px solid #e11d48" : "1px solid var(--border-color)", borderRadius: 6, background: currentPage === it ? "#e11d48" : "transparent", color: currentPage === it ? "#fff" : "var(--text)", fontWeight: currentPage === it ? 700 : 400, cursor: "pointer" }}>
                    {it}
                  </button>
                )
              )}
              <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}
                style={{ padding: "6px 12px", border: "1px solid var(--border-color)", borderRadius: 6, background: "transparent", color: "var(--text)", cursor: currentPage === totalPages ? "default" : "pointer", opacity: currentPage === totalPages ? 0.4 : 1 }}>
                다음
              </button>
            </div>
          )}

          <div className={styles.footer}>
            {isLoggedIn ? (
              <Link href="/board/resources/write" className={styles.writeButton}>
                <PenSquare size={18} /> 자료 올리기
              </Link>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>자료 업로드는 로그인 후 이용 가능합니다.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
