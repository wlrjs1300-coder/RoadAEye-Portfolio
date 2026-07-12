"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, X, Check, Ban } from "lucide-react";
import styles from "./detections.module.css";
import ConfirmModal from "@/components/ConfirmModal";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

// 감지 기록 — 관리자 전용
// 백엔드 GET /cctv/detections (필터: cctv_no/class_no/status/date_from/date_to, 페이지)
//          PATCH /cctv/detections/{no}/status (UNREAD → CONFIRMED / DISMISSED)
//          GET /cctv/classes?active_only=true (금지 객체 목록 — 필터용)
//
// 참고: AI 서버 데이터가 백엔드 DB(.246)에 보이려면 VIP 정상화 또는 cctvs UPSERT 필요.
// 현재는 사용자가 스트림 관리에서 시작한 카메라의 감지만 보임.

interface DetectionItem {
  detection_no: number;
  cctv_no: number;
  class_no: number;
  confidence: number;
  image_path: string;
  detected_at: string;
  status: "UNREAD" | "CONFIRMED" | "DISMISSED";
  handled_by: number | null;
  handled_at: string | null;
  cctv_name: string | null;
  class_name: string | null;
}

interface DetectionListResp {
  items: DetectionItem[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

interface ForbiddenClass {
  class_no: number;
  class_name: string;
  display_name: string;
  is_active: boolean;
}

const STATUS_OPTIONS = [
  { value: "",          label: "전체" },
  { value: "UNREAD",    label: "미처리" },
  { value: "CONFIRMED", label: "확인" },
  { value: "DISMISSED", label: "반려" },
];

const STATUS_LABEL: Record<string, string> = {
  UNREAD:    "미처리",
  CONFIRMED: "확인",
  DISMISSED: "반려",
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

// 페이지 번호 목록 (1·끝·현재 앞1·뒤2 + "...") — 선택 페이지 이후 2페이지까지 노출
function getPageItems(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, total, current - 1, current, current + 1, current + 2]);
  const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: (number | string)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push("...");
    items.push(p);
  });
  return items;
}

export default function DetectionsPage() {
  usePageTitle("탐지 결과");
  const { showAlert } = useModal();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [classes, setClasses] = useState<ForbiddenClass[]>([]);
  const [items, setItems] = useState<DetectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // 필터
  const [classNo, setClassNo] = useState<number | "">("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 상세 모달 + 상태 변경 확인 모달
  const [detail, setDetail] = useState<DetectionItem | null>(null);
  const [pendingAction, setPendingAction] = useState<{ no: number; status: "CONFIRMED" | "DISMISSED"; name: string } | null>(null);

  // 권한 가드 — 관리자 전용 (이미지에 개인정보 포함 가능)
  useEffect(() => { void (async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role !== "admin") {
        await showAlert("관리자 권한이 필요합니다.");
        router.push("/main");
        return;
      }
      setAuthorized(true);
    } catch {
      router.push("/login");
    }
    })(); }, [router]);

  // 금지 클래스 목록 (필터 드롭다운용)
  useEffect(() => { void (async () => {
    if (!authorized) return;
    apiCall("/cctv/classes?active_only=true")
      .then((res: any) => setClasses(res?.data?.classes || []))
      .catch(() => {});
    })(); }, [authorized]);

  // 감지 기록 fetch — 필터/페이지가 바뀌면 다시 호출
  const fetchDetections = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (classNo !== "") qs.set("class_no", String(classNo));
      if (status)        qs.set("status", status);
      const res: any = await apiCall(`/cctv/detections?${qs}`);
      const d: DetectionListResp = res?.data || { items: [], total: 0, page: 1, pages: 1, per_page: perPage };
      setItems(d.items);
      setTotal(d.total);
      setPages(d.pages || 1);
    } catch (e: any) {
      setError(e?.message || "감지 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [authorized, classNo, status, page, perPage]);

  useEffect(() => { void (async () => { fetchDetections();   })(); }, [fetchDetections]);

  // 상태 변경 (확인 / 반려)
  const requestStatusChange = (item: DetectionItem, newStatus: "CONFIRMED" | "DISMISSED") => {
    setPendingAction({
      no: item.detection_no,
      status: newStatus,
      name: item.class_name || `감지 #${item.detection_no}`,
    });
  };

  const confirmStatusChange = async () => {
    if (!pendingAction) return;
    const { no, status: newStatus } = pendingAction;
    setPendingAction(null);
    try {
      await apiCall(`/cctv/detections/${no}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // 목록·상세 모두 즉시 반영
      setItems(prev => prev.map(it => it.detection_no === no ? { ...it, status: newStatus } : it));
      setDetail(prev => prev && prev.detection_no === no ? { ...prev, status: newStatus } : prev);
    } catch {
      setError("상태 변경에 실패했습니다.");
    }
  };

  if (!authorized) return null;

  const pageItems = getPageItems(page, pages);
  // 같은-origin AI 프록시 경유 — 브라우저가 AI 서버 사설 IP(localhost:8001)로 직접 접근하지 않도록 함
  const imageBase = "/api/ai-proxy";

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2>감지 기록</h2>
        <p>
          AI가 감지한 진입금지 객체의 누적 로그입니다. 각 기록을 검토 후 "확인" 또는 "반려" 처리하세요.
        </p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* 필터 */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <label>금지 객체</label>
          <select
            value={classNo}
            onChange={e => { setClassNo(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}
          >
            <option value="">전체</option>
            {classes.map(c => (
              <option key={c.class_no} value={c.class_no}>{c.display_name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>상태</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>페이지당</label>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}건</option>)}
          </select>
        </div>
        <span className={styles.totalText}>총 <b>{total.toLocaleString()}</b>건</span>
      </div>

      {/* 목록 — 내부 스크롤 영역 */}
      <div className={styles.tableArea}>
        {items.length === 0 ? (
          <div className={styles.emptyBox}>
            {loading ? "조회 중..." : "감지 기록이 없습니다."}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>시각</th>
                <th>CCTV</th>
                <th>금지 객체</th>
                <th>신뢰도</th>
                <th>상태</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.detection_no} className={styles.row} onClick={() => setDetail(it)}>
                  <td>{new Date(it.detected_at).toLocaleString("ko-KR", { hour12: false })}</td>
                  <td className={styles.cellTruncate}>{it.cctv_name || `#${it.cctv_no}`}</td>
                  <td>{it.class_name || `#${it.class_no}`}</td>
                  <td>{(it.confidence * 100).toFixed(1)}%</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status_${it.status}`]}`}>
                      {STATUS_LABEL[it.status] || it.status}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.rowActions}>
                      <button
                        className={`${styles.smallBtn} ${styles.confirmBtn}${it.status === "CONFIRMED" ? ` ${styles.activeBtnConfirm}` : ""}`}
                        onClick={() => requestStatusChange(it, "CONFIRMED")}
                        disabled={it.status === "CONFIRMED"}
                        title={it.status === "CONFIRMED" ? "이미 확인 처리됨" : "진입금지 확인"}
                      >
                        <Check size={14} /> 확인
                      </button>
                      <button
                        className={`${styles.smallBtn} ${styles.dismissBtn}${it.status === "DISMISSED" ? ` ${styles.activeBtnDismiss}` : ""}`}
                        onClick={() => requestStatusChange(it, "DISMISSED")}
                        disabled={it.status === "DISMISSED"}
                        title={it.status === "DISMISSED" ? "이미 반려 처리됨" : "오감지로 반려"}
                      >
                        <Ban size={14} /> 반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {pages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>이전</button>
          {pageItems.map((p, i) =>
            typeof p === "number" ? (
              <button
                key={i}
                className={p === page ? styles.pageActive : ""}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ) : (
              <span key={i} className={styles.pageDots}>{p}</span>
            )
          )}
          <button disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>다음</button>
        </div>
      )}

      {/* 상세 모달 — 이미지 + 메타 + 상태 변경 */}
      {detail && (
        <div className={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <AlertTriangle size={18} className={styles.modalTitleIcon} />
                감지 상세 — {detail.class_name || `#${detail.class_no}`}
              </div>
              <button className={styles.modalClose} onClick={() => setDetail(null)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {detail.image_path ? (
                <img
                  src={`${imageBase}/images/${detail.image_path.replace(/^.*uploads\/detections\//, "")}`}
                  alt="감지 스냅샷"
                  className={styles.modalImage}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className={styles.noImage}>이미지 없음</div>
              )}
              <dl className={styles.metaList}>
                <dt>시각</dt><dd>{new Date(detail.detected_at).toLocaleString("ko-KR", { hour12: false })}</dd>
                <dt>CCTV</dt><dd>{detail.cctv_name || `#${detail.cctv_no}`}</dd>
                <dt>금지 객체</dt><dd>{detail.class_name || `#${detail.class_no}`}</dd>
                <dt>신뢰도</dt><dd>{(detail.confidence * 100).toFixed(1)}%</dd>
                <dt>상태</dt><dd>
                  <span className={`${styles.statusBadge} ${styles[`status_${detail.status}`]}`}>
                    {STATUS_LABEL[detail.status] || detail.status}
                  </span>
                </dd>
                {detail.handled_at && (
                  <>
                    <dt>처리 시각</dt><dd>{new Date(detail.handled_at).toLocaleString("ko-KR", { hour12: false })}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.smallBtn} ${styles.dismissBtn}${detail.status === "DISMISSED" ? ` ${styles.activeBtnDismiss}` : ""}`}
                onClick={() => requestStatusChange(detail, "DISMISSED")}
                disabled={detail.status === "DISMISSED"}
              >
                <Ban size={14} /> 반려
              </button>
              <button
                className={`${styles.smallBtn} ${styles.confirmBtn}${detail.status === "CONFIRMED" ? ` ${styles.activeBtnConfirm}` : ""}`}
                onClick={() => requestStatusChange(detail, "CONFIRMED")}
                disabled={detail.status === "CONFIRMED"}
              >
                <Check size={14} /> 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상태 변경 확인 모달 */}
      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.status === "CONFIRMED" ? "진입금지 확인 처리" : "반려 처리"}
        message={
          pendingAction
            ? pendingAction.status === "CONFIRMED"
              ? `"${pendingAction.name}" 감지를 진입금지로 확인 처리합니다.\n이 작업은 운영 통계에 반영됩니다.`
              : `"${pendingAction.name}" 감지를 오감지로 반려합니다.\n반려된 감지는 통계에서 제외됩니다.`
            : ""
        }
        confirmText={pendingAction?.status === "CONFIRMED" ? "확인 처리" : "반려"}
        cancelText="취소"
        danger={pendingAction?.status === "DISMISSED"}
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
