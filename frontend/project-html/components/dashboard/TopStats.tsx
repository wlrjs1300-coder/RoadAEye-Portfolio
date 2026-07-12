"use client";

import React, { useState, useEffect } from "react";
import { Activity, Car, Video, Target, ShieldCheck } from "lucide-react";
import styles from "./TopStats.module.css";

// 같은-origin Next 프록시 경유 — 브라우저가 사설 IP로 직접 접근하지 않도록 함
const API_URL = "/api/proxy";

export default function TopStats() {
    const [total,       setTotal]       = useState<number>(0);
    const [unread,      setUnread]      = useState<number>(0);
    const [activeCctv,  setActiveCctv]  = useState<number>(0);
    const [totalCctv,   setTotalCctv]   = useState<number>(0);
    const [healthy,     setHealthy]     = useState<boolean>(true);
    // AI 모델 정확도 — 활성 모델 점수를 동적으로 표시 (이전엔 "94.7%" 하드코딩)
    const [aiAccuracy,  setAiAccuracy]  = useState<string>("—");
    const [aiAccuracyLabel, setAiAccuracyLabel] = useState<string>("등록된 모델 없음");
    const [aiTrend,     setAiTrend]     = useState<string>("—");

    useEffect(() => {
        fetch(`${API_URL}/cctv/stats/daily`)
            .then(r => r.json())
            .then(d => setTotal(d?.data?.total || 0))
            .catch(() => {});

        fetch(`${API_URL}/cctv/stats/unread`)
            .then(r => r.json())
            .then(d => setUnread(d?.data?.unread_count || 0))
            .catch(() => {});

        fetch(`${API_URL}/cctv`)
            .then(r => r.json())
            .then(d => {
                const list = d?.data?.cctvs || [];
                setTotalCctv(list.length);
                setActiveCctv(list.filter((c: any) => c.is_active).length);
            })
            .catch(() => {});

        fetch(`${API_URL}/health`)
            .then(r => r.ok ? setHealthy(true) : setHealthy(false))
            .catch(() => setHealthy(false));

        // 활성 AI 모델의 성능 지표 — mAP 우선, 없으면 precision으로 fallback
        fetch(`${API_URL}/models/active`)
            .then(r => r.json())
            .then(d => {
                const m = d?.data?.models?.[0];
                if (!m) return; // 활성 모델 없음 → 기본값("—") 유지
                const map = m.map_score, prec = m.precision_score;
                const score = map ?? prec;
                if (score == null) {
                    setAiAccuracy("—");
                    setAiAccuracyLabel(`${m.model_name} ${m.version}`);
                } else {
                    setAiAccuracy(`${(Number(score) * 100).toFixed(1)}%`);
                    setAiAccuracyLabel(map != null ? `mAP · ${m.model_name} ${m.version}` : `Precision · ${m.model_name} ${m.version}`);
                }
                setAiTrend(m.model_name || "활성");
            })
            .catch(() => {});
    }, []);

    const stats = [
        {
            id: 1, label: "오늘 감지 수",
            value: `${total}건`, trend: "실시간", trendDir: "up",
            icon: <Activity size={24} />, sub: "전체 감지 건수",
        },
        {
            id: 2, label: "미확인 감지",
            value: `${unread}건`, trend: "확인 필요", trendDir: "up",
            icon: <Car size={24} />, sub: "미처리 위험 감지",
        },
        {
            id: 3, label: "활성 CCTV",
            value: `${activeCctv}/${totalCctv}`, trend: "온라인/전체", trendDir: "neutral",
            icon: <Video size={24} />, sub: "정상 작동 중",
        },
        {
            id: 4, label: "AI 정확도",
            value: aiAccuracy, trend: aiTrend, trendDir: "up",
            icon: <Target size={24} />, sub: aiAccuracyLabel,
        },
        {
            id: 5, label: "시스템 상태",
            value: healthy ? "정상" : "점검 중", trend: healthy ? "● LIVE" : "● 오류",
            trendDir: healthy ? "safe" : "up",
            icon: <ShieldCheck size={24} />, sub: healthy ? "모든 시스템 정상" : "백엔드 확인 필요",
        },
    ];

    return (
        <div className={styles.container}>
            {stats.map(item => (
                <div key={item.id} className={styles.statCard}>
                    <div className={styles.header}>
                        <span className={styles.iconWrapper}>{item.icon}</span>
                        <span className={`${styles.trend} ${styles[item.trendDir]}`}>{item.trend}</span>
                    </div>
                    <div className={styles.body}>
                        <p className={styles.label}>{item.label}</p>
                        <h2 className={styles.value}>{item.value}</h2>
                        <p className={styles.sub}>{item.sub}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
