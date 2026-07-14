"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import { Car, Video, AlertCircle, BellRing, Settings } from "lucide-react";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { useModal } from "@/context/ModalContext";

export default function AdminMainPage() {
  usePageTitle("관리자");
  const { showAlert } = useModal();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user.role !== "admin") {
          await showAlert("관리자 권한이 필요합니다.");
          router.push("/main");
        }
      } catch {
        router.push("/login");
      }
    })();
  }, [router]);

  // 관리자가 속한 회사의 데이터 예시
  const companyInfo = { name: "A 물류센터", manager: "팀원 C" };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{companyInfo.name} 관제 대시보드</h2>
        <p>환영합니다, {companyInfo.manager} 관리자님. 현재 사업장의 실시간 현황입니다.</p>
        <div className={styles.titleLine} /> {/* image_b0ac19.png 스타일 계승 */}
      </div>

      <div className={styles.statsGrid}>
        {/* 💡 실 사용자가 가장 궁금해할 정보 위주로 배치 */}
        <div className={styles.statCard}>
          <div className={styles.cardHeader}><Video size={18} /> 연결된 CCTV</div>
          <div className={styles.cardBody}><h3>12 / 12</h3><span className={styles.statusOn}>정상 운영 중</span></div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.cardHeader}><Car size={18} /> 오늘 출입 차량</div>
          <div className={styles.cardBody}><h3>145 대</h3><span className={styles.trend}>어제 대비 +5%</span></div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.cardHeader}><AlertCircle size={18} color="#e31e24" /> 과적/사고 감지</div>
          <div className={styles.cardBody}><h3 className={styles.alertText}>3 건</h3><button className={styles.viewBtn}>이력 확인</button></div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.cardHeader}><BellRing size={18} /> 읽지 않은 알림</div>
          <div className={styles.cardBody}><h3>2 건</h3><button className={styles.viewBtn}>알림함 가기</button></div>
        </div>
      </div>

      <div className={styles.contentSections}>
        <div className={styles.mainSection}>
          <h4>실시간 모니터링 요약</h4>
          <div className={styles.placeholderBox}>
            {/* 여기에 나중에 실시간 CCTV 미리보기나 그래프가 들어갈 자리 */}
            <p>실시간 차량 분석 데이터 차트 준비 중...</p>
          </div>
        </div>
        
        <div className={styles.sideSection}>
          <div className={styles.linkCard}><Settings size={20} /> 사업장 알림 설정</div>
          <div className={styles.linkCard}><Video size={20} /> 카메라 명칭 변경</div>
        </div>
      </div>
    </div>
  );
}