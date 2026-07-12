'use client';
// ROAD A EYE - 3주차 중간 보고 (슬라이드쇼 모드)
// ← → 화살표, 클릭, 스페이스바로 슬라이드 이동
import { useState, useEffect, useCallback } from 'react';
import Slide1 from './slide1';
import Slide2 from './slide2';
import Slide3 from './slide3';
import Slide4 from './slide4';
import Slide5 from './slide5';
import Slide6 from './slide6';
import Slide7 from './slide7';
import Slide8 from './slide8';
import Slide9 from './slide9';
import Slide10 from './slide10';
import Slide11 from './slide11';
import Slide12 from './slide12';
import Slide13Common from './slide13Common';
import Slide13 from './slide13';
import Slide14 from './slide14';
import Slide15 from './slide15';
import Slide16 from './slide16';
import Slide17 from './slide17';
import Slide18 from './slide18';
import Slide19 from './slide19';
import Slide20 from './slide20';
import Slide21 from './slide21';
import PptxDownload from './PptxDownload';
import LaserPointer from './LaserPointer';

/* ══════════════════════════════════
   슬라이드 목록 (한 장씩 분리)
   ══════════════════════════════════ */
const slides: React.ReactNode[] = [
  <Slide1 key="s1" />,
  <Slide2 key="s2" />,
  <Slide3 key="s3" />,
  <Slide4 key="s4" />,
  <Slide5 key="s5" />,
  <Slide7 key="s7" />,
  <Slide6 key="s6" />,
  <Slide8 key="s8" />,
  <Slide9 key="s9" />,
  <Slide10 key="s10" />,
  <Slide11 key="s11" />,
  <Slide12 key="s12" />,
  <Slide13Common key="s13-common" />,
  <Slide13 key="s13" />,
  <Slide14 key="s14" />,
  <Slide15 key="s15" />,
  <Slide16 key="s16" />,
  <Slide17 key="s17" />,
  <Slide18 key="s18" />,
  <Slide19 key="s19" />,
  <Slide21 key="s21" />,
  <Slide20 key="s20" />,
];

/* ══════════════════════════════════
   슬라이드쇼 뷰어
   ══════════════════════════════════ */
export default function Presentation() {
  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);

  const getQrStyle = (): React.CSSProperties | null => {
    if (current === 0) return null; // 첫 페이지는 접속 정보 옆의 큰 QR 사용
    if (current >= total - 3) return null; // 마지막 3장은 QR 제거
    if (current === 3) return { left: 76, bottom: 58 }; // 프로젝트 일정
    return { top: 44, right: 88 };
  };

  const qrStyle = getQrStyle();

  // 화면 크기에 맞춰 슬라이드 스케일 계산
  const updateScale = useCallback(() => {
    const scaleX = window.innerWidth / 1440;
    const scaleY = window.innerHeight / 810;
    setScale(Math.min(scaleX, scaleY));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  // 키보드
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'Enter':
          e.preventDefault(); goNext(); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); goPrev(); break;
        case 'Home':
          e.preventDefault(); setCurrent(0); break;
        case 'End':
          e.preventDefault(); setCurrent(total - 1); break;
        case 'F5':
          e.preventDefault();
          document.documentElement.requestFullscreen?.();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, total]);

  // 클릭: 왼쪽 20% = 이전, 나머지 = 다음
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-nav]')) return;
    const x = e.clientX / window.innerWidth;
    x < 0.2 ? goPrev() : goNext();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'none',
        userSelect: 'none',
      }}
    >
      {/* 슬라이드 */}
      <div style={{ width: 1440, height: 810, transform: `scale(${scale})`, transformOrigin: 'center center', position: 'relative' }}>
        {slides[current]}
        {qrStyle && (
          <div
            data-nav="true"
            style={{
              position: 'absolute',
              width: 68,
              height: 68,
              padding: 6,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(139,164,184,0.38)',
              boxShadow: '0 6px 16px rgba(91,140,174,0.15)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              ...qrStyle,
            }}
          >
            <img
              src="/images/qrcode.jpg"
              alt="ROAD A EYE QR 코드"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
        )}
      </div>

      {/* 레이저 포인터 */}
      <LaserPointer />

      {/* 시연 영상 다운로드 버튼 */}
      <a
        data-nav="true"
        href="/members/demo.mp4"
        download="ROAD_A_EYE_시연영상.mp4"
        onClick={(e) => e.stopPropagation()}
        title="시연 영상 다운로드"
        style={{
          position: 'fixed',
          bottom: 112,
          right: 30,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#4a7c59',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          textDecoration: 'none',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          <line x1="9" y1="19" x2="9" y2="22" />
          <line x1="6" y1="22" x2="12" y2="22" />
        </svg>
        <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, marginTop: 2 }}>영상</span>
      </a>

      {/* PPTX 다운로드 버튼 */}
      <PptxDownload slides={slides} />

      {/* 하단 네비게이션 (마우스 올리면 표시) */}
      <div
        data-nav="true"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: 48,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          opacity: 0,
          transition: 'opacity 0.3s',
          cursor: 'default',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
      >
        <button data-nav="true" onClick={(e) => { e.stopPropagation(); goPrev(); }}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 16px' }}>
          ◀
        </button>
        <span style={{ color: '#fff', fontSize: 16, fontFamily: 'monospace' }}>
          {current + 1} / {total}
        </span>
        <button data-nav="true" onClick={(e) => { e.stopPropagation(); goNext(); }}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 16px' }}>
          ▶
        </button>
      </div>
    </div>
  );
}
