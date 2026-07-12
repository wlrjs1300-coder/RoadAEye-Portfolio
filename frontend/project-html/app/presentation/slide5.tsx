// Chapter 3 - 프로젝트 개요
import styles from './presentation.module.css';

const BG = '#0ea5e9';
const GOAL = '#0d9488';

const bgGroups: { title: string; items: string[] }[] = [
  {
    title: '사회적 · 환경적 배경',
    items: [
      '최근 고속도로 내 불법 이동장치 진입',
      'CCTV 채널을 관리 요원이 실시간으로 24시간 모니터링 물리적 한계',
      '인적 오류로 인한 감지 누락 발생 가능성 높음',
    ],
  },
  {
    title: '기술적 요구 사항',
    items: [
      '단순 영상 기록을 넘어 AI가 스스로 판단',
      "관리자에게 즉각 알람을 주는 '능동형 관제' 시스템 필요",
      '단순 객체 탐지를 넘어 차종 분류, 오탐 분석을 포함한 교차원적 이중 분석',
    ],
  },
];

const goalItems: string[] = [
  'AI를 통한 질의응답',
  '통합 AI 관제 시스템 구축',
  '탐지 · 기록 저장 · 위험도 분석 · 관리자 알림',
  '고속도로 CCTV 영상으로 위반 교통수단 AI 감지',
];

export default function Chapter3() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ padding: '70px 60px 40px' }}>
        <div className={styles.chapterBadge}>Chapter 3</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 18 }}>프로젝트 개요</h1>
        <p className={styles.slideSubtitle} style={{ marginBottom: 30, fontSize: 20, color: '#1f2d3d', fontWeight: 700 }}>
          고속도로 실시간 CCTV 기반 위험 탐지 및 AI 데이터 정밀 분석을 통한{' '}
          <span className={styles.highlightBlue}>지능형 통합 관제 플랫폼 개발</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, width: '100%', padding: '0 20px', boxSizing: 'border-box', alignItems: 'stretch' }}>
          {/* 배경 */}
          <div style={{
            position: 'relative', background: '#fff', borderRadius: 16,
            border: '1px solid #e6eef4', boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
            padding: '24px 24px 22px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 26,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: BG }} />

            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center',
              background: `${BG}14`, border: `1px solid ${BG}33`, color: BG,
              padding: '5px 16px', borderRadius: 20, fontSize: 15, fontWeight: 800,
            }}>배경</div>

            {bgGroups.map((g) => (
              <div key={g.title}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2d3d', marginBottom: 16, letterSpacing: '-0.2px' }}>{g.title}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {g.items.map((it, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, fontSize: 17, color: '#0f172a', lineHeight: 1.68, fontWeight: 600 }}>
                      <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: BG, marginTop: 7 }} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 목적 */}
          <div style={{
            position: 'relative', background: '#fff', borderRadius: 16,
            border: '1px solid #e6eef4', boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
            padding: '24px 24px 22px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: GOAL }} />

            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center',
              background: `${GOAL}14`, border: `1px solid ${GOAL}33`, color: GOAL,
              padding: '5px 16px', borderRadius: 20, fontSize: 15, fontWeight: 800,
            }}>목적</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {goalItems.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#f7fafc', border: '1px solid #eef2f6', borderRadius: 12,
                  padding: '13px 16px',
                }}>
                  <span style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 9,
                    background: GOAL, color: '#fff', fontSize: 16, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1f2d3d', lineHeight: 1.3 }}>{it}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 'auto',
              background: `${GOAL}10`, border: `1px solid ${GOAL}33`, borderRadius: 12,
              padding: '14px 18px', fontSize: 17, color: '#1f2d3d', fontWeight: 700, lineHeight: 1.5,
            }}>
              → 단순 탐지에 그치지 않고 <span className={styles.highlightBlue}>AI 감지 후 2차 사고 방지</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pageNumber}>5</div>
    </div>
  );
}
