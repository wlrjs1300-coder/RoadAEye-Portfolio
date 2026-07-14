"use client";
import React from "react";
import styles from "./info.module.css";
import { usePageTitle } from "@/app/hooks/usePageTitle";

export default function AboutInfoPage() {
  usePageTitle("개발 정보");
  return (
    <div className={styles.infoContainer}>
      <header className={styles.infoHeader}>
        <h1>개발 정보</h1>
        <p>고속도로 CCTV AI 위험차량 감지 시스템 (MBC 아카데미 AI-X 3기 최종 프로젝트)</p>
        <p>4개 서버 분산 구조: Front(localhost) / Back(localhost) / AI(localhost) / DB(localhost)</p>
        <p>조장 팀원 A | 부조장 이지건 | 조원 팀원 B, 팀원 C, 팀원 D</p>
      </header>

      {/* 1. 시스템 아키텍처 */}
      <section className={styles.infoSection}>
        <h2 className={styles.sectionTitle}>System Architecture</h2>
        <div className={styles.archFlow}>
          <div className={styles.archNode}>
            <div className={styles.archNodeBox}>
              <strong>ITS CCTV</strong>
              <span>국가 교통정보시스템</span>
            </div>
            <span className={styles.archNodeLabel}>실시간 스트림</span>
          </div>
          <span className={styles.archArrow}>→</span>
          <div className={styles.archNode}>
            <div className={`${styles.archNodeBox} ${styles.highlight}`}>
              <strong>AI server</strong>
              <span>YOLOv11 · FastAPI</span>
              <span>localhost</span>
            </div>
            <span className={styles.archNodeLabel}>객체 탐지 · 분류</span>
          </div>
          <span className={styles.archArrow}>→</span>
          <div className={styles.archNode}>
            <div className={styles.archNodeBox}>
              <strong>Backend API</strong>
              <span>FastAPI · Python</span>
              <span>localhost</span>
            </div>
            <span className={styles.archNodeLabel}>REST API · 비즈니스 로직</span>
          </div>
          <span className={styles.archArrow}>→</span>
          <div className={styles.archNode}>
            <div className={styles.archNodeBox}>
              <strong>DB server</strong>
              <span>MySQL 8.0</span>
              <span>localhost</span>
            </div>
            <span className={styles.archNodeLabel}>감지 기록 · 사용자 정보</span>
          </div>
          <span className={styles.archArrow}>→</span>
          <div className={styles.archNode}>
            <div className={`${styles.archNodeBox} ${styles.highlight}`}>
              <strong>Frontend</strong>
              <span>Next.js 16 · SSE</span>
              <span>localhost</span>
            </div>
            <span className={styles.archNodeLabel}>관제 대시보드 · 알림</span>
          </div>
        </div>
      </section>

      {/* 2. 기술 스택 */}
      <section className={styles.infoSection}>
        <h2 className={styles.sectionTitle}>Tech Stack</h2>
        <div className={styles.techGridPlaceholder}>
          <div className={styles.dummyCard}>
            <h3>Frontend</h3>
            <p>Next.js 16 (App Router)</p>
            <p>TypeScript · CSS Modules</p>
            <p>SSE 스트리밍 · 실시간 대시보드</p>
          </div>
          <div className={styles.dummyCard}>
            <h3>Backend</h3>
            <p>FastAPI (Python 3.11)</p>
            <p>MySQL 8.0 · SQLAlchemy</p>
            <p>JWT 인증 · REST API</p>
          </div>
          <div className={styles.dummyCard}>
            <h3>AI &amp; Infra</h3>
            <p>YOLOv11 (Ultralytics)</p>
            <p>OpenCV · CUDA GPU</p>
            <p>진입 금지 차량 탐지</p>
          </div>
        </div>
      </section>

      {/* 3. 팀원 */}
      <section className={styles.infoSection}>
        <h2 className={styles.sectionTitle}>Team Members</h2>
        <div className={styles.teamGrid5}>
          <div className={styles.dummyMemberCard}>
            <strong>PM / DB</strong>
            <p>팀원 A</p>
            <span>프로젝트 총괄 · 기획 · 발표</span>
          </div>
          <div className={styles.dummyMemberCard}>
            <strong>AI Engineer</strong>
            <p>이지건</p>
            <span>YOLOv11 학습 · AI 서버 개발</span>
          </div>
          <div className={styles.dummyMemberCard}>
            <strong>AI Engineer</strong>
            <p>팀원 B</p>
            <span>데이터 수집 · 모델 검증</span>
          </div>
          <div className={styles.dummyMemberCard}>
            <strong>Frontend Lead</strong>
            <p>팀원 C</p>
            <span>Next.js UI · 대시보드 개발</span>
          </div>
          <div className={styles.dummyMemberCard}>
            <strong>Backend</strong>
            <p>팀원 D</p>
            <span>FastAPI · DB 설계 · 인증</span>
          </div>
        </div>
      </section>
    </div>
  );
}
