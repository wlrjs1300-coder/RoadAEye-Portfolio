"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AlertList from "@/components/dashboard/AlertList";
import CCTVView from "@/components/dashboard/CCTVView";
import TopStats from "@/components/dashboard/TopStats";
import styles from "./main.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

type CctvFocusTarget = {
  requestId: number;
  cctv_no?: number | null;
  its_cctv_id?: string | null;
  camera_id?: string | null;
  cctv_name?: string | null;
  name?: string | null;
};

export default function DashboardPage() {
  usePageTitle("대시보드");
  const { showAlert } = useModal();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [focusTarget, setFocusTarget] = useState<CctvFocusTarget | null>(null);

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

  if (!authorized) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.topSection}>
          <TopStats />
        </div>
        <div className={styles.middleSection}>
          <div className={styles.cctvArea}>
            <CCTVView focusTarget={focusTarget} />
          </div>
          <div className={styles.alertArea}>
            <AlertList
              onAlertSelect={(alert) => {
                setFocusTarget({ ...alert, requestId: Date.now() });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
