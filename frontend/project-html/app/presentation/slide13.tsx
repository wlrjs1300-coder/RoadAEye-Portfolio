import styles from './presentation.module.css';
import ModelGraphBadge from './ModelGraphBadge';
import AiAnalysisBadge from './AiAnalysisBadge';

const metrics = [
  { label: '최종 정확도', value: '99.11%', note: '14차', color: '#10b981' },
  { label: 'Top-2', value: '100%', note: '정답 후보 확보', color: '#2563eb' },
  { label: 'Recall', value: '100%', note: '금지차량 미탐 0건', color: '#e11d48' },
];

const chart = [
  { label: '1차', value: 93.98, color: '#94a3b8' },
  { label: '2차', value: 96.19, color: '#3b82f6' },
  { label: '3차', value: 98.10, color: '#0d9488' },
  { label: '4차', value: 96.19, color: '#38bdf8' },
  { label: '5차', value: 98.10, color: '#22c55e' },
  { label: '6차', value: 80.00, color: '#f59e0b', failed: true },
  { label: '7차', value: 98.10, color: '#14b8a6' },
  { label: '8차', value: 99.05, color: '#8b5cf6' },
  { label: '9차', value: 99.05, color: '#6366f1' },
  { label: '10차', value: 36.19, color: '#ef4444', failed: true, note: '전처리 실패' },
  { label: '11차', value: 99.05, color: '#22c55e' },
  { label: '12차', value: 98.10, color: '#0ea5e9' },
  { label: '13차', value: 98.10, color: '#06b6d4' },
  { label: '14차', value: 99.11, color: '#10b981', best: true, note: '최종' },
];

const timeline = [
  { step: '1~3차', title: '기준 성능 확보', text: 'MobileNetV2 기준 성능 확보 · Recall 100% 확인', color: '#2563eb' },
  { step: '4~9차', title: '최적 조합 탐색', text: 'AdamW·Nadam·해상도 비교 · 512px 안정성 확인', color: '#0d9488' },
  { step: '10차', title: '실패 원인 분리', text: 'EfficientNetB3 전처리 충돌 확인 · 운영 후보 제외', color: '#ef4444' },
  { step: '11~14차', title: '최종 모델 확정', text: '오탐 보정 후 재학습 · Keras v14 최종 후보', color: '#10b981' },
];

export default function Chapter7Keras() {
  return (
    <div className={styles.slide}>
      <ModelGraphBadge
        title="Keras 학습 차수별 그래프"
        subtitle="정확도, macro F1, 금지차량 Recall 비교"
        metrics={[
          { label: 'Accuracy 변화', min: 30, max: 100, items: chart.map(c => ({ label: c.label, value: c.value, color: c.color, note: c.note })) },
          { label: 'macro F1', min: 0, max: 1, unit: 'score', items: [
            { label: '1차', value: 0.91, color: '#94a3b8' }, { label: '2차', value: 0.95, color: '#3b82f6' }, { label: '3차', value: 0.98, color: '#0d9488' },
            { label: '4차', value: 0.96, color: '#38bdf8' }, { label: '8차', value: 0.99, color: '#8b5cf6' }, { label: '10차', value: 0.21, color: '#ef4444' }, { label: '14차', value: 0.99, color: '#10b981' }
          ]},
          { label: '금지차량 Recall', min: 70, max: 100, items: [
            { label: '1차', value: 100, color: '#94a3b8' }, { label: '2차', value: 100, color: '#3b82f6' }, { label: '3차', value: 100, color: '#0d9488' },
            { label: '4차', value: 100, color: '#38bdf8' }, { label: '10차', value: 79.12, color: '#ef4444' }, { label: '14차', value: 100, color: '#10b981' }
          ]},
        ]}
      />
      <AiAnalysisBadge
        accent="#10b981"
        title="Keras 이미지 분류 결과"
        subtitle="Keras v14 모델로 CCTV 이미지를 분류한 대표 결과 2건"
        modelName="Keras v14"
        examples={[
          {
            image: '/images/dashboard-cctv/전동 킥보드.png',
            label: 'Electric Scooter',
            confidence: '99.11%',
            caption: '전동 킥보드를 금지 교통수단으로 분류한 결과입니다.',
            color: '#10b981',
            detections: [{ label: 'Electric Scooter', confidence: '99.11%', color: '#10b981', x: 26, y: 43, w: 6, h: 27 }],
          },
          {
            image: '/images/dashboard-cctv/트랙터.png',
            label: 'Tractor',
            confidence: '98.72%',
            caption: '트랙터를 금지 교통수단으로 분류한 결과입니다.',
            color: '#0d9488',
            detections: [{ label: 'Tractor', confidence: '98.72%', color: '#0d9488', x: 38, y: 41, w: 10, h: 17 }],
          },
        ]}
      />
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ padding: '50px 54px 14px' }}>
        <div className={styles.chapterBadge}>Chapter 7</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 6 }}>Keras 분류 모델 학습 요약</h1>
        <div className={styles.slideSubtitle} style={{ marginBottom: 16, color: '#6f8298', fontSize: 17 }}>
          1~14차 흐름을 비교해 실시간 CCTV 분류에 가장 안정적인 모델을 선정
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 18, width: '100%', alignItems: 'stretch' }}>
          <section style={cardStyle('#10b981')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
              <div>
                <div style={{ color: '#10b981', fontSize: 20, fontWeight: 950 }}>차수별 정확도 변화</div>
                <div style={{ color: '#64748b', fontSize: 14.5, fontWeight: 800, marginTop: 3 }}>모든 학습 차수 기준 · 실패 실험 포함</div>
              </div>
              <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 999, padding: '8px 13px', fontSize: 15, fontWeight: 950 }}>최종 v14</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {metrics.map((m) => <Metric key={m.label} {...m} />)}
            </div>

            <div style={{ height: 212, borderBottom: '2px solid #d8e3ec', background: 'linear-gradient(to top, #f0fdf4 0%, #ffffff 100%)', borderRadius: 14, padding: '4px 12px 0', display: 'flex', alignItems: 'end', gap: 5, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, right: 12, bottom: 160, borderTop: '1.5px dashed #10b98166' }}>
                <span style={{ position: 'absolute', right: 0, top: -12, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 950 }}>99%</span>
              </div>
              {chart.map((b) => {
                const h = Math.max(18, ((b.value - 30) / 70) * 158);
                return <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'end', alignItems: 'center' }}>
                  <div style={{ color: b.best ? '#047857' : b.failed ? '#dc2626' : '#334155', fontSize: 9.5, fontWeight: 950, marginBottom: 4 }}>{b.value.toFixed(1)}</div>
                  <div style={{ width: 22, height: h, borderRadius: '6px 6px 0 0', background: b.best ? 'linear-gradient(to top, #059669, #34d399)' : b.failed ? 'linear-gradient(to top, #991b1b, #ef4444)' : `linear-gradient(to top, ${b.color}aa, ${b.color})`, boxShadow: `0 5px 12px ${b.color}33` }} />
                  <div style={{ marginTop: 5, marginBottom: -18, color: b.best ? '#047857' : b.failed ? '#dc2626' : '#52697f', fontSize: 10.5, fontWeight: 950 }}>{b.label}</div>
                </div>;
              })}
            </div>
          </section>

          <section style={{ ...cardStyle('#2563eb'), display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#1d4ed8', fontSize: 21, fontWeight: 950, marginBottom: 14 }}>학습 흐름 한눈에 보기</div>
            <div style={{ display: 'grid', gap: 12, flex: 1, gridTemplateRows: 'repeat(4, 1fr)' }}>
              {timeline.map((item) => (
                <div key={item.step} style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 12, alignItems: 'center', padding: '12px 12px', borderRadius: 14, background: `${item.color}0f`, border: `1px solid ${item.color}30` }}>
                  <div style={{ background: item.color, color: '#fff', borderRadius: 12, padding: '12px 6px', textAlign: 'center', fontSize: item.step.length > 4 ? 14 : 16, fontWeight: 950, whiteSpace: 'nowrap' }}>{item.step}</div>
                  <div>
                    <div style={{ color: item.color, fontSize: 17.2, fontWeight: 950, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ color: '#334155', fontSize: 15.1, lineHeight: 1.32, fontWeight: 760 }}>{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <BottomBox title="모델 역할" text="프레임 단위 금지 교통수단 가능성 판단" color="#10b981" />
            <BottomBox title="선정 기준" text="Accuracy보다 미탐지 최소화와 운영 안정성 우선" color="#2563eb" />
            <BottomBox title="운영 방향" text="YOLO 전 게이트로 연산량 절감" color="#7c3aed" />
          </div>
          <div style={{ background: 'linear-gradient(90deg, #fff1f2 0%, #fff7ed 100%)', border: '1.5px solid #fca5a5', borderLeft: '5px solid #e11d48', borderRadius: 14, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: '#e11d48', fontSize: 15, fontWeight: 950, whiteSpace: 'nowrap' }}>임계값 0.3 설계</span>
            <span style={{ color: '#1e293b', fontSize: 14.5, fontWeight: 750 }}>기본값 0.5 → <b>0.3으로 하향</b> · 미탐지는 실제 사고로 직결되므로 오탐보다 미탐지를 엄격히 제거 · 오탐은 YOLO 2차 검증이 보정</span>
          </div>
        </div>
      </div>
      <div className={styles.pageNumber}>14</div>
    </div>
  );
}

function cardStyle(color: string) {
  return { position: 'relative' as const, background: '#fff', border: '1px solid #e6eef4', borderTop: `7px solid ${color}`, borderRadius: 20, padding: '17px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)' };
}

function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return <div style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
    <div style={{ color: '#64748b', fontSize: 13.5, fontWeight: 900 }}>{label}</div>
    <div style={{ color, fontSize: 25, fontWeight: 950, marginTop: 4, lineHeight: 1 }}>{value}</div>
    <div style={{ color: '#64748b', fontSize: 12.2, fontWeight: 800, marginTop: 5 }}>{note}</div>
  </div>;
}

function BottomBox({ title, text, color }: { title: string; text: string; color: string }) {
  return <div style={{ background: `${color}0f`, border: `1px solid ${color}30`, borderRadius: 15, padding: '13px 16px' }}>
    <div style={{ color, fontSize: 16.5, fontWeight: 950, marginBottom: 4 }}>{title}</div>
    <div style={{ color: '#334155', fontSize: 14.8, lineHeight: 1.35, fontWeight: 750 }}>{text}</div>
  </div>;
}
