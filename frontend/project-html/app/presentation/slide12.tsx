
import styles from './presentation.module.css';

const items = [
  { icon: '📋', title: '감지 기록', points: ['객체/상태/기간 필터', '상세 모달 조회', '미처리→확인/기각 상태 변경'] },
  { icon: '📈', title: '통계 리포트', points: ['시간대별/일별 감지 추이', '객체 유형별 비율 차트', 'recharts 기반 시각화'] },
  { icon: '🗺️', title: '위험 구간 지도', points: ['히트맵 기반 위험도 표시', 'CCTV 위치 마커', '구간별 감지 빈도 분석'] },
  { icon: '🧠', title: 'AI 모델 관리', points: ['모델 버전 관리', '정확도 추적', '배포 이력 조회'] },
  { icon: '👤', title: '회원 시스템', points: ['가입(이메일 인증) · 로그인', 'JWT 60분 · Refresh Token 7일', '프로필 수정 · 탈퇴'] },
  { icon: '📝', title: '게시판 3종', points: ['공지사항 (핀 고정/페이지네이션)', 'FAQ 아코디언 (12건)', '1:1 문의 (파일 첨부/상태 관리)'] },
];

export default function Chapter6_2() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}><img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} /></div>
      <div className={styles.teamBadge}>4조</div>
      <div className={styles.dotPattern} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '68px 50px 46px', boxSizing: 'border-box', alignItems: 'center' }}>
        <div className={styles.chapterBadge}>Chapter 6</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 22 }}>분석 · 관리</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, width: '100%', flex: 1 }}>
          {items.map((item) => <Feature key={item.title} {...item} />)}
        </div>
      </div>
      <div className={styles.pageNumber}>12</div>
    </div>
  );
}

function Feature({ icon, title, points }: { icon: string; title: string; points: string[] }) {
  return (
    <div className={styles.featureCard} style={{ padding: '26px 27px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div className={styles.featureIcon} style={{ width: 54, height: 54, fontSize: 30, flexShrink: 0 }}>{icon}</div>
        <div className={styles.featureTitle} style={{ fontSize: 24.5, lineHeight: 1.18, marginBottom: 0 }}>{title}</div>
      </div>
      <ul className={styles.bulletList} style={{ marginTop: 0, display: 'grid', gap: 13 }}>
        {points.map((p, idx) => <li key={p} style={{ fontSize: 20.2, lineHeight: 1.5, marginBottom: 0 }}>{p}</li>)}
      </ul>
    </div>
  );
}
