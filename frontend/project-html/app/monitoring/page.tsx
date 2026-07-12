"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./monitoring.module.css";
import toastStyles from "./toast.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

interface DetectionLog {
    id: number;
    time: string;
    cctv_name: string;
    class_name: string;
    confidence: number;
}

interface ToastAlert {
    id: string;
    type: "위험" | "주의";
    title: string;
    location: string;
    className: string;
}

interface Camera {
    cctv_no: number;
    name: string;
    stream_url: string;
    is_active: boolean;
}

// HTTP/스트림(MJPEG)은 같은-origin Next 프록시 경유 — 외부망에서도 동작
const API_URL = "/api/proxy";
// WebSocket은 Next 라우트로 프록시 불가 → 백엔드 직접 주소 사용 (LAN 또는 백엔드 외부노출 시에만 연결)
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL  = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://");

export default function MonitoringPage() {
    usePageTitle("모니터링");
  const { showAlert } = useModal();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [cameras,     setCameras]     = useState<Camera[]>([]);
    const [currentCctv, setCurrentCctv] = useState<Camera | null>(null);
    const [logs,        setLogs]        = useState<DetectionLog[]>([]);
    const [toasts,      setToasts]      = useState<ToastAlert[]>([]);
    const cameraMapRef = useRef<Map<number, string>>(new Map());

    // 관리자 권한 확인 — 과거 모니터링 URL로 직접 접근해도 관제 화면은 관리자만 허용
    useEffect(() => { void (async () => {
        const token = localStorage.getItem("access_token");
        if (!token) {
            router.push("/login");
            return;
        }
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

    // CCTV 목록 조회
    useEffect(() => { void (async () => {
        if (!authorized) return;

        fetch(`${API_URL}/cctv?active_only=true`)
            .then(r => r.json())
            .then(data => {
                const list: Camera[] = data?.data?.cctvs || [];
                setCameras(list);
                const map = new Map<number, string>();
                list.forEach(c => map.set(c.cctv_no, c.name));
                cameraMapRef.current = map;
                if (list.length > 0) setCurrentCctv(list[0]);
            })
            .catch(() => {});
      })(); }, [authorized]);

    // WebSocket 실시간 감지 알림
    useEffect(() => { void (async () => {
        if (!authorized) return;

        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        if (!token) return;

        const ws = new WebSocket(`${WS_URL}/ws/detections?token=${token}`);

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type !== "detection") return;
            const d = msg.data;

            const now      = new Date();
            const timeStr  = now.toTimeString().split(" ")[0];
            const cctvName = cameraMapRef.current.get(d.cctv_no) || `CCTV ${d.cctv_no}`;
            const cls      = d.class_name || `클래스 ${d.class_no}`;

            setLogs(prev => [{
                id:         d.detection_no,
                time:       timeStr,
                cctv_name:  cctvName,
                class_name: cls,
                confidence: Math.round((d.confidence || 0) * 100),
            }, ...prev.slice(0, 19)]);

            addToast("위험", cctvName, cls);
        };

        return () => { ws.close(); };
      })(); }, [authorized]);

    const addToast = (type: "위험" | "주의", location: string, className: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, type, title: "🚨 위험 차량 감지!", location, className }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    const streamUrl = currentCctv ? `${API_URL}/cctv/${currentCctv.cctv_no}/stream` : null;

    if (!authorized) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>통합 관제 시스템</h2>
                <p>실시간 CCTV 모니터링 및 AI 위협 감지 현황</p>
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.videoSection}>
                    <div className={styles.videoWrapper}>
                        {streamUrl ? (
                            <img
                                src={streamUrl}
                                alt="CCTV 스트림"
                                className={styles.videoPlayer}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        ) : (
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#888" }}>
                                활성화된 CCTV가 없습니다
                            </div>
                        )}

                        <div className={styles.videoOverlayTop}>
                            <span className={styles.liveBadge}>LIVE</span>
                            <span className={styles.cctvNameLabel}>{currentCctv?.name || ""}</span>
                        </div>

                        <div className={toastStyles.toastContainer}>
                            {toasts.map(toast => (
                                <div key={toast.id} className={`${toastStyles.toastCard} ${toast.type === "주의" ? toastStyles.warning : ""}`}>
                                    <div className={toastStyles.toastHeader}>
                                        <span className={toastStyles.toastTitle}>{toast.title}</span>
                                        <button className={toastStyles.closeBtn} onClick={() => removeToast(toast.id)}>×</button>
                                    </div>
                                    <div className={toastStyles.toastBody}>
                                        <p className={toastStyles.location}>{toast.location}</p>
                                        <p className={toastStyles.targetInfo}>감지 항목: {toast.className}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.videoControls}>
                        {cameras.map(cam => (
                            <button
                                key={cam.cctv_no}
                                className={`${styles.controlBtn} ${currentCctv?.cctv_no === cam.cctv_no ? styles.activeBtn : ""}`}
                                onClick={() => setCurrentCctv(cam)}
                            >
                                {cam.name}
                            </button>
                        ))}
                        {cameras.length === 0 && (
                            <span style={{ color:"#888", fontSize:"0.85rem" }}>활성 CCTV 없음</span>
                        )}
                    </div>
                </div>

                <div className={styles.logSection}>
                    <h3>🚨 실시간 AI 감지 로그</h3>
                    <div className={styles.logTableWrapper}>
                        <table className={styles.logTable}>
                            <thead>
                                <tr><th>시간</th><th>CCTV</th><th>감지 항목</th><th>신뢰도</th></tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign:"center", color:"#888" }}>감지 대기 중...</td></tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} className={styles["위험"]}>
                                        <td>{log.time}</td>
                                        <td>{log.cctv_name}</td>
                                        <td>{log.class_name}</td>
                                        <td><span className={`${styles.statusBadge} ${styles["위험"]}`}>{log.confidence}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
