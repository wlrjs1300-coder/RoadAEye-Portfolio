import styles from './presentation.module.css';
import ModelGraphBadge from './ModelGraphBadge';
import AiAnalysisBadge from './AiAnalysisBadge';


export default function Chapter7Yolov8() {
  return (
    <div className={styles.slide}>
      <ModelGraphBadge
        title="YOLOv8n vs YOLOv8s 비교 그래프"
        subtitle="Nano와 Small의 탐지 성능, 속도, 운영 적합도 비교"
        metrics={[
          { label: '탐지 정확도 기대치', min: 0, max: 100, items: [{ label: 'YOLOv8n', value: 78, color: '#2563eb' }, { label: 'YOLOv8s', value: 88, color: '#0d9488' }] },
          { label: '정밀도 기대치', min: 0, max: 100, items: [{ label: 'YOLOv8n', value: 76, color: '#2563eb' }, { label: 'YOLOv8s', value: 86, color: '#0d9488' }] },
          { label: 'mAP 기대치', min: 0, max: 100, items: [{ label: 'YOLOv8n', value: 74, color: '#2563eb' }, { label: 'YOLOv8s', value: 85, color: '#0d9488' }] },
          { label: '추론 속도', min: 0, max: 100, items: [{ label: 'YOLOv8n', value: 96, color: '#2563eb' }, { label: 'YOLOv8s', value: 82, color: '#0d9488' }] },
        ]}
      />
      <AiAnalysisBadge
        accent="#0d9488"
        title="YOLOv8s 이미지 탐지 결과"
        subtitle="YOLOv8s 모델로 객체 위치와 신뢰도를 확인한 대표 결과 2건"
        modelName="YOLOv8s"
        examples={[
          {
            image: '/images/dashboard-cctv/전동 킥보드.png',
            label: 'Electric Scooter',
            confidence: '88%',
            caption: '전동 킥보드 위치와 신뢰도를 탐지한 결과입니다.',
            color: '#0d9488',
            detections: [{ label: 'Electric Scooter', confidence: '88%', color: '#0d9488', x: 26, y: 43, w: 6, h: 27 }],
          },
          {
            image: '/images/dashboard-cctv/지게차.png',
            label: 'Stacker',
            confidence: '91%',
            caption: '지게차 위치와 신뢰도를 탐지한 결과입니다.',
            color: '#2563eb',
            detections: [{ label: 'Stacker', confidence: '91%', color: '#2563eb', x: 25, y: 41, w: 9, h: 27 }],
          },
        ]}
      />
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ height: '100%', padding: '48px 54px 28px' }}>
        <div className={styles.chapterBadge}>Chapter 7</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 6 }}>YOLOv8 모델 비교</h1>
        <div className={styles.slideSubtitle} style={{ marginBottom: 18, color: '#6f8298', fontSize: 18 }}>
          Nano는 빠른 실험용, Small은 실제 CCTV 탐지 후보로 비교
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%' }}>
          <ModelCard color="#2563eb" name="YOLOv8n" label="테스트용" headline="빠른 검증에 적합" specs={[['파라미터', '3.2M'], ['Epoch', '50'], ['Batch', '8'], ['입력', '640px']]} good={['학습·추론 속도 빠름', '초기 반복 실험에 적합']} limit={['작은 객체 탐지 한계', '원거리 CCTV 장면에 불리']} />
          <ModelCard color="#0d9488" name="YOLOv8s" label="서비스 후보" headline="실제 CCTV 장면에 더 적합" specs={[['파라미터', '11M'], ['Epoch', '50'], ['Batch', '16'], ['증강', 'mosaic']] } good={['작은 객체·원거리 탐지 유리', '표현력이 높아 가림 상황에 강함']} limit={['GPU 사용량 증가', 'YOLOv11과 최종 비교 필요']} />
        </div>

        <section style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '210px repeat(3, 1fr)', gap: 14, alignItems: 'stretch', width: '100%', background: '#fff', border: '1px solid #e6eef4', borderRadius: 20, padding: '24px 24px', boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)' }}>
          <div style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)', color: '#fff', borderRadius: 16, padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', fontSize: 24, lineHeight: 1.3, fontWeight: 950 }}>
            결론<br />YOLOv8s 우세
          </div>
          <Conclusion title="탐지 품질" text="Small의 원거리·소형 객체 탐지 우세" color="#0d9488" />
          <Conclusion title="실험 역할" text="Nano는 빠른 테스트용 · Small은 서비스 후보" color="#2563eb" />
          <Conclusion title="다음 판단" text="YOLOv11m 비교 후 최종 모델 선정" color="#7c3aed" />
        </section>
      </div>
      <div className={styles.pageNumber}>15</div>
    </div>
  );
}

function ModelCard({ color, name, label, headline, specs, good, limit }: { color: string; name: string; label: string; headline: string; specs: string[][]; good: string[]; limit: string[] }) {
  return <section style={{ background: '#fff', border: '1px solid #e6eef4', borderTop: `7px solid ${color}`, borderRadius: 22, padding: '25px 24px', minHeight: 300, boxShadow: '0 10px 28px rgba(91, 140, 174, 0.13)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
      <div style={{ color, fontSize: 33, fontWeight: 950 }}>{name}</div>
      <div style={{ color, background: `${color}12`, border: `1px solid ${color}35`, borderRadius: 999, padding: '7px 11px', fontSize: 14.5, fontWeight: 900 }}>{label}</div>
    </div>
    <div style={{ color: '#334155', fontSize: 22, lineHeight: 1.28, fontWeight: 950 }}>{headline}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 17 }}>
      {specs.map(([k, v]) => <div key={k} style={{ background: '#f8fbfd', border: '1px solid #e2eaf0', borderRadius: 13, padding: '13px 9px', textAlign: 'center' }}><div style={{ color: '#64748b', fontSize: 13.2, fontWeight: 850 }}>{k}</div><div style={{ color: '#1f2d3d', fontSize: 19, fontWeight: 950, marginTop: 3 }}>{v}</div></div>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 17 }}><ListBox title="장점" items={good} color={color} /><ListBox title="한계" items={limit} color="#e11d48" /></div>
  </section>;
}
function ListBox({ title, items, color }: { title: string; items: string[]; color: string }) { return <div style={{ background: `${color}0d`, border: `1px solid ${color}30`, borderRadius: 15, padding: '15px' }}><div style={{ color, fontSize: 17.5, fontWeight: 950, marginBottom: 6 }}>{title}</div>{items.map((item) => <div key={item} style={{ color: '#334155', fontSize: 15.5, lineHeight: 1.42, fontWeight: 760, marginTop: 5 }}>• {item}</div>)}</div>; }
function Conclusion({ title, text, color }: { title: string; text: string; color: string }) { return <div style={{ background: `${color}0f`, border: `1px solid ${color}30`, borderRadius: 16, padding: '18px 16px' }}><div style={{ color, fontSize: 18, fontWeight: 950, marginBottom: 5 }}>{title}</div><div style={{ color: '#334155', fontSize: 15.8, lineHeight: 1.45, fontWeight: 760 }}>{text}</div></div>; }
