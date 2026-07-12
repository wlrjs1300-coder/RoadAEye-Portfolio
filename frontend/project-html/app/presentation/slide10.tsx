
import styles from './presentation.module.css';

type Server = {
  icon: string;
  accent: string;
  vip?: string;
  name: string;
  ip: string;
  role?: string;
  dbs: string[];
  note?: string;
};

const servers: Server[] = [
  {
    icon: '🤖', accent: '#7c3aed', vip: 'VIP localhost', name: 'AI 서버', ip: 'localhost',
    role: 'PRIMARY (MASTER)', dbs: ['ai_db (server-id=1)'],
  },
  {
    icon: '⚙️', accent: '#0d9488', vip: 'VIP localhost', name: 'Back-end 서버', ip: 'localhost',
    role: 'PRIMARY (MASTER)', dbs: ['member_db (server-id=2)', 'board_db', 'chat_db'],
  },
  {
    icon: '</>', accent: '#6366f1', name: 'Front-end 서버', ip: 'localhost',
    dbs: [], note: 'JWT API 호출 · DB 직접 접속 불필요',
  },
];

const channels = [
  { db: 'ai_db', ch: 'ai-server', owner: 'AI 서버 전용 DB' },
  { db: 'member_db', ch: 'backend-server', owner: '회원/권한 데이터' },
  { db: 'board_db', ch: 'backend-server', owner: '게시판 데이터' },
  { db: 'chat_db', ch: 'backend-server', owner: '챗봇 대화 이력' },
];

const dbChip = { background: '#e9f7ef', color: '#1e7e44', border: '1px solid #c7ead4' } as const;
const card = {
  position: 'relative' as const,
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e6eef4',
  boxShadow: '0 6px 20px rgba(91,140,174,0.14)',
  overflow: 'hidden' as const,
};

export default function Chapter6_3() {
  return (
    <div className={styles.slide}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="ROAD A EYE" style={{ height: 40, width: 'auto', display: 'block' }} />
      </div>
      <div className={styles.teamBadge}>4조</div>

      <div className={styles.contentTop} style={{ height: '100%', padding: '52px 50px 16px' }}>
        <div className={styles.chapterBadge} style={{ marginBottom: 6 }}>Chapter 5</div>
        <h1 className={styles.slideTitle} style={{ marginBottom: 14 }}>DB 이중화</h1>

        <div style={{ width: '100%', padding: '0 28px', boxSizing: 'border-box', flex: 1, display: 'grid', gridTemplateRows: '214px 40px 270px', gap: 18, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, minHeight: 0 }}>
            {servers.map((s) => (
              <div key={s.name} style={{
                ...card,
                padding: '18px 20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: s.accent }} />

                <div style={{ height: 26, display: 'flex', alignItems: 'center' }}>
                  {s.vip ? (
                    <span style={{
                      background: `${s.accent}14`, border: `1px solid ${s.accent}33`, color: s.accent,
                      fontSize: 11.5, fontWeight: 900, padding: '3px 10px', borderRadius: 15, whiteSpace: 'nowrap',
                    }}>{s.vip}</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: 800 }}>Application Server</span>
                  )}
                </div>

                <div style={{
                  width: 52, height: 52, borderRadius: 11,
                  background: `${s.accent}14`, border: `1px solid ${s.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: s.icon === '</>' ? 22 : 28, fontWeight: 900, color: s.accent,
                }}>{s.icon}</div>

                <div style={{ fontSize: 19, fontWeight: 900, color: '#1f2d3d', letterSpacing: '-0.3px' }}>{s.name}</div>
                <div style={{ fontSize: 13.5, color: '#1f2d3d', fontWeight: 850, fontFamily: 'monospace' }}>{s.ip}</div>

                {s.role ? (
                  <span style={{ background: s.accent, color: '#fff', fontSize: 12.5, fontWeight: 900, padding: '5px 13px', borderRadius: 14 }}>{s.role}</span>
                ) : (
                  <span style={{ background: '#fef3e7', color: '#c2670a', border: '1px solid #f6dcb8', fontSize: 12.5, fontWeight: 850, padding: '5px 12px', borderRadius: 14 }}>DB 직접 접속 없음</span>
                )}

                {s.dbs.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 2 }}>
                    {s.dbs.map((d) => (
                      <span key={d} style={{ ...dbChip, fontSize: 11.5, fontWeight: 850, padding: '4px 8px', borderRadius: 8 }}>{d}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 750, textAlign: 'center', marginTop: 2 }}>{s.note}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: '70%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c',
              fontSize: 15.5, fontWeight: 900, borderRadius: 26, boxShadow: '0 6px 18px rgba(194, 65, 12, 0.10)',
            }}>
              <span style={{ fontSize: 20 }}>↕</span>
              <span>양방향 Master-Master Replication</span>
              <span style={{ fontSize: 13.5, color: '#d97706', background: '#ffffff', border: '1px solid #fed7aa', padding: '3px 10px', borderRadius: 14 }}>binlog</span>
              <span style={{ fontSize: 20 }}>↕</span>
            </div>
          </div>

          <div style={{ ...card, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 0, minHeight: 0, height: 270 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: '#dc2626' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '0.48fr 1.52fr', gap: 18, alignItems: 'center', minHeight: 0, height: 186, flexShrink: 0 }}>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 13, padding: '12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', alignSelf: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>🗄️</div>
                <div style={{ fontSize: 20, fontWeight: 950, color: '#1f2d3d', marginBottom: 4 }}>DB 백업 서버</div>
                <div style={{ fontSize: 15, color: '#1f2d3d', fontWeight: 900, fontFamily: 'monospace', marginBottom: 5 }}>localhost</div>
                <div style={{ background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 950, padding: '5px 8px', borderRadius: 12 }}>BACKUP (REPLICA) + Failover 대기</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'auto auto', gap: 12, minHeight: 0, alignContent: 'center', height: 186 }}>
                {channels.map((c) => (
                  <div key={c.db} style={{
                    background: '#fbfcfe', border: '1px solid #e8eef4', borderRadius: 13,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 72,
                  }}>
                    <div>
                      <span style={{ ...dbChip, display: 'inline-block', fontSize: 14.5, fontWeight: 950, padding: '4px 10px', borderRadius: 8 }}>{c.db}</span>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 850, marginTop: 4 }}>{c.owner}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 900, marginBottom: 2 }}>REPL. CHANNEL</div>
                      <div style={{ fontSize: 13.5, color: '#334155', fontWeight: 950 }}>{c.ch}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10, background: '#eef4f8', border: '1px solid #d8e6f0', borderRadius: 11, padding: '8px 14px', color: '#356a8c', fontSize: 13, lineHeight: 1.3, fontWeight: 850, textAlign: 'center' }}>
              Keepalived VIP 기반 장애 전환으로 Master 서버 장애 시 백업 DB 서버가 서비스 연속성을 유지합니다.
            </div>
          </div>
        </div>
      </div>

      <div className={styles.pageNumber}>10</div>
    </div>
  );
}
