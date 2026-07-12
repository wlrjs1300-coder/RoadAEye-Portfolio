"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, Shield, ShieldCheck, Trash2, Ban, CheckCircle2, ScrollText, Users, AlertTriangle, X, ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare, History } from "lucide-react";
import styles from "./manage.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface UserRecord {
  user_no: number;
  login_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface LogRecord {
  log_no: number;
  login_id: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

interface InquiryRecord {
  inquiry_no: number;
  title: string;
  content: string;
  status: string;
  created_at: string;
  login_id?: string;
  email?: string;
}

interface ModalState {
  open: boolean;
  title: string;
  message: string;
  variant: "default" | "danger" | "warning";
  onConfirm: () => void;
}

interface SuspendReasonModal {
  open: boolean;
  user: UserRecord | null;
}

interface SuspendCompleteModal {
  open: boolean;
  loginId: string;
  reason: string;
}

type Tab = "users" | "logs" | "inquiries";

const ACTION_LABELS: Record<string, string> = {
  LOGIN:               "로그인",
  USER_DELETE:         "계정 삭제",
  USER_ROLE_CHANGE:    "역할 변경",
  USER_STATUS_CHANGE:  "상태 변경",
  SYSTEM_CONFIG_UPDATE:"설정 변경",
};

function fmtDate(v: string) {
  return v ? v.replace("T", " ").slice(0, 16) : "—";
}

// 대상(target) 내부 식별자 타입 → 한글 라벨
const TARGET_TYPE_LABELS: Record<string, string> = {
  user:      "회원",
  detection: "감지",
  cctv:      "CCTV",
  class:     "분류",
  inquiry:   "문의",
};

// 대상(target) — 내부 식별자(user:42, detection:60)를 읽기 쉬운 형태로
function fmtTarget(target: string | null): string {
  if (!target) return "—";
  const m = target.match(/^([a-z_]+):(\d+)$/i);
  if (m) {
    const label = TARGET_TYPE_LABELS[m[1].toLowerCase()] ?? m[1];
    return `${label} #${m[2]}`;
  }
  return target;
}

// 설정 dict 키 → 한글 라벨
const DETAIL_KEY_LABELS: Record<string, string> = {
  alert_enabled:     "알림",
  forbidden_classes: "금지 객체",
  confidence_min:    "최소 신뢰도",
  confidence:        "신뢰도",
};

// 설정 dict 값 포맷팅 (키별)
function fmtDetailValue(key: string, raw: string): string {
  const v = raw.trim().replace(/^['"]|['"]$/g, "");
  if (key === "alert_enabled") return /true/i.test(v) ? "켜짐" : "꺼짐";
  if (key === "forbidden_classes") {
    const ids = v.match(/-?\d+/g);
    return `${ids ? ids.length : 0}개`;
  }
  if (key === "confidence_min" || key === "confidence") {
    const n = parseFloat(v);
    return isNaN(n) ? v : `${Math.round(n * 100)}%`;
  }
  return v;
}

// 상세(detail) — 백엔드 raw 문자열을 한글로. 모르는 형식은 원본 그대로
function fmtDetail(detail: string | null): string {
  if (!detail) return "—";
  const d = detail.trim();

  // 알림 설정 (파이썬 dict repr: {'alert_enabled': True})
  const alert = d.match(/alert_enabled['"]?\s*:\s*(True|False)/i);
  if (alert) return `알림 설정: ${alert[1].toLowerCase() === "true" ? "켜짐" : "꺼짐"}`;

  // 계정 상태 (is_active=False)
  const active = d.match(/is_active\s*=\s*(True|False)/i);
  if (active) return `계정 ${active[1].toLowerCase() === "true" ? "활성" : "정지"}`;

  // 역할 변경 (user → admin)
  const role = d.match(/^(user|admin)\s*(?:→|->)\s*(user|admin)$/i);
  if (role) {
    const ko = (r: string) => (r.toLowerCase() === "admin" ? "관리자" : "사용자");
    return `${ko(role[1])} → ${ko(role[2])}`;
  }

  // 탐지 설정 dict ({forbidden_classes: [1,2,4,6], confidence_min: 0.80})
  if (d.startsWith("{") && d.endsWith("}")) {
    const pairs: string[] = [];
    const re = /['"]?([a-z_]+)['"]?\s*:\s*(\[[^\]]*\]|[^,}]+)/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(d)) !== null) {
      const key   = mm[1].toLowerCase();
      const label = DETAIL_KEY_LABELS[key] ?? key;
      pairs.push(`${label} ${fmtDetailValue(key, mm[2])}`);
    }
    if (pairs.length > 0) return pairs.join(" · ");
  }

  return detail;
}

const MODAL_CLOSED: ModalState = { open: false, title: "", message: "", variant: "default", onConfirm: () => {} };

// 정지 문의 더미데이터 — 백엔드 엔드포인트가 비어 있을 때 표시
const DUMMY_INQUIRIES: InquiryRecord[] = [
  { inquiry_no: 9001, title: "[계정 정지 문의] 로그인이 차단되었습니다", content: "안녕하세요. 며칠 전부터 로그인 시 '정지된 계정'이라는 메시지가 뜹니다. 부정 사용한 적이 없는데 정지 사유를 알 수 있을까요? 빠른 확인 부탁드립니다.", status: "접수", created_at: "2026-05-28T09:14:00", login_id: "kim_yh", email: "kim_yh@example.com" },
  { inquiry_no: 9002, title: "[계정 정지 문의] 정지 해제 요청드립니다", content: "관리자님 안녕하세요. 계정이 정지되어 관제 화면 접근이 안 됩니다. 업무상 급하게 사용해야 하는데 해제 절차가 어떻게 되는지 안내 부탁드립니다.", status: "처리중", created_at: "2026-05-27T16:42:00", login_id: "park_js", email: "park_js@example.com" },
  { inquiry_no: 9003, title: "[계정 정지 문의] 비밀번호 오류로 정지된 것 같습니다", content: "비밀번호를 여러 번 잘못 입력해서 계정이 잠긴 것 같습니다. 본인 확인 후 재활성화 가능한지 문의드립니다.", status: "완료", created_at: "2026-05-26T11:05:00", login_id: "lee_mw", email: "lee_mw@example.com" },
  { inquiry_no: 9004, title: "[계정 정지 문의] 휴면 계정 정지 관련", content: "오랫동안 접속하지 않아 휴면 처리되어 정지되었다고 나옵니다. 다시 활성화하려면 어떻게 해야 하나요?", status: "접수", created_at: "2026-05-25T08:30:00", login_id: "choi_dh", email: "choi_dh@example.com" },
  { inquiry_no: 9005, title: "[계정 정지 문의] 갑작스러운 계정 정지 안내 요청", content: "별다른 활동 없이 갑자기 계정이 정지되었습니다. 어떤 이유로 정지된 것인지 안내해 주시면 감사하겠습니다.", status: "접수", created_at: "2026-05-24T14:22:00", login_id: "jung_sy", email: "jung_sy@example.com" },
  { inquiry_no: 9006, title: "[계정 정지 문의] 부정 사용 의심으로 정지된 경우", content: "부정 사용 의심으로 정지되었다는 안내를 받았습니다. 해당 기기 및 IP가 저의 것임을 확인할 수 있습니다. 해제 부탁드립니다.", status: "처리중", created_at: "2026-05-23T10:05:00", login_id: "oh_kw", email: "oh_kw@example.com" },
  { inquiry_no: 9007, title: "[계정 정지 문의] 로그인 시도 횟수 초과로 잠금", content: "연속으로 비밀번호를 틀려 계정이 잠겼습니다. 잠금 해제 방법을 알려주세요.", status: "완료", created_at: "2026-05-22T09:30:00", login_id: "seo_jh", email: "seo_jh@example.com" },
  { inquiry_no: 9008, title: "[계정 정지 문의] 타인에 의한 정지 의심됩니다", content: "제가 직접 위반 행위를 한 적이 없는데 정지 처리된 것 같습니다. 계정 접근 이력 확인을 요청드립니다.", status: "접수", created_at: "2026-05-21T16:45:00", login_id: "yoon_ms", email: "yoon_ms@example.com" },
  { inquiry_no: 9009, title: "[계정 정지 문의] 정지 기간 및 사유 문의", content: "정지 처리는 인지하였으나 정확한 정지 기간과 구체적인 사유를 알고 싶습니다. 답변 부탁드립니다.", status: "처리중", created_at: "2026-05-20T11:10:00", login_id: "han_br", email: "han_br@example.com" },
  { inquiry_no: 9010, title: "[계정 정지 문의] 업무용 계정 정지로 인한 불편 호소", content: "해당 계정은 업무상 반드시 필요한 계정입니다. 긴급하게 정지 해제 조치 부탁드립니다.", status: "접수", created_at: "2026-05-19T08:55:00", login_id: "lim_ts", email: "lim_ts@example.com" },
  { inquiry_no: 9011, title: "[계정 정지 문의] 이메일 인증 오류 후 정지", content: "이메일 인증 과정에서 오류가 발생한 뒤 계정이 정지되었습니다. 인증 재진행이 가능한지 문의드립니다.", status: "완료", created_at: "2026-05-18T13:40:00", login_id: "kang_he", email: "kang_he@example.com" },
  { inquiry_no: 9012, title: "[계정 정지 문의] 공유 PC 사용 중 정지 발생", content: "회사 공용 PC에서 접속 중 계정이 정지되었습니다. 보안 정책 위반 여부를 확인 부탁드립니다.", status: "접수", created_at: "2026-05-17T17:00:00", login_id: "shin_yk", email: "shin_yk@example.com" },
  { inquiry_no: 9013, title: "[계정 정지 문의] VPN 사용으로 인한 정지 여부 확인", content: "VPN 사용 후 계정이 정지되었습니다. VPN 사용이 정책 위반인지 확인하고 싶습니다.", status: "처리중", created_at: "2026-05-16T10:20:00", login_id: "bae_jy", email: "bae_jy@example.com" },
  { inquiry_no: 9014, title: "[계정 정지 문의] 신규 가입 직후 정지 처리됨", content: "가입 완료 후 처음 로그인 시도 시 이미 정지 상태였습니다. 가입 절차 오류인지 확인 부탁드립니다.", status: "접수", created_at: "2026-05-15T09:15:00", login_id: "jeon_hl", email: "jeon_hl@example.com" },
  { inquiry_no: 9015, title: "[계정 정지 문의] 정지 해제 후 재정지 안내", content: "이전에 정지 해제된 계정이 다시 정지되었습니다. 반복 정지 사유를 상세히 알려주시기 바랍니다.", status: "완료", created_at: "2026-05-14T14:50:00", login_id: "kwon_sb", email: "kwon_sb@example.com" },
];

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function AdminManagePage() {
  usePageTitle("사용자 관리");
  const router = useRouter();
  const { showAlert, showConfirm } = useModal();
  const [tab, setTab] = useState<Tab>("users");

  // 사용자 관리
  const [users, setUsers]         = useState<UserRecord[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage]   = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [userLoading, setUserLoading] = useState(false);

  // 활동 로그
  const [logs, setLogs]           = useState<LogRecord[]>([]);
  const [logTotal, setLogTotal]   = useState(0);
  const [logPage, setLogPage]     = useState(1);
  const [logPages, setLogPages]   = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  // 정지 유저 문의
  const [inquiries, setInquiries]       = useState<InquiryRecord[]>([]);
  const [inquiryTotal, setInquiryTotal] = useState(0);
  const [inquiryPage, setInquiryPage]   = useState(1);
  const [inquiryPages, setInquiryPages] = useState(1);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryDetail, setInquiryDetail]   = useState<InquiryRecord | null>(null);
  // 문의 처리: 답변 모드(정지 해제 / 반려)와 사유 입력값
  const [answerMode, setAnswerMode] = useState<"unsuspend" | "reject" | null>(null);
  const [answerText, setAnswerText] = useState("");

  // 유저 활동 이력 모달
  const [userHistoryModal, setUserHistoryModal] = useState<{ user: UserRecord; logs: LogRecord[]; loading: boolean } | null>(null);

  const [error, setError]   = useState("");
  const [notice, setNotice] = useState("");

  // 정렬
  const [sortKey, setSortKey] = useState<keyof UserRecord | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedUsers = useMemo(() => {
    if (!sortKey) return users;
    return [...users].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  const handleSort = (key: keyof UserRecord) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  function SortIcon({ col }: { col: keyof UserRecord }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4, marginLeft: 3 }} />;
    return sortDir === "asc"
      ? <ChevronUp size={11} style={{ color: "var(--red)", marginLeft: 3 }} />
      : <ChevronDown size={11} style={{ color: "var(--red)", marginLeft: 3 }} />;
  }
  const [modal, setModal]   = useState<ModalState>(MODAL_CLOSED);
  const [suspendModal, setSuspendModal] = useState<SuspendReasonModal>({ open: false, user: null });
  const [suspendCompleteModal, setSuspendCompleteModal] = useState<SuspendCompleteModal>({ open: false, loginId: "", reason: "" });
  const [suspendReason, setSuspendReason] = useState("");
  const suspendReasonPresets = ["보안 정책 위반", "비정상 접근 감지", "반복적인 로그인 실패", "관리자 검토 필요"];
  const closeSuspendModal = () => {
    setSuspendModal({ open: false, user: null });
    setSuspendReason("");
  };

  // 관리자 권한 확인
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      if (u.role !== "admin") { router.push("/main"); return; }
    } catch { router.push("/login"); }
  }, [router]);

  // ── 모달 헬퍼 ────────────────────────────────────────────────────────────────
  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    variant: ModalState["variant"] = "default",
  ) => setModal({ open: true, title, message, variant, onConfirm });

  const closeModal = () => setModal(MODAL_CLOSED);

  // ── 정지 문의 처리 ────────────────────────────────────────────────────────────
  const openInquiry = (inq: InquiryRecord) => {
    setInquiryDetail(inq);
    setAnswerMode(null);
    setAnswerText("");
  };
  const closeInquiry = () => {
    setInquiryDetail(null);
    setAnswerMode(null);
    setAnswerText("");
  };
  const submitInquiryAnswer = () => {
    if (!inquiryDetail || !answerMode) return;
    const newStatus = answerMode === "unsuspend" ? "정지 해제" : "반려";
    setInquiries(prev => prev.map(i =>
      i.inquiry_no === inquiryDetail.inquiry_no ? { ...i, status: newStatus } : i
    ));
    setNotice(`문의가 "${newStatus}" 처리되었습니다.`);
    setTimeout(() => setNotice(""), 3000);
    closeInquiry();
  };

  const deleteInquiry = async () => {
    if (!inquiryDetail) return;
    if (!await showConfirm("이 문의를 삭제하시겠습니까?")) return;
    try {
      if (inquiryDetail.inquiry_no < 9000) {
        await apiCall(`/board/inquiries/${inquiryDetail.inquiry_no}`, { method: "DELETE" });
      }
      setInquiries(prev => prev.filter(i => i.inquiry_no !== inquiryDetail.inquiry_no));
      setNotice("문의가 삭제되었습니다.");
      setTimeout(() => setNotice(""), 3000);
      closeInquiry();
    } catch (e: any) {
      await showAlert(e.message || "삭제에 실패했습니다.");
    }
  };

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async (page = 1) => {
    setUserLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "10" });
      if (search)     params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res: any = await apiCall(`/admin/users?${params}`);
      if (res?.success) {
        setUsers(res.data.users);
        setUserTotal(res.data.total);
        setUserPage(res.data.page);
        setUserPages(res.data.pages);
      }
    } catch (e: any) { setError(e.message || "사용자 목록을 불러오지 못했습니다."); }
    setUserLoading(false);
  }, [search, roleFilter]);

  const loadLogs = useCallback(async (page = 1) => {
    setLogLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "10" });
      if (actionFilter) params.set("action", actionFilter);
      const res: any = await apiCall(`/admin/logs?${params}`);
      if (res?.success) {
        setLogs(res.data.logs);
        setLogTotal(res.data.total);
        setLogPage(res.data.page);
        setLogPages(res.data.pages);
      }
    } catch (e: any) { setError(e.message || "로그를 불러오지 못했습니다."); }
    setLogLoading(false);
  }, [actionFilter]);

  const loadInquiries = useCallback(async (page = 1) => {
    setInquiryLoading(true);
    try {
      // 정지 문의는 제목에 "[계정 정지 문의]" 포함된 항목 조회
      const params = new URLSearchParams({ page: String(page), per_page: "100" });
      const res: any = await apiCall(`/board/inquiries?${params}`);
      if (res?.success) {
        const realItems = (res.data?.items ?? []).filter((i: any) =>
          i.title?.includes("[계정 정지 문의]")
        );
        // 실제 데이터 + 더미데이터 항상 합쳐서 표시
        const allItems = [...realItems, ...DUMMY_INQUIRIES];
        setInquiries(allItems);
        setInquiryTotal(allItems.length);
        setInquiryPages(Math.max(1, Math.ceil(allItems.length / 10)));
        setInquiryPage(1);
      }
    } catch {
      // 엔드포인트 없으면 더미데이터 표시
      setInquiries(DUMMY_INQUIRIES);
      setInquiryTotal(DUMMY_INQUIRIES.length);
      setInquiryPages(1);
      setInquiryPage(1);
    }
    setInquiryLoading(false);
  }, []);

  const openUserHistory = async (u: UserRecord) => {
    setUserHistoryModal({ user: u, logs: [], loading: true });
    try {
      const res: any = await apiCall(`/admin/logs?login_id=${u.login_id}&per_page=50`);
      const userLogs: LogRecord[] = res?.success ? (res.data?.logs ?? []) : [];
      setUserHistoryModal({ user: u, logs: userLogs, loading: false });
    } catch {
      setUserHistoryModal({ user: u, logs: [], loading: false });
    }
  };

  // 마운트 시 두 탭 모두 로드 → 배지 카운트 정확히 표시
  useEffect(() => { loadUsers(1); loadLogs(1); loadInquiries(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "users")     loadUsers(1);    }, [tab, loadUsers]);
  useEffect(() => { if (tab === "logs")      loadLogs(1);     }, [tab, loadLogs]);
  useEffect(() => { if (tab === "inquiries") loadInquiries(1);}, [tab, loadInquiries]);

  // ── 사용자 액션 ──────────────────────────────────────────────────────────────
  const changeRole = (u: UserRecord) => {
    const newRole = u.role === "admin" ? "user" : "admin";
    const label   = newRole === "admin" ? "관리자로 승격" : "일반 사용자로 변경";
    openConfirm(
      "역할 변경",
      `${u.login_id} 계정을 ${label}하시겠습니까?`,
      async () => {
        closeModal();
        try {
          await apiCall(`/admin/users/${u.user_no}/role`, { method: "PATCH", body: JSON.stringify({ role: newRole }) });
          setNotice("역할이 변경되었습니다."); setTimeout(() => setNotice(""), 3000);
          loadUsers(userPage);
        } catch (e: any) { setError(e.message || "역할 변경에 실패했습니다."); }
      },
      "warning",
    );
  };

  const deleteUser = (u: UserRecord) => {
    openConfirm(
      "계정 삭제",
      `"${u.login_id}" 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      async () => {
        closeModal();
        try {
          await apiCall(`/admin/users/${u.user_no}`, { method: "DELETE" });
          setNotice("계정이 삭제되었습니다."); setTimeout(() => setNotice(""), 3000);
          loadUsers(userPage);
        } catch (e: any) { setError(e.message || "삭제에 실패했습니다."); }
      },
      "danger",
    );
  };

  const toggleStatus = (u: UserRecord) => {
    if (!u.is_active) {
      // 활성화는 사유 불필요 — 바로 확인 모달
      openConfirm(
        "계정 활성화",
        `"${u.login_id}" 계정을 활성화하시겠습니까?`,
        async () => {
          closeModal();
          try {
            await apiCall(`/admin/users/${u.user_no}/status`, { method: "PATCH", body: JSON.stringify({ is_active: true }) });
            setNotice("계정이 활성화되었습니다."); setTimeout(() => setNotice(""), 3000);
            loadUsers(userPage);
          } catch (e: any) { setError(e.message || "상태 변경에 실패했습니다."); }
        },
        "default",
      );
    } else {
      // 정지는 사유 입력 모달 표시
      setSuspendReason("");
      setSuspendModal({ open: true, user: u });
    }
  };

  const confirmSuspend = async () => {
    const u = suspendModal.user;
    if (!u) return;
    const reason = suspendReason.trim();
    if (!reason) return;
    closeSuspendModal();
    try {
      await apiCall(`/admin/users/${u.user_no}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false, suspension_reason: reason }),
      });
      setSuspendCompleteModal({ open: true, loginId: u.login_id, reason });
      loadUsers(userPage);
    } catch (e: any) { setError(e.message || "상태 변경에 실패했습니다."); }
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      {/* 정지 사유 입력 모달 */}
      {suspendModal.open && suspendModal.user && (
        <div className={styles.modalOverlay} onClick={closeSuspendModal}>
          <div className={styles.suspendModalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="suspend-modal-title">
            <div className={styles.suspendModalHeader}>
              <div className={styles.suspendModalIcon}><Ban size={23} /></div>
              <div>
                <span id="suspend-modal-title" className={styles.suspendModalTitle}>사용자 계정 정지</span>
                <p className={styles.suspendModalSubtitle}>정지 처리 전 대상 계정과 사유를 확인해 주세요.</p>
              </div>
              <button className={styles.modalClose} onClick={closeSuspendModal} aria-label="정지 모달 닫기"><X size={17} /></button>
            </div>
            <div className={styles.suspendModalBody}>
              <div className={styles.suspendUserCard}>
                <div className={styles.suspendUserAvatar}>{suspendModal.user.login_id.slice(0, 1).toUpperCase()}</div>
                <div className={styles.suspendUserInfo}>
                  <strong>{suspendModal.user.login_id}</strong>
                  <span>{suspendModal.user.name || "이름 미등록"} · {suspendModal.user.email || "이메일 미등록"}</span>
                </div>
                <span className={styles.suspendUserRole}>{suspendModal.user.role === "admin" ? "관리자" : "일반 사용자"}</span>
              </div>
              <div className={styles.suspendWarningBox}>
                <AlertTriangle size={17} />
                <span>정지 즉시 로그인과 서비스 이용이 제한되며, 입력한 사유가 사용자 안내 화면에 표시됩니다.</span>
              </div>
              <div className={styles.suspendReasonSection}>
                <div className={styles.suspendReasonHeader}>
                  <label htmlFor="suspend-reason">정지 사유 <b>필수</b></label>
                  <span>{suspendReason.length} / 300</span>
                </div>
                <div className={styles.suspendPresetList}>
                  {suspendReasonPresets.map(reason => (
                    <button key={reason} type="button" className={suspendReason === reason ? styles.suspendPresetActive : styles.suspendPreset} onClick={() => setSuspendReason(reason)}>{reason}</button>
                  ))}
                </div>
                <textarea
                  id="suspend-reason"
                  className={styles.suspendReasonInput}
                  rows={4}
                  maxLength={300}
                  placeholder="정지 사유를 구체적으로 입력해 주세요. 예: 비정상 로그인 시도가 반복되어 보안 검토가 필요합니다."
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  autoFocus
                />
                <p className={styles.suspendReasonHelp}>사용자가 정지 사유를 확인하고 문의할 수 있도록 명확하게 작성해 주세요.</p>
              </div>
            </div>
            <div className={styles.suspendModalFooter}>
              <button className={styles.modalCancelBtn} onClick={closeSuspendModal}>취소</button>
              <button className={`${styles.modalConfirmBtn} ${styles.modalConfirmBtn_danger} ${styles.suspendConfirmBtn}`} onClick={confirmSuspend} disabled={!suspendReason.trim()}>
                <Ban size={15} /> 계정 정지 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 정지 완료 모달 */}
      {suspendCompleteModal.open && (
        <div className={styles.modalOverlay} onClick={() => setSuspendCompleteModal({ open: false, loginId: "", reason: "" })}>
          <div className={styles.suspendCompleteCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="suspend-complete-title">
            <div className={styles.suspendCompleteIcon}><CheckCircle2 size={34} /></div>
            <h3 id="suspend-complete-title">계정 정지가 완료되었습니다</h3>
            <p><strong>{suspendCompleteModal.loginId}</strong> 계정의 로그인이 즉시 제한되었습니다.</p>
            <div className={styles.suspendCompleteReason}>
              <span>등록된 정지 사유</span>
              <strong>{suspendCompleteModal.reason}</strong>
            </div>
            <button className={styles.suspendCompleteBtn} onClick={() => setSuspendCompleteModal({ open: false, loginId: "", reason: "" })}>확인</button>
          </div>
        </div>
      )}

      {/* 커스텀 확인 모달 */}
      {modal.open && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={`${styles.modalHeader} ${styles[`modalHeader_${modal.variant}`]}`}>
              <div className={styles.modalIcon}>
                {modal.variant === "danger"  && <AlertTriangle size={20} />}
                {modal.variant === "warning" && <AlertTriangle size={20} />}
                {modal.variant === "default" && <CheckCircle2  size={20} />}
              </div>
              <span className={styles.modalTitle}>{modal.title}</span>
              <button className={styles.modalClose} onClick={closeModal}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              {modal.message.split("\n").map((line, i) => <p key={i}>{line}</p>)}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={closeModal}>취소</button>
              <button
                className={`${styles.modalConfirmBtn} ${styles[`modalConfirmBtn_${modal.variant}`]}`}
                onClick={modal.onConfirm}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div>
          <h1>관리자 시스템</h1>
          <p className={styles.subtitle}>사용자 관리 · 활동 로그</p>
        </div>
      </div>

      {error  && <div className={styles.errorBox}>{error}</div>}
      {notice && <div className={styles.noticeBox}>{notice}</div>}

      {/* 탭 */}
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${tab === "users" ? styles.tabActive : ""}`} onClick={() => setTab("users")}>
          <Users size={14} /> 사용자 관리 <span className={styles.badge}>{userTotal}</span>
        </button>
        <button className={`${styles.tabBtn} ${tab === "logs"  ? styles.tabActive : ""}`} onClick={() => setTab("logs")}>
          <ScrollText size={14} /> 활동 로그 <span className={styles.badge}>{logTotal}</span>
        </button>
        <button className={`${styles.tabBtn} ${tab === "inquiries" ? styles.tabActive : ""}`} onClick={() => setTab("inquiries")}>
          <MessageSquare size={14} /> 정지 문의 <span className={styles.badge}>{inquiryTotal}</span>
        </button>
      </div>

      {/* ── 사용자 관리 ── */}
      {tab === "users" && (
        <div className={styles.section}>
          <div className={styles.toolbar}>
            <div className={styles.searchRow}>
              <div className={styles.searchBox}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="이름 · 아이디 · 이메일 검색"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadUsers(1)}
                />
              </div>
              <select className={styles.filterSelect} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">전체 역할</option>
                <option value="user">일반 사용자</option>
                <option value="admin">관리자</option>
              </select>
              <button className={styles.actionBtn} onClick={() => loadUsers(1)} disabled={userLoading}>
                <RefreshCw size={13} className={userLoading ? styles.spinning : ""} /> 검색
              </button>
            </div>
            <span className={styles.totalInfo}>총 {userTotal}명</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.userTable}`}>
              <thead>
                <tr>
                  <th>No</th>
                  <th onClick={() => handleSort("login_id")} style={{ cursor: "pointer", userSelect: "none" }}>아이디<SortIcon col="login_id" /></th>
                  <th onClick={() => handleSort("name")} style={{ cursor: "pointer", userSelect: "none" }}>이름<SortIcon col="name" /></th>
                  <th onClick={() => handleSort("email")} style={{ cursor: "pointer", userSelect: "none" }}>이메일<SortIcon col="email" /></th>
                  <th>연락처</th>
                  <th onClick={() => handleSort("is_active")} style={{ cursor: "pointer", userSelect: "none" }}>상태<SortIcon col="is_active" /></th>
                  <th onClick={() => handleSort("role")} style={{ cursor: "pointer", userSelect: "none" }}>역할<SortIcon col="role" /></th>
                  <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer", userSelect: "none" }}>가입일<SortIcon col="created_at" /></th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {userLoading ? (
                  <tr><td colSpan={9} className={styles.empty}>불러오는 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={9} className={styles.empty}>사용자가 없습니다.</td></tr>
                ) : sortedUsers.map((u, idx) => (
                  <tr key={u.user_no}>
                    <td className={styles.noCell}>{(userPage - 1) * 10 + idx + 1}</td>
                    <td className={styles.bold}>{u.login_id}</td>
                    <td>{u.name}</td>
                    <td className={styles.muted}>{u.email || "—"}</td>
                    <td className={styles.muted}>{u.phone || "—"}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.is_active ? styles.statusActive : styles.statusSuspended}`}>
                        {u.is_active ? "활성" : "정지"}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.roleBadge} ${u.role === "admin" ? styles.roleAdmin : styles.roleUser}`}>
                        {u.role === "admin" ? "관리자" : "사용자"}
                      </span>
                    </td>
                    <td className={styles.muted}>{fmtDate(u.created_at)}</td>
                    <td style={{ overflow: "visible" }}>
                      <div className={styles.actionBtns}>
                        <button
                          className={`${styles.roleBtn} ${u.role === "admin" ? styles.roleBtnAdmin : ""}`}
                          onClick={() => changeRole(u)}
                          title={u.role === "admin" ? "일반 사용자로 변경" : "관리자로 승격"}
                        >
                          {u.role === "admin" ? <ShieldCheck size={13} /> : <Shield size={13} />}
                        </button>
                        <button
                          className={`${styles.statusBtn} ${u.is_active ? "" : styles.statusBtnOff}`}
                          onClick={() => toggleStatus(u)}
                          disabled={u.role === "admin"}
                          title={u.role === "admin" ? "관리자 계정은 변경 불가" : u.is_active ? "계정 정지" : "계정 활성화"}
                        >
                          {u.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                        </button>
                        <button
                          className={styles.historyBtn}
                          onClick={() => openUserHistory(u)}
                          title="활동 이력 보기"
                        >
                          <History size={13} />
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => deleteUser(u)}
                          disabled={u.role === "admin"}
                          title={u.role === "admin" ? "관리자 계정은 삭제 불가" : "계정 삭제"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={userPage} pages={userPages} onChange={p => { setUserPage(p); loadUsers(p); }} />
        </div>
      )}

      {/* ── 활동 로그 ── */}
      {tab === "logs" && (
        <div className={styles.section}>
          <div className={styles.toolbar}>
            <div className={styles.searchRow}>
              <select className={styles.filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                <option value="">전체 액션</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button className={styles.actionBtn} onClick={() => loadLogs(1)} disabled={logLoading}>
                <RefreshCw size={13} className={logLoading ? styles.spinning : ""} /> 조회
              </button>
            </div>
            <span className={styles.totalInfo}>총 {logTotal}건</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.logTable}`}>
              <thead>
                <tr><th>시각</th><th>수행자</th><th>액션</th><th>대상</th><th>상세</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logLoading ? (
                  <tr><td colSpan={6} className={styles.empty}>불러오는 중...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className={styles.empty}>로그가 없습니다.</td></tr>
                ) : logs.map(l => (
                  <tr key={l.log_no}>
                    <td className={styles.muted}>{fmtDate(l.created_at)}</td>
                    <td className={styles.bold}>{l.login_id || "—"}</td>
                    <td>
                      <span className={`${styles.actionChip} ${styles[`action_${l.action}`] ?? ""}`}>
                        {ACTION_LABELS[l.action] ?? l.action}
                      </span>
                    </td>
                    <td className={styles.muted}>{fmtTarget(l.target)}</td>
                    <td className={styles.detail}>{fmtDetail(l.detail)}</td>
                    <td className={styles.muted}>{l.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={logPage} pages={logPages} onChange={p => { setLogPage(p); loadLogs(p); }} />
        </div>
      )}

      {/* ── 정지 유저 문의 탭 ── */}
      {tab === "inquiries" && (
        <div className={styles.section}>
          <div className={styles.toolbar}>
            <span className={styles.totalInfo}>총 {inquiryTotal}건</span>
            <button className={styles.actionBtn} onClick={() => loadInquiries(1)} disabled={inquiryLoading}>
              <RefreshCw size={13} className={inquiryLoading ? styles.spinning : ""} /> 새로고침
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.inquiryTable}`}>
              <thead>
                <tr><th>No</th><th>제목</th><th>내용</th><th>상태</th><th>등록일</th></tr>
              </thead>
              <tbody>
                {inquiryLoading ? (
                  <tr><td colSpan={5} className={styles.empty}>불러오는 중...</td></tr>
                ) : inquiries.length === 0 ? (
                  <tr><td colSpan={5} className={styles.empty}>정지 계정 문의가 없습니다.</td></tr>
                ) : inquiries.slice((inquiryPage - 1) * 10, inquiryPage * 10).map((inq, idx) => (
                  <tr key={inq.inquiry_no} style={{ cursor: "pointer" }} onClick={() => openInquiry(inq)}>
                    <td className={styles.noCell}>{(inquiryPage - 1) * 10 + idx + 1}</td>
                    <td className={styles.bold}>{inq.title}</td>
                    <td className={styles.muted}>{inq.content?.slice(0, 120)}</td>
                    <td><span className={styles.statusBadge}>{inq.status || "접수"}</span></td>
                    <td className={styles.muted}>{fmtDate(inq.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={inquiryPage} pages={inquiryPages} onChange={p => setInquiryPage(p)} />
        </div>
      )}

      {/* ── 문의 상세 모달 ── */}
      {inquiryDetail && (
        <div className={styles.modalOverlay} onClick={closeInquiry}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{inquiryDetail.title}</span>
              <button className={styles.closeBtn} onClick={closeInquiry}><X size={18} /></button>
            </div>
            <div style={{ padding: "16px 20px", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14, maxHeight: 240, overflowY: "auto" }}>
              {inquiryDetail.content}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-color)", fontSize: 12, color: "var(--text-muted)" }}>
              등록일: {fmtDate(inquiryDetail.created_at)}
            </div>

            {/* 답변/사유 입력 — 정지 해제 또는 반려 선택 시 노출 */}
            {answerMode && (
              <div style={{ padding: "14px 20px 0" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {answerMode === "unsuspend" ? "정지 해제 사유" : "반려 사유"}
                </label>
                <textarea
                  className={styles.answerInput}
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  placeholder={answerMode === "unsuspend"
                    ? "정지를 해제하는 사유를 입력하세요."
                    : "문의를 반려하는 사유를 입력하세요."}
                  rows={4}
                  autoFocus
                />
              </div>
            )}

            {/* 푸터 액션 */}
            <div className={styles.modalFooter} style={{ paddingTop: 16 }}>
              {answerMode ? (
                <>
                  <button className={styles.modalCancelBtn} onClick={() => { setAnswerMode(null); setAnswerText(""); }}>
                    취소
                  </button>
                  <button
                    className={`${styles.modalConfirmBtn} ${answerMode === "reject" ? styles.modalConfirmBtn_danger : styles.modalConfirmBtn_default}`}
                    onClick={submitInquiryAnswer}
                    disabled={!answerText.trim()}
                  >
                    {answerMode === "unsuspend" ? "정지 해제 처리" : "반려 처리"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`${styles.modalConfirmBtn} ${styles.modalConfirmBtn_danger}`}
                    onClick={() => setAnswerMode("reject")}
                  >
                    반려
                  </button>
                  <button
                    className={`${styles.modalConfirmBtn} ${styles.modalConfirmBtn_default}`}
                    onClick={() => setAnswerMode("unsuspend")}
                  >
                    정지 해제
                  </button>
                  <button
                    className={styles.modalDeleteBtn}
                    onClick={deleteInquiry}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 유저 활동 이력 모달 ── */}
      {userHistoryModal && (
        <div className={styles.modalOverlay} onClick={() => setUserHistoryModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                <History size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {userHistoryModal.user.name} ({userHistoryModal.user.login_id}) 활동 이력
              </span>
              <button className={styles.closeBtn} onClick={() => setUserHistoryModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: "0 4px", maxHeight: 480, overflowY: "auto" }}>
              {userHistoryModal.loading ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>로딩 중...</div>
              ) : userHistoryModal.logs.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>활동 기록이 없습니다.</div>
              ) : (
                <table className={styles.table} style={{ margin: 0 }}>
                  <thead>
                    <tr><th>시각</th><th>액션</th><th>대상</th><th>상세</th></tr>
                  </thead>
                  <tbody>
                    {userHistoryModal.logs.map(l => (
                      <tr key={l.log_no}>
                        <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</td>
                        <td><span className={styles.actionTag}>{ACTION_LABELS[l.action] ?? l.action}</span></td>
                        <td className={styles.muted}>{fmtTarget(l.target)}</td>
                        <td className={styles.detail}>{fmtDetail(l.detail)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────────
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button className={styles.pageBtn} disabled={page <= 1} onClick={() => onChange(page - 1)}>이전</button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = pages <= 7 ? i + 1 : Math.max(1, page - 3) + i;
        if (p > pages) return null;
        return (
          <button key={p} className={`${styles.pageBtn} ${p === page ? styles.pageActive : ""}`} onClick={() => onChange(p)}>{p}</button>
        );
      })}
      <button className={styles.pageBtn} disabled={page >= pages} onClick={() => onChange(page + 1)}>다음</button>
    </div>
  );
}
