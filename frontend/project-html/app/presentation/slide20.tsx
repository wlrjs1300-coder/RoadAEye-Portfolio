import styles from './presentation.module.css';

export default function Chapter9_QA() {
  return (
    <div className={styles.slide} style={{ background: '#EBF0F5', position: 'relative', overflow: 'hidden' }}>
      {/* 배경 글로우 장식 */}
      <div style={{
        position: 'absolute', top: '-160px', left: '-140px',
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,140,174,0.18) 0%, rgba(91,140,174,0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-180px', right: '-140px',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div className={styles.content} style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 132, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1,
          background: 'linear-gradient(135deg, #1f2d3d 0%, #5B8CAE 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>Q&amp;A</div>

        <div style={{
          width: 80, height: 4, borderRadius: 2, margin: '26px auto 22px',
          background: 'linear-gradient(90deg, #5B8CAE, #c0392b)',
        }} />

        <div style={{ fontSize: 18, fontWeight: 600, color: '#7a8896', letterSpacing: '0.3px' }}>
          궁금한 점을 자유롭게 질문해 주세요
        </div>
      </div>
    </div>
  );
}
