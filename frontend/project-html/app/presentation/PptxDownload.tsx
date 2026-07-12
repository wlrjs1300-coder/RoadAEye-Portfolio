'use client';

import { useState, useRef, useEffect } from 'react';

export default function PptxDownload({ slides }: { slides: React.ReactNode[] }) {
  const [loading, setLoading] = useState(false);
  const [renderAll, setRenderAll] = useState(false);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReady(true); }, []);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || !ready) return;
    setLoading(true);
    setRenderAll(true);

    await new Promise((r) => setTimeout(r, 500));

    try {
      const pptxgenjs = (await import('pptxgenjs')).default;
      const html2canvas = (await import('html2canvas')).default;

      const pptx = new pptxgenjs();
      pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
      pptx.layout = 'WIDE';

      const container = containerRef.current;
      if (!container) throw new Error('렌더 컨테이너 없음');

      const slideEls = container.querySelectorAll('[data-slide-idx]');

      for (let i = 0; i < slideEls.length; i++) {
        const el = slideEls[i] as HTMLElement;
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#EBF0F5',
          width: 1440,
          height: 810,
        });

        const imgData = canvas.toDataURL('image/png');
        const slide = pptx.addSlide();
        slide.addImage({ data: imgData, x: 0, y: 0, w: 13.33, h: 7.5 });
      }

      await pptx.writeFile({ fileName: 'ROAD_A_EYE_발표자료.pptx' });
    } catch (err) {
      console.error('PPTX 생성 실패:', err);
      window.alert('PPTX 생성 중 오류가 발생했습니다.');
    } finally {
      setRenderAll(false);
      setLoading(false);
    }
  };

  return (
    <>
      <div
        data-nav="true"
        onClick={handleDownload}
        title={loading ? 'PPTX 생성 중...' : 'PPTX 다운로드'}
        style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: loading ? '#999' : '#5B8CAE',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'background 0.2s',
        }}
      >
        {loading ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </svg>
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, marginTop: 2 }}>PPTX</span>
          </>
        )}
      </div>

      {renderAll && (
        <div
          ref={containerRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: 1440,
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          {slides.map((slide, i) => (
            <div key={i} data-slide-idx={i} style={{ width: 1440, height: 810, overflow: 'hidden' }}>
              {slide}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
