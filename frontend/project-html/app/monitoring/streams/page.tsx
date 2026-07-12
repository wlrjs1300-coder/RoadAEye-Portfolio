"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cctv, Search, Play, Square, RefreshCw, MapPin, X, Star } from "lucide-react";
import styles from "./streams.module.css";
import ConfirmModal from "@/components/ConfirmModal";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

const API_URL = "/api/proxy";
const PRIORITY_CCTV_KEY = "roadeye:priority-cctvs";
const PRIORITY_CCTV_SEEDED_KEY = "roadeye:priority-cctvs-seeded-v2";
const RESULT_PAGE_SIZE = 8;

const DEFAULT_PRIORITY_CCTV_NAMES = [
  "[경부선] 판교분기점",
  "[수도권제1순환선] 판교램프",
  "[수도권제1순환선] 판교분기점",
  "[용인서울선]서판교IC진입 서울",
];

interface ItsCamera {
  camera_id: string;
  name: string;
  coord_x: string;
  coord_y: string;
  stream_url: string;
  road_section_id?: string;
}

interface ActiveStream {
  camera_id: string;
  name: string;
  is_active: boolean;
  frame_count: number;
  cctv_no?: number | null;
  analyzed_count:   number;
  keras_pass_count: number;
  detection_count:  number;
  last_analyzed_at: string | null;
}

interface StreamMeta {
  startedAt: number;
  lastFrameCount: number;
  lastFrameAt: number;
}

type Msg = { type: "success" | "error" | "info"; text: string } | null;

interface Region { key: string; label: string; bbox: [number, number, number, number]; }
const REGIONS: Region[] = [
  { key: "all",     label: "전국",       bbox: [126.0, 130.0, 34.0, 38.5] },
  { key: "metro",   label: "수도권",     bbox: [126.5, 127.5, 37.0, 37.8] },
  { key: "gangwon", label: "강원",       bbox: [127.5, 129.5, 37.0, 38.5] },
  { key: "chung",   label: "충청",       bbox: [126.5, 128.5, 36.0, 37.3] },
  { key: "honam",   label: "호남(전라)", bbox: [126.0, 127.5, 34.5, 36.2] },
  { key: "yeong",   label: "영남(경상)", bbox: [127.5, 129.5, 34.7, 36.7] },
  { key: "jeju",    label: "제주",       bbox: [126.1, 127.0, 33.1, 33.6] },
];

export default function StreamsPage() {
  usePageTitle("실시간 스트리밍");
  const { showAlert } = useModal();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  const [region, setRegion]   = useState<string>("all");
  const [keyword, setKeyword] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [results, setResults]     = useState<ItsCamera[]>([]);
  const [active, setActive]       = useState<ActiveStream[]>([]);
  const [priorityCameras, setPriorityCameras] = useState<ItsCamera[]>([]);
  const [busyCameraId, setBusyCameraId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [streamMeta, setStreamMeta] = useState<Record<string, StreamMeta>>({});
  const [playingCam, setPlayingCam] = useState<ActiveStream | null>(null);
  const [pendingStop, setPendingStop] = useState<{ cameraId: string; name: string } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [resultPage, setResultPage] = useState(1);
  // 체크박스 선택 상태
  const [selectedActive, setSelectedActive] = useState<Set<string>>(new Set());
  const [selectedResult, setSelectedResult] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const STALE_MS = 10_000;

  const handleManualRefresh = () => { setRefreshTick(t => t + 1); refreshActive(); };

  const mergePriorityCameras = (primary: ItsCamera[], secondary: ItsCamera[]) => {
    const seen = new Set<string>();
    return [...primary, ...secondary].filter(cam => {
      if (seen.has(cam.camera_id)) return false;
      seen.add(cam.camera_id); return true;
    }).slice(0, 12);
  };

  useEffect(() => { void (async () => {
    try {
      const saved = localStorage.getItem(PRIORITY_CCTV_KEY);
      if (saved) setPriorityCameras(JSON.parse(saved));
    } catch {}
    })(); }, []);

  const savePriorityCameras = (next: ItsCamera[]) => {
    setPriorityCameras(next);
    localStorage.setItem(PRIORITY_CCTV_KEY, JSON.stringify(next));
  };

  const isPriorityCamera = (cameraId: string) => priorityCameras.some(c => c.camera_id === cameraId);

  const togglePriorityCamera = (cam: ItsCamera) => {
    if (isPriorityCamera(cam.camera_id)) {
      savePriorityCameras(priorityCameras.filter(c => c.camera_id !== cam.camera_id));
      setMsg({ type: "info", text: `"${cam.name}" 카메라를 주요 CCTV에서 해제했습니다.` });
    } else {
      savePriorityCameras([cam, ...priorityCameras].slice(0, 12));
      setMsg({ type: "success", text: `"${cam.name}" 카메라를 주요 CCTV로 등록했습니다.` });
    }
  };

  const filteredResults = keyword.trim()
    ? results.filter(c => c.name.toLowerCase().includes(keyword.trim().toLowerCase()))
    : results;
  const resultTotalPages = Math.max(1, Math.ceil(filteredResults.length / RESULT_PAGE_SIZE));
  const currentResultPage = Math.min(resultPage, resultTotalPages);
  const pagedResults = filteredResults.slice(
    (currentResultPage - 1) * RESULT_PAGE_SIZE,
    currentResultPage * RESULT_PAGE_SIZE,
  );

  useEffect(() => { void (async () => {
    if (results.length === 0) return;
    const defaultCameras = DEFAULT_PRIORITY_CCTV_NAMES
      .map(name => results.find(cam => cam.name === name))
      .filter((cam): cam is ItsCamera => Boolean(cam));
    if (defaultCameras.length === 0) return;
    const seeded = localStorage.getItem(PRIORITY_CCTV_SEEDED_KEY) === "1";
    if (seeded && priorityCameras.length > 0) return;
    const seededList = seeded ? mergePriorityCameras(defaultCameras, priorityCameras) : defaultCameras.slice(0, 4);
    savePriorityCameras(seededList);
    localStorage.setItem(PRIORITY_CCTV_SEEDED_KEY, "1");
    })(); }, [results, priorityCameras]);

  useEffect(() => { void (async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role !== "admin") { await showAlert("관리자 권한이 필요합니다."); router.push("/main"); return; }
      setAuthorized(true);
    } catch { router.push("/login"); }
    })(); }, [router]);

  const refreshActive = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/its/stream/status`);
      const d = await r.json();
      const streams: ActiveStream[] = (d?.streams || []).filter((s: ActiveStream) => s.is_active);
      setActive(streams);
      const now = Date.now();
      setStreamMeta(prev => {
        const next: Record<string, StreamMeta> = {};
        for (const s of streams) {
          const old = prev[s.camera_id];
          if (!old) { next[s.camera_id] = { startedAt: now, lastFrameCount: s.frame_count, lastFrameAt: now }; }
          else { next[s.camera_id] = { startedAt: old.startedAt, lastFrameCount: s.frame_count, lastFrameAt: s.frame_count > old.lastFrameCount ? now : old.lastFrameAt }; }
        }
        return next;
      });
    } catch { setMsg({ type: "error", text: "스트림 상태를 가져오지 못했습니다." }); }
  }, []);

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}초`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 ${sec % 60}초`;
    return `${Math.floor(min / 60)}시간 ${min % 60}분`;
  };

  useEffect(() => { void (async () => {
    if (!authorized) return;
    refreshActive();
    const t = setInterval(refreshActive, 5000);
    return () => clearInterval(t);
    })(); }, [authorized, refreshActive]);

  const initialFetchedRef = useRef(false);
  useEffect(() => { void (async () => {
    if (!authorized || initialFetchedRef.current) return;
    initialFetchedRef.current = true;
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })(); }, [authorized]);

  const handleSearch = async () => {
    const r = REGIONS.find(x => x.key === region);
    if (!r) return;
    const [min_x, max_x, min_y, max_y] = r.bbox;
    setMsg(null); setSearching(true);
    try {
      const qs = new URLSearchParams({ min_x: String(min_x), max_x: String(max_x), min_y: String(min_y), max_y: String(max_y) });
      const res = await fetch(`${API_URL}/its/cameras?${qs}`);
      const d = await res.json();
      const cams: ItsCamera[] = d?.cameras || [];
      setResults(cams);
      setResultPage(1);
      setMsg({ type: cams.length > 0 ? "success" : "info",
        text: cams.length > 0 ? `${r.label}에서 ${cams.length}개 카메라를 찾았습니다.` : `${r.label}에 카메라가 없습니다.` });
    } catch { setMsg({ type: "error", text: "ITS 카메라 검색에 실패했습니다." }); }
    finally { setSearching(false); }
  };

  // ITS 스트림 URL은 시간 제한 토큰을 포함하므로, 시작 전 항상 신선한 URL을 조회한다.
  const fetchFreshUrl = async (cam: ItsCamera): Promise<ItsCamera> => {
    // 현재 검색 결과에 있으면 즉시 반환
    const inResults = results.find(r => r.camera_id === cam.camera_id);
    if (inResults) return inResults;

    // 전체 지역으로 검색해 최신 URL 획득
    try {
      const r = REGIONS.find(x => x.key === "all")!;
      const [min_x, max_x, min_y, max_y] = r.bbox;
      const qs = new URLSearchParams({ min_x: String(min_x), max_x: String(max_x), min_y: String(min_y), max_y: String(max_y) });
      const res = await fetch(`${API_URL}/its/cameras?${qs}`, { signal: AbortSignal.timeout(10000) });
      const d = await res.json();
      const fresh = (d?.cameras || []).find((c: ItsCamera) => c.camera_id === cam.camera_id);
      if (fresh) return fresh;
    } catch {}

    return cam; // 조회 실패 시 기존 URL 사용 (만료됐을 수 있음)
  };

  const handleStart = async (cam: ItsCamera) => {
    setBusyCameraId(cam.camera_id); setMsg(null);
    try {
      // 신선한 URL로 교체
      const startCam = await fetchFreshUrl(cam);
      const r = await fetch(`${API_URL}/its/stream/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_id: startCam.camera_id, stream_url: startCam.stream_url, name: startCam.name }),
      });
      if (r.status === 409) setMsg({ type: "info", text: "이미 실행 중인 카메라입니다." });
      else if (!r.ok) throw new Error(String(r.status));
      else setMsg({ type: "success", text: `"${startCam.name}" 분석을 시작했습니다.` });
      await refreshActive();
    } catch { setMsg({ type: "error", text: "분석 시작에 실패했습니다." }); }
    finally { setBusyCameraId(null); }
  };

  const handleStartPriorityAll = async () => {
    const targets = priorityCameras.filter(cam => !activeIds.has(cam.camera_id));
    if (targets.length === 0) { setMsg({ type: "info", text: "이미 모두 분석 중입니다." }); return; }
    for (const cam of targets) await handleStart(cam);
    setMsg({ type: "success", text: `주요 CCTV ${targets.length}개 분석 시작 완료.` });
  };

  const requestStop = (cameraId: string, name: string) => setPendingStop({ cameraId, name });

  const confirmStop = async () => {
    if (!pendingStop) return;
    const { cameraId, name } = pendingStop;
    setPendingStop(null); setBusyCameraId(cameraId); setMsg(null);
    try {
      const r = await fetch(`${API_URL}/its/stream/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ camera_id: cameraId }) });
      if (!r.ok) throw new Error(String(r.status));
      setMsg({ type: "success", text: `"${name}" 분석을 중지했습니다.` });
      await refreshActive();
    } catch { setMsg({ type: "error", text: "분석 중지에 실패했습니다." }); }
    finally { setBusyCameraId(null); }
  };

  // ── 일괄 처리 ────────────────────────────────────────────────────────────────
  const toggleActiveCheck  = (id: string) => setSelectedActive(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleResultCheck  = (id: string) => setSelectedResult(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const checkAllActive  = (ids: string[]) => setSelectedActive(prev => {
    const allChecked = ids.every(id => prev.has(id));
    const s = new Set(prev);
    allChecked ? ids.forEach(id => s.delete(id)) : ids.forEach(id => s.add(id));
    return s;
  });
  const checkAllResult  = (cams: ItsCamera[]) => setSelectedResult(prev => {
    const allChecked = cams.every(c => prev.has(c.camera_id));
    const s = new Set(prev);
    allChecked ? cams.forEach(c => s.delete(c.camera_id)) : cams.forEach(c => s.add(c.camera_id));
    return s;
  });

  /** 선택된 활성 스트림 일괄 중지 */
  const bulkStop = async () => {
    if (selectedActive.size === 0) return;
    setBulkLoading(true); setMsg(null);
    let stopped = 0;
    for (const cameraId of Array.from(selectedActive)) {
      try {
        const r = await fetch(`${API_URL}/its/stream/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ camera_id: cameraId }) });
        if (r.ok) stopped++;
      } catch {}
    }
    setSelectedActive(new Set());
    setMsg({ type: "success", text: `${stopped}개 스트림 중지 완료.` });
    await refreshActive();
    setBulkLoading(false);
  };

  /** 선택된 검색 결과 일괄 시작 */
  const bulkStart = async () => {
    if (selectedResult.size === 0) return;
    setBulkLoading(true); setMsg(null);
    const targets = pagedResults.filter(c => selectedResult.has(c.camera_id));
    let started = 0;
    for (const cam of targets) {
      try {
        const startCam = await fetchFreshUrl(cam);
        const r = await fetch(`${API_URL}/its/stream/start`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camera_id: startCam.camera_id, stream_url: startCam.stream_url, name: startCam.name }),
        });
        if (r.ok || r.status === 409) started++;
      } catch {}
    }
    setSelectedResult(new Set());
    setMsg({ type: "success", text: `${started}개 분석 시작 완료.` });
    await refreshActive();
    setBulkLoading(false);
  };

  if (!authorized) return null;

  const activeIds  = new Set(active.map(a => a.camera_id));
  // 주요 CCTV 중 현재 미실행 목록
  const standbyPriority = priorityCameras.filter(cam => !activeIds.has(cam.camera_id));

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1>스트림 관리</h1>
        <p className={styles.subtitle}>
          ITS API에서 고속도로 CCTV를 검색하고 AI 분석을 시작·중지합니다.
        </p>
      </div>

      {msg && (
        <div className={`${styles.message} ${
          msg.type === "success" ? styles.messageSuccess :
          msg.type === "error"   ? styles.messageError   : styles.messageInfo
        }`}>{msg.text}</div>
      )}

      {/* ① 실시간 분석 상태 + 주요 CCTV 대기 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <Cctv size={18} /> 실시간 분석 상태
            <span className={styles.badge}>{active.length}개 분석 중</span>
            {standbyPriority.length > 0 && (
              <span className={`${styles.badge} ${styles.badgeStandby}`}>{standbyPriority.length}개 대기</span>
            )}
          </h2>
          <div className={styles.bulkBar}>
            {active.length > 0 && (() => {
              const allSel = active.length > 0 && active.every(s => selectedActive.has(s.camera_id));
              return (
                <>
                  <button
                    className={`${styles.selectAllBtn}${allSel ? ` ${styles.allSelected}` : ""}`}
                    onClick={() => checkAllActive(active.map(s => s.camera_id))}
                  >
                    <span style={{ width:14, height:14, borderRadius:3, border:`2px solid ${allSel ? "#e11d48" : "currentColor"}`, background: allSel ? "#e11d48" : "transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {allSel && <span style={{ width:4,height:7,border:"2px solid white",borderTop:"none",borderLeft:"none",transform:"rotate(45deg) translateY(-1px)",display:"block" }} />}
                    </span>
                    {allSel ? "전체 해제" : "전체 선택"}
                  </button>
                  {selectedActive.size > 0 && (
                    <button className={styles.bulkStopBtn} onClick={bulkStop} disabled={bulkLoading}>
                      <Square size={12} />
                      중지
                      <span className={styles.selectedCount}>{selectedActive.size}</span>
                    </button>
                  )}
                </>
              );
            })()}
            {standbyPriority.length > 0 && (
              <button className={`${styles.actionBtn} ${styles.startBtn}`} onClick={handleStartPriorityAll}>
                <Play size={13} style={{ verticalAlign:"middle", marginRight:4 }} />주요 CCTV 시작
              </button>
            )}
            <button className={styles.actionBtn} onClick={handleManualRefresh} title="새로고침">
              <span style={{ display:"inline-flex",alignItems:"center",verticalAlign:"middle",marginRight:4,transform:`rotate(${refreshTick*360}deg)`,transition:"transform 0.6s ease-in-out" }}>
                <RefreshCw size={14} />
              </span>새로고침
            </button>
          </div>
        </div>

        {active.length === 0 && standbyPriority.length === 0 ? (
          <div className={styles.emptyHint}>
            현재 실행 중인 분석 스트림이 없습니다.<br />
            아래 카메라 검색에서 분석을 시작해주세요.
          </div>
        ) : (
          <ul className={styles.list}>
            {/* 실행 중 스트림 */}
            {active.map(s => {
              const meta = streamMeta[s.camera_id];
              const now  = Date.now();
              const elapsed = meta ? now - meta.startedAt : 0;
              const stale   = meta ? (now - meta.lastFrameAt > STALE_MS) : false;
              const snapshotUrl = s.cctv_no ? `${API_URL}/cctv/${s.cctv_no}/snapshot` : null;
              const isChecked = selectedActive.has(s.camera_id);
              return (
                <li key={s.camera_id} className={`${styles.activeItem}${isChecked ? ` ${styles.selectedCard}` : ""}`}>
                  {/* 커스텀 체크박스 */}
                  <label className={styles.checkWrap} title="선택" style={{ padding: "2px 4px 2px 0" }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggleActiveCheck(s.camera_id)} style={{ display:"none" }} />
                    <span className={`${styles.customCheck}${isChecked ? ` ${styles.checked}` : ""}`} />
                  </label>
                  {snapshotUrl ? (
                    <button type="button" className={styles.previewBtn} onClick={() => setPlayingCam(s)}>
                      <img key={s.cctv_no!} className={styles.preview} src={snapshotUrl} alt={s.name} />
                      <span className={styles.playOverlay}><Play size={26} fill="white" /></span>
                    </button>
                  ) : (
                    <div className={`${styles.preview} ${styles.previewEmpty}`}>준비 중</div>
                  )}
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>
                      <span className={`${styles.statusDot} ${stale ? styles.statusInactive : styles.statusActive}`} />
                      {s.name}
                      {stale && <span className={styles.staleBadge}>● 스트림 끊김</span>}
                    </div>
                    <div className={styles.itemMeta}>프레임: <b>{s.frame_count}개</b>{meta && <> · 경과: <b>{formatElapsed(elapsed)}</b></>}</div>
                    {/* AI 분석 현황 */}
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
                      <span style={{ fontSize:11, padding:"2px 7px", borderRadius:999, background: s.analyzed_count > 0 ? "#f0fdf4" : "#f8fafc", color: s.analyzed_count > 0 ? "#16a34a" : "#94a3b8", border:`1px solid ${s.analyzed_count > 0 ? "#86efac" : "#e2e8f0"}`, fontWeight:700 }}>
                        AI {s.analyzed_count ?? 0}프레임 분석
                      </span>
                      <span style={{ fontSize:11, padding:"2px 7px", borderRadius:999, background: (s.keras_pass_count ?? 0) > 0 ? "#fff7ed" : "#f8fafc", color: (s.keras_pass_count ?? 0) > 0 ? "#ea580c" : "#94a3b8", border:`1px solid ${(s.keras_pass_count ?? 0) > 0 ? "#fed7aa" : "#e2e8f0"}`, fontWeight:700 }}>
                        Keras 의심 {s.keras_pass_count ?? 0}회
                      </span>
                      <span style={{ fontSize:11, padding:"2px 7px", borderRadius:999, background: (s.detection_count ?? 0) > 0 ? "#fff1f2" : "#f8fafc", color: (s.detection_count ?? 0) > 0 ? "#e11d48" : "#94a3b8", border:`1px solid ${(s.detection_count ?? 0) > 0 ? "#fecaca" : "#e2e8f0"}`, fontWeight:700 }}>
                        ⚠ 감지 {s.detection_count ?? 0}건
                      </span>
                    </div>
                    {s.last_analyzed_at && <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>마지막 분석: {s.last_analyzed_at}</div>}
                    <div className={styles.itemMetaSmall}>camera_id: {s.camera_id}</div>
                  </div>
                  <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={() => requestStop(s.camera_id, s.name)} disabled={busyCameraId === s.camera_id}>
                    <Square size={13} style={{ verticalAlign:"middle", marginRight:4 }} />중지
                  </button>
                </li>
              );
            })}

            {/* 주요 CCTV 대기 중 */}
            {standbyPriority.map(cam => (
              <li key={cam.camera_id} className={`${styles.item} ${styles.priorityItem}`}>
                <div className={styles.itemInfo}>
                  <div className={styles.itemName}>
                    <Star size={13} className={styles.priorityIcon} /> {cam.name}
                  </div>
                  <div className={styles.itemMeta}>대기 중 · ({cam.coord_x}, {cam.coord_y})</div>
                </div>
                <div className={styles.itemActions}>
                  <button className={`${styles.actionBtn} ${styles.startBtn}`} onClick={() => handleStart(cam)} disabled={busyCameraId === cam.camera_id}>
                    <Play size={13} style={{ verticalAlign:"middle", marginRight:4 }} />분석 시작
                  </button>
                  <button className={styles.iconActionBtn} onClick={() => togglePriorityCamera(cam)} title="주요 CCTV 해제">
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ② 카메라 검색 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <Search size={18} /> 카메라 검색
            {results.length > 0 && <span className={styles.badge}>{filteredResults.length}개</span>}
          </h2>
          {pagedResults.length > 0 && (() => {
            const allSel = pagedResults.length > 0 && pagedResults.every(c => selectedResult.has(c.camera_id));
            return (
              <div className={styles.bulkBar}>
                <button
                  className={`${styles.selectAllBtn}${allSel ? ` ${styles.allSelected}` : ""}`}
                  onClick={() => checkAllResult(pagedResults)}
                >
                  <span style={{ width:14, height:14, borderRadius:3, border:`2px solid ${allSel ? "#e11d48" : "currentColor"}`, background: allSel ? "#e11d48" : "transparent", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {allSel && <span style={{ width:4,height:7,border:"2px solid white",borderTop:"none",borderLeft:"none",transform:"rotate(45deg) translateY(-1px)",display:"block" }} />}
                  </span>
                  {allSel ? "전체 해제" : "전체 선택"}
                </button>
                {selectedResult.size > 0 && (
                  <button className={styles.bulkStartBtn} onClick={bulkStart} disabled={bulkLoading}>
                    <Play size={12} />
                    분석 시작
                    <span className={styles.selectedCount}>{selectedResult.size}</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        <div className={styles.searchForm}>
          <div className={styles.regionChips}>
            <MapPin size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            {REGIONS.map(r => (
              <button key={r.key} type="button"
                className={`${styles.chip} ${region === r.key ? styles.chipActive : ""}`}
                onClick={() => { setRegion(r.key); setResultPage(1); }}>
                {r.label}
              </button>
            ))}
          </div>
          <button className={`${styles.actionBtn} ${styles.startBtn}`} onClick={handleSearch} disabled={searching}>
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>

        {results.length > 0 && (
          <div className={styles.keywordRow}>
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input type="text" className={styles.keywordInput} value={keyword}
              onChange={e => { setKeyword(e.target.value); setResultPage(1); }}
              placeholder="카메라 이름으로 좁히기 (예: 판교, 서해안선)" />
            {keyword && (
              <button type="button" className={styles.keywordClear} onClick={() => { setKeyword(""); setResultPage(1); }} aria-label="검색어 지우기">
                <X size={13} />
              </button>
            )}
            <span className={styles.keywordCount}>{keyword ? `${filteredResults.length} / ${results.length}` : `${results.length}개`}</span>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.resultsBox}>
            {filteredResults.length === 0 ? (
              <div className={styles.emptyHint}><span className={styles.keywordQuote}>{keyword}</span>와 일치하는 카메라가 없습니다.</div>
            ) : (
              <ul className={styles.list}>
                {pagedResults.map(cam => {
                  const running   = activeIds.has(cam.camera_id);
                  const isChecked = selectedResult.has(cam.camera_id);
                  return (
                    <li key={cam.camera_id + cam.name} className={`${styles.item}${isChecked ? ` ${styles.selectedCard}` : ""}`}>
                      {/* 커스텀 체크박스 */}
                      <label className={styles.checkWrap} title={running ? "이미 분석 중" : "선택"} style={{ padding: "2px 4px 2px 0" }}>
                        <input type="checkbox" checked={isChecked} disabled={running} onChange={() => !running && toggleResultCheck(cam.camera_id)} style={{ display:"none" }} />
                        <span className={`${styles.customCheck}${isChecked ? ` ${styles.checked}` : ""}${running ? ` ${styles.checkedDisabled}` : ""}`} />
                      </label>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>{cam.name}</div>
                        <div className={styles.itemMeta}>({cam.coord_x}, {cam.coord_y}){running && " · 분석 중"}</div>
                      </div>
                      <div className={styles.itemActions}>
                        <button className={`${styles.actionBtn} ${running ? "" : styles.startBtn}`}
                          onClick={() => handleStart(cam)} disabled={running || busyCameraId === cam.camera_id}>
                          <Play size={13} style={{ verticalAlign:"middle", marginRight:4 }} />
                          {running ? "분석 중" : "분석 시작"}
                        </button>
                        <button className={`${styles.iconActionBtn} ${isPriorityCamera(cam.camera_id) ? styles.prioritySelected : ""}`}
                          onClick={() => togglePriorityCamera(cam)}
                          title={isPriorityCamera(cam.camera_id) ? "주요 CCTV 해제" : "주요 CCTV 등록"}>
                          <Star size={14} fill={isPriorityCamera(cam.camera_id) ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {filteredResults.length > RESULT_PAGE_SIZE && (
              <div className={styles.resultPager}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => setResultPage(p => Math.max(1, p - 1))}
                  disabled={currentResultPage <= 1}
                >
                  이전
                </button>
                <span className={styles.pageState}>{currentResultPage} / {resultTotalPages}</span>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => setResultPage(p => Math.min(resultTotalPages, p + 1))}
                  disabled={currentResultPage >= resultTotalPages}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 영상 재생 모달 */}
      {playingCam && (
        <div className={styles.modalOverlay} onClick={() => setPlayingCam(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><Cctv size={18} />{playingCam.name}</div>
              <button className={styles.modalClose} onClick={() => setPlayingCam(null)}><X size={20} /></button>
            </div>
            <div className={styles.modalVideo}>
              {playingCam.cctv_no
                ? <img src={`${API_URL}/cctv/${playingCam.cctv_no}/stream`} alt={playingCam.name} />
                : <div className={styles.previewEmpty}>영상을 불러올 수 없습니다</div>}
            </div>
            <div className={styles.modalFooter}>프레임: {playingCam.frame_count}개 · camera_id: {playingCam.camera_id}</div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!pendingStop} title="분석 중지"
        message={pendingStop ? `"${pendingStop.name}" 분석을 중지합니다.` : ""}
        confirmText="중지" cancelText="취소" danger
        onConfirm={confirmStop} onCancel={() => setPendingStop(null)} />
    </div>
  );
}
