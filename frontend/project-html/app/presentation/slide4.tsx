'use client';
// Chapter 2 - 프로젝트 일정
import { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './presentation.module.css';

const phaseNotes = [
  ['기획·구축', '1~4주차', '주제 선정, 개발 환경 구축, 서버·DB·AI 인프라 구성'],
  ['통합·고도화', '5~7주차', '프론트 통합, AI 모델 실험, 1·2차 중간발표와 시연 준비'],
  ['유지보수', '8~10주차', '오류 수정, 시연 데이터 안정화, 발표 흐름과 배포 상태 점검'],
  ['최종 발표', '7월 7일', '최종 검수 후 ROAD A EYE 프로젝트 발표'],
];

const weeklyWorks = [
  { week: '1주차', period: '4/27-5/1', title: '기획 확정', works: ['프로젝트 주제 선정', '핵심 기능·서비스 범위 정의'], tone: 'gray' },
  { week: '2주차', period: '5/4-5/8', title: '환경 구축', works: ['Front/Back 개발 환경 세팅', 'DB·AI 서버 기본 인프라 구성'], tone: 'gray' },
  { week: '3주차', period: '5/11-5/15', title: '기본 구조 개발', works: ['회원·게시판·관제 기본 화면 구축', 'CCTV/AI 데이터 수집 시작'], tone: 'gray' },
  { week: '4주차', period: '5/18-5/22', title: '핵심 기능 구현', works: ['DB 이중화 및 API 연동', 'Keras·YOLO 1차 성능 검증'], tone: 'gray' },
  { week: '5주차', period: '5/25-5/29', title: '실시간 관제 통합', works: ['ITS CCTV 스트림 관리 구현', 'YOLOv8·YOLOv11·Keras 비교'], tone: 'blue' },
  { week: '6주차', period: '6/1-6/5', title: '1차 중간발표', works: ['통합 테스트·디버깅', '1차 발표자료 정리'], tone: 'blue', badge: '6/5' },
  { week: '7주차', period: '6/8-6/12', title: '2차 중간발표', works: ['시연 흐름 보완', '2차 발표자료·대시보드 최종 정리'], tone: 'blue', badge: '6/12' },
  { week: '8주차', period: '6/15-6/19', title: '유지보수 1', works: ['UI/UX 수정 요청 반영', '사진 기반 AI 시연 화면 안정화'], tone: 'green' },
  { week: '9주차', period: '6/22-6/26', title: '유지보수 2', works: ['오류·데이터 표시 점검', '시연 영상·발표 대본 보강'], tone: 'green' },
  { week: '10주차', period: '6/29-7/3', title: '최종 점검', works: ['배포 상태 확인', '최종 리허설 및 질의응답 준비'], tone: 'green' },
  { week: '11주차', period: '7/6-7/7', title: '최종 발표', works: ['최종 검수', '7월 7일 프로젝트 발표'], tone: 'red', badge: '7/7' },
];

const toneMap = {
  gray: { bg: '#f5f7fa', border: '#d5dee8', head: '#64748b', text: '#334155' },
  blue: { bg: '#edf5ff', border: '#9bc4ea', head: '#2563eb', text: '#173f6b' },
  green: { bg: '#ecfdf5', border: '#8ee6b5', head: '#0f9f6e', text: '#0f5132' },
  red: { bg: '#fff1f2', border: '#fda4af', head: '#e11d48', text: '#8a1029' },
} as const;

type Tone = keyof typeof toneMap;
const phaseColors = ['#64748b', '#2563eb', '#10b981', '#e11d48'];

export default function Chapter2() {
  const [modalOpen, setModalOpen] = useState(false);
  const modal = modalOpen ? createPortal(
    <div
      onClick={() => setModalOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(10,20,40,0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          padding: '8px 10px',
          width: '96vw', maxWidth: 1500,
          position: 'relative',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 950, color: '#172033' }}>유지보수 보고서</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>· 8~10주차</span>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: 6,
              width: 26, height: 26, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#475569', fontWeight: 900, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* 이미지 2개 나란히 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[1, 2].map((n) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 850, color: '#94a3b8', textAlign: 'center' }}>보고서 {n}</div>
              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid #e2eaf0',
                background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={`/images/maintenance${n}.jpg`}
                  alt={`유지보수 보고서 ${n}`}
                  style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={styles.slide}>
      {modal}

      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', height: '100%', boxSizing: 'border-box', padding: '0 48px', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 80 }}>
          <div className={styles.chapterBadge} style={{ padding: '6px 13px', minWidth: 82, fontSize: 13 }}>Chapter 2</div>
          <h1 style={{ fontSize: 39, fontWeight: 850, marginTop: 15, marginBottom: 10, lineHeight: 1.16 }}>프로젝트 일정</h1>
          <div style={{ width: 60, height: 3, background: '#2c3e50', marginBottom: 12 }} />
          <p style={{ fontSize: 16, color: '#555', margin: '0 0 20px', fontWeight: 750 }}>4월 4주차부터 7월 7일 최종 발표까지</p>

          <div style={{ display: 'grid', gap: 12 }}>
            {phaseNotes.map(([phase, period, text], index) => {
              const isMaintenance = index === 2;
              return (
                <div
                  key={phase}
                  onClick={isMaintenance ? (e) => { e.stopPropagation(); setModalOpen(true); } : undefined}
                  style={{
                    background: '#fff',
                    border: isMaintenance ? '2px solid #10b981' : '1px solid #e2eaf0',
                    borderRadius: 15,
                    padding: '14px 15px',
                    boxShadow: isMaintenance ? '0 5px 20px rgba(16,185,129,0.18)' : '0 5px 16px rgba(91,140,174,0.10)',
                    cursor: isMaintenance ? 'pointer' : 'default',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={isMaintenance ? (e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(16,185,129,0.28)';
                  } : undefined}
                  onMouseLeave={isMaintenance ? (e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 5px 20px rgba(16,185,129,0.18)';
                  } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: phaseColors[index], color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 950 }}>{index + 1}</span>
                    <span style={{ fontSize: 18, fontWeight: 950, color: '#172033' }}>{phase}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 900, color: '#64748b' }}>{period}</span>
                    {isMaintenance && (
                      <span style={{ background: '#10b981', color: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11.5, fontWeight: 900, marginLeft: 4 }}>
                        보고서 보기 →
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 15.3, lineHeight: 1.42, fontWeight: 780, color: '#475569' }}>{text}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 68, paddingBottom: 42 }}>
          <div style={{ width: '100%', maxWidth: 850, height: '100%', background: '#fff', borderRadius: 18, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5edf4', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 950, color: '#172033' }}>주차별 실행 내역</div>
                <div style={{ fontSize: 13.4, fontWeight: 760, color: '#718096', marginTop: 2 }}>각 주차에 실제 진행한 작업과 발표 일정을 함께 정리</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 5.5, flex: 1 }}>
              {weeklyWorks.map((week) => {
                const tone = toneMap[week.tone as Tone];
                return (
                  <div key={`${week.week}-${week.period}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '58px 78px 148px 1fr', gap: 9, alignItems: 'center', background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 11, padding: '6px 10px', minHeight: 44, overflow: 'hidden' }}>
                    {week.badge && <div style={{ position: 'absolute', top: 7, right: 9, background: tone.head, color: '#fff', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, fontWeight: 950 }}>{week.badge}</div>}
                    <div style={{ color: tone.head, fontSize: 13.8, fontWeight: 950, textAlign: 'center' }}>{week.week}</div>
                    <div style={{ color: '#64748b', fontSize: 11.4, fontWeight: 850, fontFamily: 'monospace', textAlign: 'center' }}>{week.period}</div>
                    <div style={{ color: tone.text, fontSize: 14.4, fontWeight: 950, paddingRight: week.badge ? 36 : 0 }}>{week.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingRight: week.badge ? 34 : 0 }}>
                      {week.works.map((item) => (
                        <div key={item} style={{ color: '#334155', fontSize: 12.2, lineHeight: 1.18, fontWeight: 790, display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
                          <span style={{ width: 4.5, height: 4.5, borderRadius: 999, background: tone.head, flex: '0 0 auto' }} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 10, background: 'linear-gradient(90deg,#1d4ed8,#0f766e,#e11d48)', color: '#fff', borderRadius: 13, padding: '9px 15px', textAlign: 'center', fontSize: 15.7, fontWeight: 920 }}>
              8주차부터 유지보수 기간을 운영하며, 7월 7일 최종 발표까지 시연 안정성과 완성도를 높입니다.
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pageNumber}>4</div>
    </div>
  );
}
