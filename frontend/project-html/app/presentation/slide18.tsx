
import styles from './presentation.module.css';

type Phase = { badge: string; accent: string; icon: string; title: string; desc: string; detail: string; };

const phases: Phase[] = [
  { badge: '단기 계획', accent: '#0ea5e9', icon: '⚡', title: 'Local LLM + LangChain', desc: '로컬 기반 분석 보조', detail: '1. Ollama로 내부 LLM 실행\n2. 탐지 결과를 자연어로 요약\n3. 관리자 질의응답을 서버 내부에서 처리' },
  { badge: '중기 계획', accent: '#6366f1', icon: '🎯', title: 'Fine-tuning LLM', desc: 'Road A Eye 도메인 특화', detail: '1. 감지 기록과 오탐 사례 축적\n2. 위험 상황 설명 데이터셋 구성\n3. 고속도로 관제 전용 답변 성능 향상' },
  { badge: '장기 계획', accent: '#7c3aed', icon: '🛣️', title: '차선별 위험도 관리', desc: '위치 기반 위험도 고도화', detail: '1. 객체의 차선 위치 추정\n2. 갓길·주행차로 위험도 분리\n3. 위험 단계별 알림 기준 고도화' },
];

export default function Chapter9_1() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}><img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} /></div>
      <div className={styles.teamBadge}>4조</div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '68px 60px 50px', boxSizing: 'border-box', alignItems: 'center' }}>
        <div className={styles.chapterBadge}>Chapter 9</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 26 }}>향후 확장 계획</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, width: '100%', flex: 1, minHeight: 0 }}>
          {phases.map((p, i) => <PhaseCard key={p.badge} phase={p} index={i} />)}
        </div>
        <div style={{ marginTop: 24, width: '100%', flexShrink: 0, background: 'linear-gradient(135deg,#173a70,#2f6f9d)', color: '#fff', borderRadius: 18, padding: '18px 28px', textAlign: 'center', boxShadow: '0 10px 28px rgba(23, 58, 112, 0.20)' }}>
          <p style={{ margin: 0, fontSize: 19.5, color: '#fff', lineHeight: 1.35, fontWeight: 950 }}>
            최종 목표: 자체 AI 고도화로 오탐을 줄이고, 도메인에 특화된 예측형 관제 시스템으로 진화
          </p>
        </div>
      </div>
      <div className={styles.pageNumber}>18</div>
    </div>
  );
}

function PhaseCard({ phase: p, index }: { phase: Phase; index: number }) {
  return (
    <div style={{ position: 'relative', background: '#ffffff', borderRadius: 18, border: '1px solid #e6eef4', boxShadow: '0 8px 24px rgba(91,140,174,0.16)', padding: '34px 30px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: p.accent }} />
      <span style={{ position: 'absolute', top: 10, right: 18, fontSize: 88, fontWeight: 900, lineHeight: 1, color: `${p.accent}12`, letterSpacing: '-3px', pointerEvents: 'none' }}>{index + 1}</span>
      <div style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', background: `${p.accent}14`, border: `1px solid ${p.accent}33`, color: p.accent, padding: '7px 17px', borderRadius: 20, fontSize: 16, fontWeight: 850 }}>{p.badge}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 34 }}>
        <div style={{ width: 66, height: 66, borderRadius: 18, background: `${p.accent}14`, border: `1px solid ${p.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, flexShrink: 0 }}>{p.icon}</div>
        <div style={{ fontSize: 25.5, fontWeight: 950, color: '#1f2d3d', lineHeight: 1.22, letterSpacing: '-0.3px' }}>{p.title}</div>
      </div>
      <div style={{ marginTop: 24, color: p.accent, fontSize: 21.4, lineHeight: 1.42, fontWeight: 900 }}>{p.desc}</div>
      <div style={{ marginTop: 24, padding: '26px 0 4px', borderTop: '1px solid #eef2f6', display: 'grid', gap: 16 }}>
        {p.detail.split('\n').map((line) => (
          <div key={line} style={{ fontSize: 20.8, color: '#46586a', lineHeight: 1.45, fontWeight: 760 }}>{line}</div>
        ))}
      </div>
    </div>
  );
}
