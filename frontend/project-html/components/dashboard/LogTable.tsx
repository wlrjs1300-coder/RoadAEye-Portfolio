"use client";

import React, { useState, useEffect } from "react";
import { Search, Download, Filter } from "lucide-react";
import styles from "./LogTable.module.css";

interface LogItem {
    detection_no: number;
    detected_at:  string;
    cctv_name:    string;
    class_name:   string;
    confidence:   number;
    status:       string;
}

// 같은-origin Next 프록시 경유 — 브라우저가 사설 IP로 직접 접근하지 않도록 함
const API_URL = "/api/proxy";

const STATUS_LABEL: Record<string, string> = {
    UNREAD:    "미처리",
    CONFIRMED: "처리완료",
    DISMISSED: "기각",     // 이전 "확인중"은 DISMISSED 의미와 맞지 않음 — 기각 처리된 감지
};

function formatTime(iso: string): string {
    const d = new Date(iso);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0")).join(":");
}

export default function LogTable() {
    const [logs,    setLogs]    = useState<LogItem[]>([]);
    const [total,   setTotal]   = useState<number>(0);
    const [search,  setSearch]  = useState<string>("");

    const fetchLogs = () => {
        fetch(`${API_URL}/cctv/detections?per_page=20`)
            .then(r => r.json())
            .then(d => {
                setLogs(d?.data?.items || []);
                setTotal(d?.data?.total || 0);
            })
            .catch(() => {});
    };

    useEffect(() => {
        fetchLogs();
        const timer = setInterval(fetchLogs, 30000);
        return () => clearInterval(timer);
    }, []);

    const filtered = search
        ? logs.filter(l =>
            l.cctv_name?.includes(search) ||
            l.class_name?.includes(search)
          )
        : logs;

    return (
        <div className={styles.container}>
            <div className={styles.tableHeader}>
                <div className={styles.left}>
                    <h3>실시간 감지 로그</h3>
                    <span className={styles.count}>Total: {total.toLocaleString()}</span>
                </div>
                <div className={styles.actions}>
                    <div className={styles.searchBox}>
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="로그 검색..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button className={styles.iconBtn} disabled title="준비 중인 기능입니다"><Filter size={18} /></button>
                    <button className={styles.iconBtn} disabled title="준비 중인 기능입니다"><Download size={18} /></button>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>감지 시간</th>
                            <th>발생 위치</th>
                            <th>위험 유형</th>
                            <th>신뢰도</th>
                            <th>상태</th>
                            <th>상세보기</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign:"center", color:"#888" }}>감지 기록 없음</td></tr>
                        ) : filtered.map(log => (
                            <tr key={log.detection_no}>
                                <td>{formatTime(log.detected_at)}</td>
                                <td>{log.cctv_name || "-"}</td>
                                <td><span className={styles.typeTag}>{log.class_name}</span></td>
                                <td><span className={styles.confText}>{(log.confidence * 100).toFixed(1)}%</span></td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles[log.status]}`}>
                                        {STATUS_LABEL[log.status] || log.status}
                                    </span>
                                </td>
                                <td><button className={styles.detailBtn} disabled title="준비 중인 기능입니다">조회</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
