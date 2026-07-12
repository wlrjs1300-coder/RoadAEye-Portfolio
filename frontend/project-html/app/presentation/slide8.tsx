import styles from './presentation.module.css';

type Item = {
  kind: 'img' | 'mono' | 'emoji';
  src?: string;
  ch?: string;
  col?: string;
  label: string;
  desc: string;
};
type Category = { name: string; sub: string; accent: string; items: Item[] };

const categories: Category[] = [
  {
    name: '개발 환경', sub: 'OS · IDE', accent: '#0ea5e9', items: [
      { kind: 'img', src: '/members/리눅스1.jpg', label: 'Ubuntu 24.04', desc: '서버 OS (VMware)' },
      { kind: 'img', src: '/members/vscode1.png', label: 'VSCode', desc: 'Remote SSH 개발' },
    ],
  },
  {
    name: 'Front-end', sub: 'UI · 렌더링 · 시각화', accent: '#6366f1', items: [
      { kind: 'mono', ch: 'N', col: '#0f172a', label: 'Next.js 16', desc: 'React 19 · SSR / SSG' },
      { kind: 'mono', ch: 'T', col: '#38bdf8', label: 'Tailwind CSS', desc: 'TypeScript · recharts' },
    ],
  },
  {
    name: 'Back-end', sub: 'API · 인증 · DB', accent: '#0d9488', items: [
      { kind: 'mono', ch: 'F', col: '#009688', label: 'FastAPI', desc: 'Uvicorn · JWT 인증' },
      { kind: 'img', src: '/members/돌고래1.jpg', label: 'MySQL 8.0', desc: '4개 DB · Master-Master' },
    ],
  },
  {
    name: 'AI 모델', sub: '분류 · 탐지 · 챗봇', accent: '#7c3aed', items: [
      { kind: 'img', src: '/members/케라스1.png', label: 'Keras', desc: '딥러닝 분류 모델' },
      { kind: 'img', src: '/members/욜로1.jpg', label: 'YOLOv8s', desc: '실시간 객체 탐지' },
      { kind: 'img', src: '/members/openai.png', label: 'OpenAI API', desc: 'AI 챗봇 · SSE 스트리밍' },
    ],
  },
  {
    name: '인프라', sub: 'HA · Failover · CCTV', accent: '#dc2626', items: [
      { kind: 'emoji', ch: '🔄', label: 'Keepalived', desc: 'VIP Failover · HA' },
      { kind: 'emoji', ch: '📡', label: 'ITS API', desc: '고속도로 CCTV 연동' },
    ],
  },
  {
    name: '협업', sub: '버전 관리 · 문서화', accent: '#d97706', items: [
      { kind: 'img', src: '/members/깃허브1.png', label: 'Git', desc: '버전 관리' },
      { kind: 'img', src: '/members/노션1.png', label: 'Notion', desc: '문서 협업' },
    ],
  },
];

export default function Chapter5_1() {
  const tile = {
    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
    background: '#fff', border: '1px solid #e8eef4', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  } as const;

  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ padding: '70px 50px 26px' }}>
        <div className={styles.chapterBadge}>Chapter 5</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 22 }}>아키텍처</h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 20,
          width: '100%',
        }}>
          {categories.map((cat) => (
            <div key={cat.name} style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e6eef4',
              boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
              padding: '20px 18px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: cat.accent }} />

              {/* 헤더 — 한 줄 (카테고리 + 부제) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                  background: `${cat.accent}14`, border: `1px solid ${cat.accent}33`, color: cat.accent,
                  padding: '6px 15px', borderRadius: 20, fontSize: 15.5, fontWeight: 800,
                }}>{cat.name}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#6b7886' }}>{cat.sub}</div>
              </div>

              {/* 항목 — 카드 높이를 채우도록 균등 분배 */}
              <div style={{
                flex: 1, marginTop: 14,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 8,
              }}>
                {cat.items.map((it) => (
                  <div key={it.label} style={{
                    display: 'flex', alignItems: 'center', gap: 13,
                    padding: '10px 13px', background: '#f7fafc', border: '1px solid #eef2f6', borderRadius: 12,
                  }}>
                    {it.kind === 'img' && (
                      <div style={tile}><img src={it.src} alt={it.label} style={{ width: 32, height: 32, objectFit: 'contain' }} /></div>
                    )}
                    {it.kind === 'mono' && (
                      <div style={{ ...tile, background: `${it.col}14`, border: `1px solid ${it.col}33` }}>
                        <span style={{ fontSize: 25, fontWeight: 900, color: it.col }}>{it.ch}</span>
                      </div>
                    )}
                    {it.kind === 'emoji' && (
                      <div style={tile}><span style={{ fontSize: 25 }}>{it.ch}</span></div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 17.5, fontWeight: 800, color: '#1f2d3d', lineHeight: 1.2 }}>{it.label}</div>
                      <div style={{ fontSize: 14, color: '#5b6b7a', marginTop: 3, lineHeight: 1.3 }}>{it.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.pageNumber}>8</div>
    </div>
  );
}
