import styles from './presentation.module.css';
import ModelGraphBadge from './ModelGraphBadge';
import AiAnalysisBadge from './AiAnalysisBadge';

const runs = [
  { name: '1차', tag: '기준 모델', map50: '99.15%', map95: '83.88%', time: '102분', color: '#2563eb', role: '기준 성능 확보', note: '초기 기준 성능 확보용 출발점' },
  { name: '2차', tag: '실패 실험', map50: '98.78%', map95: '82.09%', time: '약 750분', color: '#ef4444', role: '실패 원인 확인', note: '832px + multi_scale 동시 적용 · 시간 증가, mAP 하락' },
  { name: '3차', tag: '최종 후보', map50: '99.22%', map95: '84.30%', time: '95분', color: '#10b981', role: '배포 권장', note: '640px 복귀 + lr 축소 · mAP50-95 개선' },
];

const fixes = [
  ['이미지', '832px → 640px', '시간 정상화'],
  ['증강', 'multi_scale 제거', '안정성 회복'],
  ['학습률', 'lr0 0.001', '기존 지식 보존'],
  ['강도', 'box 8.5 · copy_paste 0.2', '과한 설정 완화'],
];

export default function Chapter7Yolo11() {
  return (
    <div className={styles.slide}>
      <ModelGraphBadge
        title="YOLOv11m (Medium) 성능 비교 그래프"
        subtitle="1차, 2차, 3차 학습의 mAP/Precision/Recall 변화"
        metrics={[
          { label: 'Best mAP50', min: 80, max: 100, items: [{ label: '1차', value: 99.15, color: '#2563eb' }, { label: '2차', value: 98.78, color: '#ef4444' }, { label: '3차', value: 99.22, color: '#10b981' }] },
          { label: 'Best mAP50-95', min: 70, max: 90, items: [{ label: '1차', value: 83.88, color: '#2563eb' }, { label: '2차', value: 82.09, color: '#ef4444' }, { label: '3차', value: 84.30, color: '#10b981' }] },
          { label: 'Precision', min: 90, max: 100, items: [{ label: '1차', value: 98.39, color: '#2563eb' }, { label: '2차', value: 97.39, color: '#ef4444' }, { label: '3차', value: 98.31, color: '#10b981' }] },
          { label: 'Recall', min: 90, max: 100, items: [{ label: '1차', value: 98.07, color: '#2563eb' }, { label: '2차', value: 94.66, color: '#ef4444' }, { label: '3차', value: 97.70, color: '#10b981' }] },
        ]}
      />
      <AiAnalysisBadge
        accent="#7c3aed"
        title="YOLOv11m v3 이미지 탐지 결과"
        subtitle="최종 후보 모델로 탐지한 대표 결과 2건"
        modelName="YOLOv11m v3"
        examples={[
          {
            image: '/images/dashboard-cctv/리어카.png',
            label: 'Rear Car',
            confidence: '96%',
            caption: '리어카 위치와 신뢰도를 탐지한 결과입니다.',
            color: '#7c3aed',
            detections: [{ label: 'Rear Car', confidence: '96%', color: '#7c3aed', x: 64, y: 43, w: 11, h: 16 }],
          },
          {
            image: '/images/dashboard-cctv/전동 휠체어.png',
            label: 'Wheelchair',
            confidence: '95%',
            caption: '전동 휠체어 위치와 신뢰도를 탐지한 결과입니다.',
            color: '#e11d48',
            detections: [{ label: 'Wheelchair', confidence: '95%', color: '#e11d48', x: 58, y: 39, w: 9, h: 23 }],
          },
        ]}
      />
      <div className={styles.logo}><img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} /></div>
      <div className={styles.teamBadge}>4조</div>
      <div className={styles.contentTop} style={{ padding: '48px 54px 14px' }}>
        <div className={styles.chapterBadge}>Chapter 7</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 6 }}>YOLOv11m (Medium) 학습 요약</h1>
        <div className={styles.slideSubtitle} style={{ marginBottom: 13, color: '#6f8298', fontSize: 17 }}>2차 실패 원인을 분리하고 3차에서 최종 탐지 후보를 선정 · m은 Medium 규모 모델을 의미</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%' }}>{runs.map((run) => <RunCard key={run.name} {...run} />)}</div>
        <section style={{ marginTop: 15, display: 'grid', gridTemplateColumns: '1.06fr 0.94fr', gap: 16, width: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid #e6eef4', borderRadius: 20, padding: '18px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)' }}>
            <div style={{ color: '#ef4444', fontSize: 18.5, fontWeight: 950, marginBottom: 10 }}>2차 실패 수정 포인트</div>
            <div style={{ display: 'grid', gap: 8 }}>{fixes.map(([k, v, d]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '80px 1.15fr 0.95fr', gap: 8, alignItems: 'center', background: '#f8fbfd', border: '1px solid #e2eaf0', borderRadius: 13, padding: '10px 12px' }}><div style={{ color: '#334155', fontSize: 14.5, fontWeight: 950 }}>{k}</div><div style={{ color: '#2563eb', fontSize: 15.2, fontWeight: 950 }}>{v}</div><div style={{ color: '#64748b', fontSize: 13.8, fontWeight: 780 }}>{d}</div></div>)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #a7f3d0', borderRadius: 20, padding: '20px', boxShadow: '0 10px 28px rgba(16, 185, 129, 0.16)' }}>
            <div style={{ color: '#047857', fontSize: 18.5, fontWeight: 950, marginBottom: 8 }}>최종 판단</div>
            <div style={{ color: '#064e3b', fontSize: 31, lineHeight: 1.12, fontWeight: 950 }}>YOLOv11m (Medium) v3<br />best.pt 권장</div>
            <div style={{ marginTop: 12, color: '#334155', fontSize: 16.2, lineHeight: 1.42, fontWeight: 800 }}>1차 대비 mAP 상승 · 학습 시간 정상 범위 회복</div>
            <div style={{ marginTop: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><MiniMetric label="mAP50" value="+0.07%p" /><MiniMetric label="mAP50-95" value="+0.42%p" /></div>
          </div>
        </section>
      </div><div className={styles.pageNumber}>16</div>
    </div>
  );
}
function RunCard({ name, tag, map50, map95, time, color, role, note }: { name: string; tag: string; map50: string; map95: string; time: string; color: string; role: string; note: string }) { return <section style={{ background: '#fff', border: '1px solid #e6eef4', borderTop: `7px solid ${color}`, borderRadius: 20, padding: '18px 17px 19px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)', display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ color, fontSize: 30, fontWeight: 950 }}>{name}</div><div style={{ color, background: `${color}12`, border: `1px solid ${color}35`, borderRadius: 999, padding: '6px 11px', fontSize: 13.5, fontWeight: 900 }}>{tag}</div></div><div style={{ color, fontSize: 17.2, fontWeight: 950, marginBottom: 10 }}>{role}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}><Score label="mAP50" value={map50} color={color} /><Score label="mAP95" value={map95} color={color} /><Score label="시간" value={time} color={color} /></div><div style={{ marginTop: 13, color: '#334155', fontSize: 15.5, lineHeight: 1.42, fontWeight: 820, minHeight: 62, display: 'flex', alignItems: 'center' }}>{note}</div></section>; }
function Score({ label, value, color }: { label: string; value: string; color: string }) { return <div style={{ minHeight: 66, background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 13, padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div style={{ color: '#64748b', fontSize: 13.2, fontWeight: 950 }}>{label}</div><div style={{ color, fontSize: 18.4, fontWeight: 950, marginTop: 4, lineHeight: 1.1 }}>{value}</div></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div style={{ background: '#fff', border: '1px solid #a7f3d0', borderRadius: 14, padding: '12px', textAlign: 'center' }}><div style={{ color: '#047857', fontSize: 13.5, fontWeight: 900 }}>{label}</div><div style={{ color: '#064e3b', fontSize: 23, fontWeight: 950, marginTop: 3 }}>{value}</div></div>; }
