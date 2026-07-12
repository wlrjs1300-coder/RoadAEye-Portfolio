import styles from './presentation.module.css';

export default function Contents() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <svg style={{ position: 'absolute', bottom: 0, left: 0, width: 300, height: 400, opacity: 0.15, pointerEvents: 'none', zIndex: 1 }} viewBox="0 0 300 400">
        {[...Array(12)].map((_, i) => (
          <path key={i} d={`M${-20 + i * 8},400 Q${60 + i * 5},300 ${30 + i * 8},200 T${50 + i * 8},0`} fill="none" stroke="#5B8CAE" strokeWidth="1.5" />
        ))}
      </svg>

      <div className={styles.content}>
        <h1 style={{ fontSize: 52, fontWeight: 900, marginBottom: 50 }}>Contents</h1>
        <div className={styles.gridThree} style={{ width: '100%' }}>
          {[
            { num: '01', label: '조원 소개' },
            { num: '02', label: '일정' },
            { num: '03', label: '프로젝트 개요' },
            { num: '04', label: '수요 조사' },
            { num: '05', label: '아키텍처' },
            { num: '06', label: '기능 소개' },
            { num: '07', label: 'AI 모델 리포트' },
            { num: '08', label: '시연 영상' },
            { num: '09', label: '향후 확장 계획' },
          ].map((item) => (
            <div key={item.num} style={{ borderTop: '2px solid #333', paddingTop: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#888', marginBottom: 10 }}>{item.num}</div>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.pageNumber}>2</div>
    </div>
  );
}
