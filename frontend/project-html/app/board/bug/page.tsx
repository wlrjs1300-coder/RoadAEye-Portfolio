"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./bug.module.css";
import { PenSquare, Bug } from "lucide-react";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface BugPost {
  bug_no: number;
  user_no: number;
  title: string;
  status: "OPEN" | "FIXED";
  created_at: string;
  comment_count: number;
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

export default function BugBoardPage() {
  usePageTitle("버그 게시판");
  const [posts, setPosts] = useState<BugPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setIsLoggedIn(typeof window !== "undefined" && !!localStorage.getItem("access_token"));
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const all: BugPost[] = [];
        let p = 1;
        while (true) {
          const params = new URLSearchParams({ page: String(p), per_page: "100" });
          if (statusFilter !== "ALL") params.set("status", statusFilter);
          const res = await apiCall(`/board/bugs?${params}`);
          const items: BugPost[] = res.data.items || [];
          all.push(...items);
          const total = res.data.total ?? all.length;
          if (items.length === 0 || all.length >= total) break;
          p += 1;
        }
        setPosts(all);
      } catch (err) {
        console.error("버그 게시판 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    setPage(1);
  }, [statusFilter]);

  const displayNo: Record<number, number> = {};
  [...posts].sort((a, b) => a.bug_no - b.bug_no).forEach((p, i) => { displayNo[p.bug_no] = i + 1; });

  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><Bug size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />버그 게시판</h2>
        <p>개선 사항이나 수정 요청을 남겨주시면 팀에서 확인 후 답변드립니다.</p>
      </div>

      {/* 필터 + 페이지 사이즈 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ALL", "OPEN", "FIXED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: statusFilter === s ? (s === "FIXED" ? "#059669" : s === "OPEN" ? "#e11d48" : "#1f2d3d") : "transparent",
                color: statusFilter === s ? "#fff" : "var(--text)",
                borderColor: statusFilter === s ? "transparent" : "var(--border-color)",
              }}
            >
              {s === "ALL" ? "전체" : s === "OPEN" ? "미수정" : "수정완료"}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text)" }}>
          페이지당 글 수
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ padding: "6px 10px", border: "1px solid var(--border-color)", borderRadius: 6, background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}
          >
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
                <th style={{ width: 100 }}>상태</th>
                <th style={{ width: 110 }}>등록일</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                    등록된 게시물이 없습니다.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.bug_no} className={styles.row}>
                    <td>{displayNo[item.bug_no]}</td>
                    <td className={styles.titleCell}>
                      <Link href={`/board/bug/${item.bug_no}`} className={styles.titleLink}>
                        {item.title}
                        {item.comment_count > 0 && (
                          <span style={{ color: "#f59e0b", fontWeight: 800, marginLeft: 5, fontSize: 13 }}>
                            ({item.comment_count})
                          </span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <span className={item.status === "FIXED" ? styles.badgeFixed : styles.badgeOpen}>
                        {item.status === "FIXED" ? "수정완료" : "미수정"}
                      </span>
                    </td>
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
              <Link href="/board/bug/write" className={styles.writeButton}>
                <PenSquare size={18} /> 글쓰기
              </Link>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>글쓰기는 로그인 후 이용 가능합니다.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
