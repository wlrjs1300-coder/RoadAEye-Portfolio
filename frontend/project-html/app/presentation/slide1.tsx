import styles from './presentation.module.css';

export default function Cover() {
  return (
    <div className={styles.slide}>
      <div className={`${styles.circleDecoration} ${styles.circleLg}`} />
      <div className={`${styles.circleDecoration} ${styles.circleSm}`} />
      <div className={styles.dotPattern} />
      <div className={styles.titleSlide}>
        <div className={styles.projectBadge}>FINAL PROJECT TEAM 4</div>
        <div className={styles.mainTitle}>ROAD A EYE</div>
        <div className={styles.mainSubtitle}>
          고속도로 CCTV 기반<br />
          AI 위험 물체 감지 관제 시스템
        </div>
      </div>
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 50,
        background: 'linear-gradient(180deg, #8BA4B8 0%, #5B8CAE 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        zIndex: 10,
      }}>
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 3,
        }}>
          FINAL PROJECT REPORT
        </div>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block', transform: 'rotate(90deg)' }} />
      </div>


      <div style={{
        position: 'absolute',
        left: 86,
        bottom: 46,
        zIndex: 12,
        display: 'flex',
        alignItems: 'stretch',
        gap: 14,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 10,
          width: 600,
        }}>
        <a
          data-nav="true"
          href="https://borrower-grandpa-implosion.ngrok-free.dev/auth/google/callback"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 22px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.88)',
            border: '1px solid rgba(139,164,184,0.4)',
            color: '#173a70',
            textDecoration: 'none',
            boxShadow: '0 8px 20px rgba(91,140,174,0.16)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 999, background: '#e11d48', boxShadow: '0 0 0 4px rgba(225,29,72,0.12)', flexShrink: 0 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.15 }}>
            <span style={{ fontSize: 15.5, fontWeight: 900 }}>ROAD A EYE 접속 링크</span>
            <span style={{ fontSize: 15.8, fontWeight: 800, color: '#5b7186', letterSpacing: '0' }}>
              https://borrower-grandpa-implosion.ngrok-free.dev/auth/google/callback
            </span>
          </span>
        </a>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          width: '100%',
          boxSizing: 'border-box',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.82)',
          border: '1px solid rgba(139,164,184,0.36)',
          boxShadow: '0 8px 20px rgba(91,140,174,0.12)',
          backdropFilter: 'blur(6px)',
        }}>
          {[
            ['일반 사용자', 'test', 'test1234!!'],
            ['관리자', 'testA', 'test1234!!'],
          ].map(([label, id, pw]) => (
            <div key={label} style={{ background: '#f8fbfd', border: '1px solid #e2eaf0', borderRadius: 12, padding: '10px 14px', minWidth: 0 }}>
              <div style={{ color: '#173a70', fontSize: 13.5, fontWeight: 950, marginBottom: 5 }}>{label}</div>
              <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.45, fontWeight: 760 }}>
                아이디 <span style={{ color: '#e11d48', fontWeight: 950 }}>{id}</span><br />
                비밀번호 <span style={{ color: '#e11d48', fontWeight: 950 }}>{pw}</span>
              </div>
            </div>
          ))}
        </div>
        </div>

        <div style={{
          width: 156,
          padding: 12,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(139,164,184,0.42)',
          boxShadow: '0 8px 20px rgba(91,140,174,0.14)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          flexShrink: 0,
        }}>
          <img
            src="/images/qrcode.jpg"
            alt="ROAD A EYE QR 코드"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      </div>

      <div className={styles.pageNumber}>1</div>
      <div className={styles.memberInfo}>
        <div style={{ display: 'inline-block', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 8 }}>
            <span>
              <span className={styles.role} style={{ minWidth: 0, fontSize: 18 }}>조장</span>
              <span className={styles.name} style={{ fontSize: 22, fontWeight: 800, color: '#1f2d3d' }}>팀원 A</span>
            </span>
            <span>
              <span className={styles.role} style={{ minWidth: 0, fontSize: 18 }}>부조장</span>
              <span className={styles.name} style={{ fontSize: 22, fontWeight: 800, color: '#1f2d3d' }}>이지건</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className={styles.role} style={{ minWidth: 0, fontSize: 18 }}>조원</span>
            <span className={styles.name} style={{ fontSize: 22, fontWeight: 800, color: '#1f2d3d' }}>팀원 B | 팀원 C | 팀원 D</span>
          </div>
        </div>
      </div>
    </div>
  );
}
