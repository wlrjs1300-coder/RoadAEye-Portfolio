import styles from './presentation.module.css';

export default function Chapter9_Thanks() {
  return (
    <div className={styles.slide} style={{ background: 'linear-gradient(135deg, #1f2d3d 0%, #2c3e50 55%, #1a1a2e 100%)', position: 'relative', overflow: 'hidden' }}>
      {/* 배경 글로우 장식 */}
      <div style={{
        position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)',
        width: 620, height: 620, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,140,174,0.22) 0%, rgba(91,140,174,0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-180px', right: '-140px',
        width: 440, height: 440, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,57,43,0.18) 0%, rgba(192,57,43,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div className={styles.content} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 88, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05,
          background: 'linear-gradient(135deg, #ffffff 0%, #b9c7d4 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>THANK YOU</div>

        <div style={{
          width: 80, height: 4, borderRadius: 2, margin: '28px auto 22px',
          background: 'linear-gradient(90deg, #5B8CAE, #c0392b)',
        }} />

        <div style={{ fontSize: 20, fontWeight: 700 }}>
          <span style={{ color: '#c0392b' }}>Road A Eye</span>
          <span style={{ color: '#8fa3b3', margin: '0 10px' }}>·</span>
          <span style={{ color: '#cdd9e3' }}>MBC 아카데미 AI-X 3기 4조</span>
        </div>
      </div>
    </div>
  );
}
