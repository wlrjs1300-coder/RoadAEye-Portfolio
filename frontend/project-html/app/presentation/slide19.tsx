import styles from './presentation.module.css';

export default function Chapter9_Ending() {
  return (
    <div className={styles.slide} style={{ background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #1a1a2e 100%)', position: 'relative', overflow: 'hidden' }}>
      {/* 배경 글로우 장식 */}
      <div style={{
        position: 'absolute', top: '-180px', right: '-160px',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,140,174,0.30) 0%, rgba(91,140,174,0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-200px', left: '-160px',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,57,43,0.22) 0%, rgba(192,57,43,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div className={styles.content} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, alignSelf: 'center',
          padding: '7px 18px', borderRadius: 20, marginBottom: 30,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
          color: '#cdd9e3', fontSize: 14, fontWeight: 700, letterSpacing: '0.5px',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0392b' }} />
          AI-X 3기 최종 프로젝트 · 4조
        </div>

        <div style={{ marginBottom: 22 }}>
          <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-1px' }}>
            <span style={{ color: '#c0392b' }}>Road A Eye</span>
          </span>
        </div>

        <div style={{
          width: 64, height: 4, borderRadius: 2, margin: '0 auto 26px',
          background: 'linear-gradient(90deg, #5B8CAE, #c0392b)',
        }} />

        <div className={styles.endingText}>
          실시간 감지에서 예측 기반 예방까지
        </div>
        <div className={styles.endingSubtext}>
          AI가 지키는 더 안전한 고속도로
        </div>
      </div>
    </div>
  );
}
