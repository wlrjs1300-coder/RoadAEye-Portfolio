import styles from './presentation.module.css';

type Tag = { label: string; tone?: 'db' | 'warn' };
type Server = {
  icon: string;
  vip?: string;
  name: string;
  ip: string;
  role: string;
  accent: string;
  tags: string[];
  badges: Tag[];
};

const servers: Server[] = [
  {
    icon: '🤖', vip: 'VIP localhost (BACKUP)', name: 'AI 서버', ip: 'localhost', role: 'FastAPI :8001', accent: '#7c3aed',
    tags: ['YOLO 추론', 'Keras 분류', 'LLM 챗봇'],
    badges: [{ label: 'ai_db (server-id=1)', tone: 'db' }],
  },
  {
    icon: '⚙️', vip: 'VIP localhost (MASTER)', name: 'Back-end 서버', ip: 'localhost', role: 'FastAPI :8000', accent: '#0d9488',
    tags: ['REST API', 'JWT 인증', 'AI 프록시'],
    badges: [{ label: 'member_db', tone: 'db' }, { label: 'board_db', tone: 'db' }, { label: 'chat_db', tone: 'db' }],
  },
  {
    icon: '</>', name: 'Front-end 서버', ip: 'localhost', role: 'Next.js :3000', accent: '#6366f1',
    tags: ['SSR / SSG', 'WebSocket', 'Leaflet 지도'],
    badges: [{ label: 'DB 직접 접속 없음', tone: 'warn' }],
  },
  {
    icon: '🗄️', vip: 'VIP localhost (MASTER)', name: 'DB 백업 서버', ip: 'localhost', role: 'MySQL :3306', accent: '#dc2626',
    tags: ['Keepalived', 'Failover 대기'],
    badges: [{ label: 'ai_db', tone: 'db' }, { label: 'member_db', tone: 'db' }, { label: 'board_db', tone: 'db' }, { label: 'chat_db', tone: 'db' }],
  },
];

const flows = [
  { from: 'CCTV (ITS API)', to: 'AI 서버', desc: 'RTSP/HTTP 실시간 스트림' },
  { from: 'AI 서버', to: 'Back-end', desc: 'REST API · WebSocket 감지 알림' },
  { from: 'Back-end', to: 'Front-end', desc: 'HTTP/JSON · SSE · WS' },
  { from: 'Back-end', to: 'DB (VIP)', desc: 'SQL Query (4개 DB)' },
];

const replPairs = [
  { left: 'localhost AI 서버', leftSub: 'ai_db MASTER', right: 'localhost DB 서버', rightSub: 'REPLICA + Failover' },
  { left: 'localhost Back 서버', leftSub: 'member/board/chat MASTER', right: 'localhost DB 서버', rightSub: 'REPLICA + Failover' },
];

function tagChip(label: string, tone: Tag['tone']) {
  if (tone === 'db') return { background: '#e9f7ef', color: '#1e7e44', border: '1px solid #c7ead4' };
  if (tone === 'warn') return { background: '#fef3e7', color: '#c2670a', border: '1px solid #f6dcb8' };
  return { background: '#eef3f7', color: '#46627a', border: '1px solid #dde8f0' };
}

export default function Chapter5_2() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '70px 50px 46px', boxSizing: 'border-box', alignItems: 'center' }}>
        <div className={styles.chapterBadge}>Chapter 5</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 22 }}>서버 구성도</h1>

        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
        {/* 상단: 4개 서버 노드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr', gap: 16, width: '100%', flex: '1.45 1 0', minHeight: 0 }}>
          {servers.map((s) => (
            <div key={s.name} style={{
              position: 'relative', background: '#ffffff', borderRadius: 16,
              border: '1px solid #e6eef4', boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
              padding: '22px 18px 20px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: s.accent }} />

              {/* VIP 칩 (높이 고정으로 정렬) */}
              <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
                {s.vip && (
                  <span style={{
                    background: `${s.accent}14`, border: `1px solid ${s.accent}33`, color: s.accent,
                    fontSize: 11.5, fontWeight: 800, padding: '4px 12px', borderRadius: 14, whiteSpace: 'nowrap',
                  }}>{s.vip}</span>
                )}
              </div>

              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${s.accent}14`, border: `1px solid ${s.accent}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.icon === '</>' ? 23 : 30, fontWeight: 800, color: s.accent,
              }}>{s.icon}</div>

              <div style={{ fontSize: 21, fontWeight: 800, color: '#1f2d3d', letterSpacing: '-0.3px' }}>{s.name}</div>
              <div style={{ fontSize: 15, color: '#2563eb', fontWeight: 700, fontFamily: 'monospace' }}>{s.ip}</div>
              <div style={{
                background: s.accent, color: '#fff', fontSize: 14.5, fontWeight: 800,
                padding: '5px 16px', borderRadius: 16,
              }}>{s.role}</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginTop: 2 }}>
                {s.tags.map((t) => (
                  <span key={t} style={{
                    background: '#f0f5f9', color: '#46627a', border: '1px solid #dde8f0',
                    padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  }}>{t}</span>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 2 }}>
                {s.badges.map((b) => (
                  <span key={b.label} style={{
                    ...tagChip(b.label, b.tone), padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  }}>{b.label}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 하단: 데이터 흐름 + Replication */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr', gap: 16, width: '100%', flex: '1.1 1 0', minHeight: 0 }}>
          {/* 데이터 흐름 */}
          <div style={{
            position: 'relative', background: '#ffffff', borderRadius: 16,
            border: '1px solid #e6eef4', boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
            padding: '24px 26px', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#5B8CAE' }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1f2d3d', marginBottom: 14 }}>데이터 흐름</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flows.map((f) => (
                <div key={f.from + f.to} style={{ display: 'grid', gridTemplateColumns: '112px 28px 92px 1fr', alignItems: 'center', columnGap: 10 }}>
                  <span style={{
                    fontSize: 14.2, fontWeight: 800, color: '#5B8CAE', minWidth: 112,
                    background: '#eef4f8', padding: '6px 11px', borderRadius: 8, textAlign: 'center',
                  }}>{f.from}</span>
                  <span style={{ fontSize: 18, color: '#b0bdc7', fontWeight: 800, textAlign: 'center' }}>→</span>
                  <span style={{
                    fontSize: 14.2, fontWeight: 800, color: '#1f2d3d', minWidth: 92,
                    background: '#f3f6f9', padding: '6px 11px', borderRadius: 8, textAlign: 'center',
                  }}>{f.to}</span>
                  <span style={{ fontSize: 13.8, color: '#334155', fontWeight: 700, minWidth: 0 }}>{f.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DB 이중화 */}
          <div style={{
            position: 'relative', background: '#ffffff', borderRadius: 16,
            border: '1px solid #e6eef4', boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
            padding: '24px 26px', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#dc2626' }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1f2d3d', marginBottom: 14 }}>DB 이중화 (Master-Master Replication)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replPairs.map((p) => (
                <div key={p.leftSub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 900, color: '#1f2d3d' }}>{p.left}</div>
                    <div style={{ fontSize: 13.5, color: '#4a5568', fontWeight: 700 }}>{p.leftSub}</div>
                  </div>
                  <span style={{
                    fontSize: 13.8, color: '#d97706', fontWeight: 900, whiteSpace: 'nowrap',
                    background: '#fef3e7', border: '1px solid #f6dcb8', padding: '6px 12px', borderRadius: 13,
                  }}>binlog ↔</span>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 900, color: '#1f2d3d' }}>{p.right}</div>
                    <div style={{ fontSize: 13.5, color: '#4a5568', fontWeight: 700 }}>{p.rightSub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              textAlign: 'center', marginTop: 16, fontSize: 15.5, color: '#5B8CAE', fontWeight: 700,
              background: '#eef4f8', border: '1px solid #d8e6f0', borderRadius: 12, padding: '12px 14px',
            }}>
              Keepalived VIP localhost / localhost 기반 자동 Failover
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className={styles.pageNumber}>9</div>
    </div>
  );
}
