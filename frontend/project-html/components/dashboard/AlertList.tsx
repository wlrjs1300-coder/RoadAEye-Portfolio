"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Clock, MapPin } from "lucide-react";
import styles from "./AlertList.module.css";

interface AlertItem {
    detection_no: number;
    class_name:   string;
    cctv_name:    string;
    detected_at:  string;
    status:       string;
    cctv_no?:     number | null;
    its_cctv_id?: string | null;
    camera_id?:   string | null;
}

interface AlertSelectTarget {
    cctv_no?: number | null;
    its_cctv_id?: string | null;
    camera_id?: string | null;
    cctv_name?: string | null;
    name?: string | null;
}

interface AlertListProps {
    onAlertSelect?: (target: AlertSelectTarget) => void;
}

interface ActiveStream {
    camera_id: string;
    name: string;
    cctv_no?: number | null;
}

interface DetectionItem {
    class_name: string;
    class_no?: number;
    confidence: number;
    box: { x1: number; y1: number; x2: number; y2: number };
}

interface FrameResult {
    camera_id: string;
    camera_name: string;
    timestamp: string;
    total_detections: number;
    forbidden_detections: DetectionItem[];
}

type ConnState = "connecting" | "open" | "closed" | "error";

// HTTP fetch는 같은-origin Next 프록시 경유 (외부망에서도 동작)
const API_URL = "/api/proxy";
// WebSocket은 Next 라우트로 프록시 불가 → 백엔드 직접 주소 사용 (LAN 또는 백엔드 외부노출 시에만 연결됨)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// fetch는 status=UNREAD만 받으므로 모든 알림은 "critical" 레벨로 고정 표시
const ALERT_LEVEL = "critical";

function formatTime(iso: string): string {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
}

// WebSocket으로 받은 알림은 DB에 아직 없을 수 있어 임시 음수 ID 사용 (DB 알림과 충돌 방지)
const wsTempId = (() => { let n = -1; return () => n--; })();
const MAX_ALERTS = 5;
const LIVE_DUP_WINDOW_MS = 5000;

// WebSocket(AI 서버 → 백엔드 프록시 → 여기) 연결 상태별 라벨
// CCTVView의 정적 "LIVE" 라벨과 구분되도록 "알림" 명시
const LIVE_STATE_LABEL: Record<string, string> = {
    open:       "실시간 알림 LIVE",
    connecting: "알림 연결 중",
    closed:     "알림 오프라인",
    error:      "알림 오류",
};

function deriveWsBase(): string {
    const explicit = typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL;
    if (explicit) return explicit;
    return BACKEND_URL.replace(/^http(s?):/i, (_m, s) => `ws${s}:`);
}

function toIsoTimestamp(value?: string): string {
    if (!value) return new Date().toISOString();
    return value.includes("T") ? value : value.replace(" ", "T");
}

function streamSignature(streams: ActiveStream[]): string {
    return streams
        .map(s => `${s.camera_id}:${s.cctv_no ?? ""}:${s.name}`)
        .sort()
        .join("|");
}

export default function AlertList({ onAlertSelect }: AlertListProps) {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [activeStreams, setActiveStreams] = useState<ActiveStream[]>([]);
    const [wsState, setWsState] = useState<ConnState>("closed");
    const recentLiveKeyRef = useRef<Map<string, number>>(new Map());

    const fetchAlerts = () => {
        fetch(`${API_URL}/cctv/detections?per_page=5&status=UNREAD`, { signal: AbortSignal.timeout(5000) })
            .then(r => r.json())
            .then(data => {
                const dbItems: AlertItem[] = data?.data?.items || [];
                setAlerts(prev => {
                    const liveItems = prev.filter(item => item.detection_no < 0);
                    return [...liveItems, ...dbItems].slice(0, MAX_ALERTS);
                });
            })
            .catch(() => {});
    };

    // 활성 스트림 전체를 구독. 주요 8개 CCTV가 모두 실시간 알림 대상이 된다.
    const fetchActiveStreams = () => {
        fetch(`${API_URL}/its/stream/status`, { signal: AbortSignal.timeout(5000) })
            .then(r => r.json())
            .then(d => {
                const streams: ActiveStream[] = (d?.streams || [])
                    .filter((s: any) => s.is_active && s.camera_id)
                    .map((s: any) => ({
                        camera_id: String(s.camera_id),
                        name: s.name || s.camera_id,
                        cctv_no: s.cctv_no ?? null,
                    }));
                setActiveStreams(prev => (
                    streamSignature(prev) === streamSignature(streams) ? prev : streams
                ));
            })
            .catch(() => setActiveStreams([]));
    };

    useEffect(() => {
        fetchAlerts();
        fetchActiveStreams();
        const t1 = setInterval(fetchAlerts, 30000);
        const t2 = setInterval(fetchActiveStreams, 10000); // 10초마다 활성 스트림 재확인
        return () => { clearInterval(t1); clearInterval(t2); };
    }, []);

    const pushForbiddenFrame = useCallback((frame: FrameResult) => {
        if (!frame?.forbidden_detections?.length) return;

        const stream = activeStreams.find(s => s.camera_id === frame.camera_id);
        const now = Date.now();
        const newItems: AlertItem[] = [];

        for (const d of frame.forbidden_detections) {
            const dedupeKey = `${frame.camera_id}:${d.class_name}`;
            const lastAt = recentLiveKeyRef.current.get(dedupeKey) || 0;
            if (now - lastAt < LIVE_DUP_WINDOW_MS) continue;
            recentLiveKeyRef.current.set(dedupeKey, now);

            newItems.push({
                detection_no: wsTempId(),
                class_name:   d.class_name,
                cctv_name:    frame.camera_name || stream?.name || "카메라",
                detected_at:  toIsoTimestamp(frame.timestamp),
                status:       "UNREAD",
                cctv_no:      stream?.cctv_no ?? null,
                camera_id:    frame.camera_id,
                its_cctv_id:  frame.camera_id,
            });
        }

        if (newItems.length > 0) {
            setAlerts(prev => [...newItems, ...prev].slice(0, MAX_ALERTS));
        }
    }, [activeStreams]);

    // 주요 CCTV 전체 WebSocket 구독 (백엔드 프록시 경유)
    useEffect(() => {
        if (activeStreams.length === 0) {
            setWsState("closed");
            return;
        }

        const wsBase = deriveWsBase();
        const sockets: WebSocket[] = [];
        let cancelled = false;
        let openCount = 0;
        let closedCount = 0;
        let errorCount = 0;
        const total = activeStreams.length;

        const updateState = () => {
            if (cancelled) return;
            if (openCount > 0) setWsState("open");
            else if (errorCount > 0) setWsState("error");
            else if (closedCount >= total) setWsState("closed");
            else setWsState("connecting");
        };

        setWsState("connecting");
        for (const stream of activeStreams) {
            try {
                const ws = new WebSocket(`${wsBase}/its/ws/${encodeURIComponent(stream.camera_id)}`);
                sockets.push(ws);

                ws.onopen = () => {
                    openCount += 1;
                    updateState();
                };
                ws.onmessage = (ev) => {
                    if (cancelled) return;
                    try {
                        pushForbiddenFrame(JSON.parse(ev.data) as FrameResult);
                    } catch {}
                };
                ws.onerror = () => {
                    errorCount += 1;
                    updateState();
                };
                ws.onclose = () => {
                    closedCount += 1;
                    if (openCount > 0) openCount -= 1;
                    updateState();
                };
            } catch {
                errorCount += 1;
                updateState();
            }
        }

        return () => {
            cancelled = true;
            for (const ws of sockets) {
                try { ws.close(); } catch {}
            }
        };
    }, [activeStreams, pushForbiddenFrame]);

    // CCTVView의 웹캠 분석 결과도 동일한 최근 위험 알림 목록에 반영
    useEffect(() => {
        const handleWebcamForbidden = (event: Event) => {
            const frame = (event as CustomEvent<FrameResult>).detail;
            pushForbiddenFrame(frame);
        };
        window.addEventListener("roadeye-webcam-forbidden", handleWebcamForbidden as EventListener);
        return () => {
            window.removeEventListener("roadeye-webcam-forbidden", handleWebcamForbidden as EventListener);
        };
    }, [pushForbiddenFrame]);

    const liveLabel = wsState === "open"
        ? `${LIVE_STATE_LABEL.open} (${activeStreams.length})`
        : LIVE_STATE_LABEL[wsState] || wsState;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <Bell size={24} className={styles.headerIcon} />
                    <h3>최근 위험 알림</h3>
                    <span className={`${styles.liveBadge} ${styles[`live_${wsState}`]}`}>
                        ● {liveLabel}
                    </span>
                </div>
                <Link href="/analysis/detections" className={styles.viewAll}>전체 보기</Link>
            </div>

            <div className={styles.listContainer}>
                {alerts.length === 0 ? (
                    <div className={styles.emptyState}>감지 기록 없음</div>
                ) : alerts.map(alert => (
                    <button
                        key={alert.detection_no}
                        type="button"
                        className={`${styles.alertItem} ${styles[ALERT_LEVEL]}`}
                        onClick={() => onAlertSelect?.({
                            cctv_no: alert.cctv_no,
                            its_cctv_id: alert.its_cctv_id,
                            camera_id: alert.camera_id,
                            cctv_name: alert.cctv_name,
                            name: alert.cctv_name,
                        })}
                        title="해당 CCTV 보기"
                    >
                        <div className={styles.iconWrapper}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className={styles.info}>
                            <div className={styles.topRow}>
                                <span className={styles.type}>{alert.class_name}</span>
                                <span className={styles.time}>
                                    <Clock size={24} /> {formatTime(alert.detected_at)}
                                </span>
                            </div>
                            <div className={styles.bottomRow}>
                                <span className={styles.location}>
                                    <MapPin size={24} /> {alert.cctv_name || "-"}
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
