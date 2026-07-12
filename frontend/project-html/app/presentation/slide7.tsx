import styles from './presentation.module.css';

type News = { src: string; alt: string; outlet: string; source: string; accent: string };

const newsList: News[] = [
  { src: '/members/sbs킥보드.png', alt: 'SBS 킥보드', outlet: 'SBS', source: '출처 : 2025년 10월 31일 SBS 뉴스', accent: '#6366f1' },
  { src: '/members/채널A킥보드.png', alt: '채널A 킥보드', outlet: '채널A', source: '출처 : 2026년 2월 4일 채널A', accent: '#d97706' },
];

export default function Chapter4_2() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>
      <div className={`${styles.circleDecoration} ${styles.circleLg}`} />
      <div className={styles.dotPattern} />

      <div className={styles.contentTop} style={{ padding: '70px 60px 40px' }}>
        <div className={styles.chapterBadge}>Chapter 4</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 30 }}>수요 조사</h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 26,
          width: '100%',
          alignItems: 'stretch',
        }}>
          {newsList.map((n) => (
            <div key={n.outlet} style={{
              position: 'relative',
              background: '#fff', borderRadius: 16, border: '1px solid #e6eef4',
              boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
              padding: '22px 22px 20px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: n.accent }} />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginBottom: 16,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: `${n.accent}14`, border: `1px solid ${n.accent}33`, color: n.accent,
                  padding: '5px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800,
                }}>
                  <span style={{ fontSize: 15 }}>📰</span> 관련 뉴스
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#46627a',
                  background: '#f0f5f9', border: '1px solid #dde8f0', borderRadius: 7, padding: '4px 10px',
                }}>{n.outlet}</span>
              </div>
              <div style={{
                borderRadius: 12, overflow: 'hidden',
                border: '1px solid #e6eef4', boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
              }}>
                <img src={n.src} alt={n.alt} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
              <p style={{
                fontSize: 13, color: '#8a98a6', fontWeight: 600, margin: '12px 0 0', textAlign: 'right',
              }}>{n.source}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.pageNumber}>6</div>
    </div>
  );
}
