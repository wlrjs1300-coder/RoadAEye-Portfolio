"use client";

import React from "react";
import styles from "./intro.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function AboutInfoPage() {
  usePageTitle("프로젝트 소개");
  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.mainTitle}>
          ROAD <span className={styles.red}>A</span> EYE
        </h1>
        <p className={styles.slogan}>AI 기술로 대한민국 고속도로의 안전을 관제하다</p>
      </div>

      <div className={styles.contentGrid}>
        {/* 섹션 1: 프로젝트 개요 */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Project Overview</h2>
          <p className={styles.cardText}>
            <strong>Road A Eye</strong>는 인공지능(AI) 기반의 고속도로 스마트 관제 솔루션입니다.
            기존의 수동적인 CCTV 모니터링 한계를 극복하고, 도로 위에서 발생하는 실시간
            위험 상황을 정밀하게 탐지하여 더욱 안전한 도로 환경을 구축하고자 시작되었습니다.
          </p>
        </div>

        {/* 섹션 2: 핵심 기술 */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Core Technology</h2>
          <p className={styles.cardText}>
            실시간 CCTV 영상 데이터를 활용하여 <strong>YOLO 기반 차종 분류(Vehicle Classification)</strong> 모델을
            적용했습니다. 고속으로 주행하는 차량들의 실시간 객체 인식 및 트래킹을 통해,
            단순한 영상 기록을 넘어 의미 있는 통계 데이터와 위험 예측 모델을 도출합니다.
          </p>
        </div>

        {/* 섹션 3: 주요 기능 */}
        <div className={styles.cardFull}>
          <h2 className={styles.cardTitle}>Key Capabilities</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureItem}>
              <h3>01. 실시간 차량 탐지</h3>
              <p>CCTV 스트리밍 피드를 분석하여 고속도로 위의 승용차, 화물차, 버스 등 실시간 차량 분류 및 추적</p>
            </div>
            <div className={styles.featureItem}>
              <h3>02. 도로 안전 모니터링</h3>
              <p>정체 구간, 사고 발생 구역, 정지 차량 등 위험 요소를 사전에 감지하여 대형 사고 예방 기여</p>
            </div>
            <div className={styles.featureItem}>
              <h3>03. 직관적인 관리자 대시보드</h3>
              <p>통계 데이터를 가시화하고 실시간 알림 시스템을 제공하여 관제 요원의 신속한 의사결정 지원</p>
            </div>
          </div>
        </div>

        {/* 섹션 4: 비전 */}
        <div className={styles.cardFull}>
          <div className={styles.visionSection}>
            <h2 className={styles.visionTitle}>Our Vision</h2>
            <p className={styles.visionText}>
              "인공지능의 눈으로 도로 위의 모든 생명을 지키는 것, 그것이 <strong>Road A Eye</strong>의 궁극적인 지향점입니다."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}