"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import styles from "./status.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

const API_URL = "/api/proxy";

interface DailyStats {
    total:     number;
    by_status: { UNREAD: number; CONFIRMED: number; DISMISSED: number };
    by_cctv:   { cctv_no: number; name: string; count: number }[];
}

export default function StatusPage() {
    usePageTitle("모니터링 현황");
  const { showAlert } = useModal();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [stats,    setStats]    = useState<DailyStats | null>(null);
    const [unread,   setUnread]   = useState<number>(0);
    const [lastTime, setLastTime] = useState<string>("-");

    // 관리자 권한 확인 — 통합 관제 시스템 페이지는 관리자만 접근 가능
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

    useEffect(() => { void (async () => {
        if (!authorized) return;

        fetch(`${API_URL}/cctv/stats/daily`)
            .then(r => r.json())
            .then(d => setStats(d?.data || null))
            .catch(() => {});

        fetch(`${API_URL}/cctv/stats/unread`)
            .then(r => r.json())
            .then(d => setUnread(d?.data?.unread_count || 0))
            .catch(() => {});

        fetch(`${API_URL}/cctv/detections?per_page=1`)
            .then(r => r.json())
            .then(d => {
                const items = d?.data?.items || [];
                if (items.length > 0) {
                    const dt = new Date(items[0].detected_at);
                    setLastTime([dt.getHours(), dt.getMinutes(), dt.getSeconds()]
                        .map(n => String(n).padStart(2, "0")).join(":"));
                }
            })
            .catch(() => {});
      })(); }, [authorized]);

    const total      = stats?.total || 0;
    const unreadPct  = total > 0 ? ((stats?.by_status?.UNREAD || 0) / total * 100).toFixed(1) : "0.0";
    const chartData  = (stats?.by_cctv || []).map(r => ({ name: r.name, count: r.count }));

    if (!authorized) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>통합 관제 감지 현황</h1>
                <p className={styles.subtitle}>
                    실시간으로 수집되는 도로 위 위험 차량 및 위반 사례에 대한 통계 정보를 시각화하여 제공합니다.
                </p>
            </div>

            <section className={styles.statsGrid}>
                <div className={styles.card}>
                    <h3>오늘 총 감지 건수</h3>
                    <p className={styles.value}>{total}건</p>
                </div>
                <div className={styles.card}>
                    <h3>미확인 감지 비율</h3>
                    <p className={styles.value}>{unreadPct}%</p>
                </div>
                <div className={styles.card}>
                    <h3>최근 감지 시간</h3>
                    <p className={styles.value}>{lastTime}</p>
                </div>
            </section>

            <section className={styles.chartSection}>
                <h3 style={{ marginBottom:"20px" }}>CCTV별 감지 건수</h3>
                <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="name" stroke="#888" />
                            <YAxis stroke="#888" />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#e11d48" strokeWidth={3} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
