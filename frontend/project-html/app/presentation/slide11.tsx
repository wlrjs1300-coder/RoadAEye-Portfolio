
import styles from './presentation.module.css';

const items = [
  { icon: '📊', title: '통합 관제 대시보드', points: ['오늘 감지 · 미확인 · 활성 CCTV · AI 정확도 실시간 표시', '웹캠 자동 재생 + 고속도로 CCTV 클릭 즉시 재생', '미확인 감지 실시간 WebSocket 알림 (LIVE 배지)'] },
  { icon: '📹', title: '스트림 관리', points: ['전국 고속도로 CCTV 자동 검색 (ITS API 연동)', '권역별 칩 필터 + MJPEG 미리보기 · 모달 재생', 'AI 서버 stream start/stop 제어'] },
  { icon: '🔔', title: '실시간 알림 시스템', points: ['WebSocket 기반 감지 즉시 알림 Push', '알림 이력 · 읽음/삭제 · 배지(9+) 처리', '역할별 분리 (관리자: 위험/시스템, 일반: 공지/계정)'] },
  { icon: '🤖', title: 'AI 챗봇', points: ['SSE 스트리밍 — 글자 단위 누적 표시', '말풍선 애니메이션 + 통통 점 인디케이터', 'AI 서버 LLM 프록시 경유 (OpenAI API)'] },
];

export default function Chapter6_1() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}><img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} /></div>
      <div className={styles.teamBadge}>4조</div>
      <div className={styles.dotPattern} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '68px 50px 46px', boxSizing: 'border-box', alignItems: 'center' }}>
        <div className={styles.chapterBadge}>Chapter 6</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 22 }}>실시간 관제</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, width: '100%', flex: 1 }}>
          {items.map((item) => <Feature key={item.title} {...item} />)}
        </div>
      </div>
      <div className={styles.pageNumber}>11</div>
    </div>
  );
}

function Feature({ icon, title, points }: { icon: string; title: string; points: string[] }) {
  return (
    <div className={styles.featureCard} style={{ padding: '30px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div className={styles.featureIcon} style={{ width: 54, height: 54, fontSize: 30, flexShrink: 0 }}>{icon}</div>
        <div className={styles.featureTitle} style={{ fontSize: 25, lineHeight: 1.18, marginBottom: 0 }}>{title}</div>
      </div>
      <ul className={styles.bulletList} style={{ marginTop: 0 }}>
        {points.map((p, idx) => <li key={p} style={{ fontSize: 20, lineHeight: 1.45, marginBottom: idx === points.length - 1 ? 0 : 12 }}>{p}</li>)}
      </ul>
    </div>
  );
}
