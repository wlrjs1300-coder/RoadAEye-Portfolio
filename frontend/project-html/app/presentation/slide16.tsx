import styles from './presentation.module.css';

const steps = [
  { n: '1', title: '입력', body: 'ITS CCTV·웹캠 프레임 수집', color: '#2563eb' },
  { n: '2', title: '분류', body: 'Keras가 금지 가능성 1차 판단', color: '#10b981' },
  { n: '3', title: '탐지', body: 'YOLO가 객체 위치·클래스 산출', color: '#0d9488' },
  { n: '4', title: '병합', body: 'Soft Voting으로 최종 신뢰도 계산', color: '#7c3aed' },
  { n: '5', title: '관제', body: '대시보드·로그·통계에 즉시 반영', color: '#e11d48' },
];
const roles = [
  { title: 'Keras v14', body: '정상 프레임 선별 · 연산량 절감', color: '#10b981' },
  { title: 'YOLOv8s', body: '원거리 소형 객체 보조 · 앙상블 가중치 0.35', color: '#0d9488' },
  { title: 'YOLOv11m v3', body: '위치·클래스 정밀 산출 주력 · 앙상블 가중치 0.65', color: '#7c3aed' },
];
const outputs = [
  ['실시간 관제', '현재 CCTV 영상과 AI 감지 상태를 한 화면에서 확인'],
  ['감지 기록', '객체 유형, 시간, CCTV 위치, 신뢰도를 DB에 저장'],
  ['분석 관리', '통계 리포트와 위험구간지도에서 누적 패턴 확인'],
];

export default function Chapter7FinalDirection() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}><img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} /></div>
      <div className={styles.teamBadge}>4조</div>
      <div className={styles.contentTop} style={{ height: '100%', padding: '42px 54px 38px' }}>
        <div className={styles.chapterBadge}>Chapter 7</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 4 }}>AI 모델 최종 적용 방향</h1>
        <div className={styles.slideSubtitle} style={{ marginBottom: 12, color: '#6f8298', fontSize: 17 }}>Keras로 거르고, YOLO로 찾고, 대시보드에서 바로 확인하는 구조</div>
        <section style={{ background: '#fff', border: '1px solid #e6eef4', borderRadius: 22, padding: '15px 22px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {steps.map((s) => <div key={s.n} style={{ background: `${s.color}0f`, border: `1px solid ${s.color}30`, borderRadius: 16, padding: '12px 12px', textAlign: 'center' }}><div style={{ margin: '0 auto 9px', width: 32, height: 32, borderRadius: 12, background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 950 }}>{s.n}</div><div style={{ color: s.color, fontSize: 18.5, fontWeight: 950, marginBottom: 6 }}>{s.title}</div><div style={{ color: '#334155', fontSize: 13.8, lineHeight: 1.25, fontWeight: 780 }}>{s.body}</div></div>)}
          </div>
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
          <section style={card('#0d9488')}><Title color="#0d9488" text="모델 역할" /><div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{roles.map(r => <Info key={r.title} {...r} />)}</div></section>
          <section style={card('#e11d48')}><Title color="#e11d48" text="운영 반영" /><div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{outputs.map(([t,b],i) => <div key={t} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', background: '#f8fbfd', border: '1px solid #e2eaf0', borderRadius: 14, padding: '12px' }}><div style={{ width: 34, height: 34, borderRadius: 12, background: '#e11d48', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15.8, fontWeight: 950 }}>{i+1}</div><div><div style={{ color: '#1f2d3d', fontSize: 17, fontWeight: 950 }}>{t}</div><div style={{ color: '#52697f', fontSize: 14.4, lineHeight: 1.3, fontWeight: 750, marginTop: 3 }}>{b}</div></div></div>)}</div></section>
        </div>
        <div style={{ marginTop: 12, width: '100%', background: 'linear-gradient(135deg,#173a70,#2f6f9d)', color: '#fff', borderRadius: 18, padding: '14px 22px', fontSize: 18.5, lineHeight: 1.35, fontWeight: 950, textAlign: 'center' }}>최종 목표: 위험 객체 탐지부터 기록·알림·통계까지 자동 연결</div>
      </div>
      <div className={styles.pageNumber}>17</div>
    </div>
  );
}
function card(color: string) { return { background: '#fff', border: '1px solid #e6eef4', borderTop: `7px solid ${color}`, borderRadius: 20, padding: '16px 20px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)' }; }
function Title({ color, text }: { color: string; text: string }) { return <div style={{ color, fontSize: 20, fontWeight: 950 }}>{text}</div>; }
function Info({ title, body, color }: { title: string; body: string; color: string }) { return <div style={{ background: `${color}0f`, border: `1px solid ${color}30`, borderRadius: 14, padding: '11px 13px' }}><div style={{ color, fontSize: 17, fontWeight: 950, marginBottom: 6 }}>{title}</div><div style={{ color: '#334155', fontSize: 14.6, lineHeight: 1.34, fontWeight: 780 }}>{body}</div></div>; }
