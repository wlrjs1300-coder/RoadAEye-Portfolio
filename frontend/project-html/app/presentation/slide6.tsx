import styles from './presentation.module.css';

export default function Chapter4_1() {
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
          gridTemplateColumns: '1.05fr 1fr',
          gap: 26,
          width: '100%',
          alignItems: 'stretch',
        }}>
          {/* 왼쪽: 관련 뉴스 */}
          <div style={{
            position: 'relative',
            background: '#fff', borderRadius: 16, border: '1px solid #e6eef4',
            boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
            padding: '22px 22px 20px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#c0392b' }} />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginBottom: 16,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: '#c0392b14', border: '1px solid #c0392b33', color: '#c0392b',
                padding: '5px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800,
              }}>
                <span style={{ fontSize: 15 }}>📰</span> 관련 뉴스
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#46627a',
                background: '#f0f5f9', border: '1px solid #dde8f0', borderRadius: 7, padding: '4px 10px',
              }}>MBC</span>
            </div>
            <div style={{
              borderRadius: 12, overflow: 'hidden',
              border: '1px solid #e6eef4', boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
              height: 358,
            }}>
              <img src="/members/MBC 오토바이.png" alt="MBC 오토바이" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center' }} />
            </div>
            <p style={{
              fontSize: 13, color: '#8a98a6', fontWeight: 600, margin: '12px 0 0', textAlign: 'right',
            }}>출처 : 2026년 3월 17일 MBC 뉴스투데이</p>
          </div>

          {/* 오른쪽: 조사 배경 + 수요 전망 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 조사 배경 및 목적 */}
            <div style={{
              position: 'relative', flex: 1,
              background: '#fff', borderRadius: 16, border: '1px solid #e6eef4',
              boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
              padding: '26px 26px 24px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#0ea5e9' }} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
                background: '#0ea5e914', border: '1px solid #0ea5e933', color: '#0ea5e9',
                padding: '6px 16px', borderRadius: 20, fontSize: 17, fontWeight: 800, marginBottom: 16,
              }}>조사 배경 및 목적</div>
              <p style={{ fontSize: 21.5, color: '#1f2d3d', lineHeight: 1.95, margin: 0, fontWeight: 600 }}>
                고속도로에서 반복적으로 발생하는 불법 이동수단 침입 사고를<br />
                예방하고, 실시간 신속하게 대응하는{' '}
                <span className={styles.highlightBlue}>안전한 교통 시스템 구축</span>
              </p>
            </div>

            {/* 향후 수요 전망 */}
            <div style={{
              position: 'relative', flex: 1,
              background: '#fff', borderRadius: 16, border: '1px solid #e6eef4',
              boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
              padding: '26px 26px 24px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#0d9488' }} />
              <div style={{
                display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
                background: '#0d948814', border: '1px solid #0d948833', color: '#0d9488',
                padding: '6px 16px', borderRadius: 20, fontSize: 17, fontWeight: 800, marginBottom: 16,
              }}>향후 수요 전망</div>
              <p style={{ fontSize: 21.5, color: '#1f2d3d', lineHeight: 1.95, margin: 0, fontWeight: 600 }}>
                프로젝트를 통해{' '}
                <span className={styles.highlightBlue}>고속도로 불법 이동수단 침입 사고 방지</span> 및<br />
                사고 발생시 신속한 대응으로{' '}
                <span className={styles.highlightBlue}>2차 사고 방지</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pageNumber}>7</div>
    </div>
  );
}
