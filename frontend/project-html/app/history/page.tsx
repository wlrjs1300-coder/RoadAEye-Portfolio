"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import styles from "./history.module.css";
import { AppNotification, loadNotifications, saveNotifications } from "@/lib/notifications";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

const PAGE_SIZE = 4;

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

export default function HistoryPage() {
  usePageTitle("탐지 이력");
  const { showAlert, showConfirm } = useModal();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);

  // 알림 데이터는 localStorage 공유 모듈에서 로드 (페이지를 떠났다 와도 상태 유지됨)
  useEffect(() => { void (async () => {
    setNotifications(loadNotifications());
    setReady(true);
    })(); }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = notifications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const markAllRead = () => {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(next);
    saveNotifications(next); // localStorage 저장 + 헤더 배지 갱신
  };

  const deleteAll = async () => {
    if (notifications.length === 0) return;
    if (!await showConfirm("모든 알림을 삭제하시겠습니까?")) return;
    setNotifications([]);
    saveNotifications([]);
    setPage(1);
  };

  const toggleRead = (id: number) => {
    const next = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifications(next);
    saveNotifications(next);
  };

  const deleteOne = async (id: number) => {
    if (!await showConfirm("이 알림을 삭제하시겠습니까?")) return;
    const next = notifications.filter((n) => n.id !== id);
    setNotifications(next);
    saveNotifications(next);
    if (page > Math.max(1, Math.ceil((notifications.length - 1) / PAGE_SIZE))) {
      setPage((p) => Math.max(1, p - 1));
    }
    await showAlert("알림이 삭제되었습니다.");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><Bell size={26} className={styles.headerIcon} /> 알림 이력</h2>
        <p>Road A Eye 시스템의 위험 감지 및 시스템 알림 내역입니다.</p>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.unreadInfo}>
          읽지 않은 알림 <strong>{unreadCount}</strong>개
        </span>
        <div className={styles.toolbarButtons}>
          <button className={styles.toolBtn} onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck size={16} /> 모두 읽음 표시
          </button>
          <button
            className={`${styles.toolBtn} ${styles.dangerBtn}`}
            onClick={deleteAll}
            disabled={notifications.length === 0}
          >
            <Trash2 size={16} /> 모든 알림 삭제
          </button>
        </div>
      </div>

      {!ready ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>알림이 없습니다.</div>
      ) : (
        <ul className={styles.list}>
          {pageItems.map((n) => (
            <li
              key={n.id}
              className={`${styles.item} ${n.read ? styles.read : styles.unread}`}
            >
              <span className={`${styles.dot} ${n.type === "danger" ? styles.dotDanger : styles.dotInfo}`} />
              <div className={styles.itemBody}>
                <div className={styles.itemTitleRow}>
                  <span className={styles.itemTitle}>{n.title}</span>
                  {!n.read && <span className={styles.newBadge}>NEW</span>}
                </div>
                <p className={styles.itemText}>{n.body}</p>
                <div className={styles.itemFooter}>
                  <span className={styles.itemTime}>{n.time}</span>
                  <div className={styles.itemActions}>
                    <button
                      className={n.read ? styles.readBtnRead : styles.readBtn}
                      onClick={() => toggleRead(n.id)}
                    >
                      {n.read ? "안 읽음" : "읽음"}
                    </button>
                    <button
                      className={styles.itemDeleteBtn}
                      onClick={() => deleteOne(n.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ready && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            이전
          </button>
          {getPageItems(currentPage, totalPages).map((it, idx) =>
            it === "..." ? (
              <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
            ) : (
              <button
                key={it}
                className={`${styles.pageBtn} ${currentPage === it ? styles.pageActive : ""}`}
                onClick={() => setPage(it as number)}
              >
                {it}
              </button>
            )
          )}
          <button
            className={styles.pageBtn}
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
