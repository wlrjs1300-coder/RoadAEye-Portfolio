"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings } from "lucide-react";
import styles from "./settings.module.css";
import { NotificationPrefs, loadNotificationPrefs, saveNotificationPrefs } from "@/lib/settings";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface SystemConfig {
  config_no: number;
  alert_enabled: boolean;
  maintenance_mode: boolean;
  max_stream_count: number;
  its_auto_sync: boolean;
  its_sync_interval: number;
  updated_by: number | null;
  updated_at: string;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

export default function SettingsPage() {
  usePageTitle("설정");
  const [prefs, setPrefs] = useState<NotificationPrefs>({ enabled: true, danger: true, info: true });
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 시스템 설정 (관리자 전용)
  const [config, setConfig]   = useState<SystemConfig | null>(null);
  const [draft, setDraft]     = useState<Partial<SystemConfig>>({});
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving]   = useState(false);
  const [cfgError, setCfgError]     = useState("");
  const [cfgNotice, setCfgNotice]   = useState("");

  useEffect(() => {
    setPrefs(loadNotificationPrefs());
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(u.role === "admin");
    } catch { /* 무시 */ }
    setReady(true);
  }, []);

  const loadConfig = useCallback(async () => {
    setCfgLoading(true); setCfgError("");
    try {
      const res: any = await apiCall("/admin/system");
      if (res?.success) { setConfig(res.data); setDraft(res.data); }
    } catch (e: any) { setCfgError(e.message || "설정을 불러오지 못했습니다."); }
    setCfgLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) loadConfig(); }, [isAdmin, loadConfig]);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveNotificationPrefs(next);
  };

  const saveConfig = async () => {
    if (!config) return;
    setCfgSaving(true); setCfgError("");
    try {
      const body: any = {};
      if (draft.alert_enabled     !== config.alert_enabled)     body.alert_enabled     = draft.alert_enabled;
      if (draft.maintenance_mode  !== config.maintenance_mode)  body.maintenance_mode  = draft.maintenance_mode;
      if (draft.max_stream_count  !== config.max_stream_count)  body.max_stream_count  = draft.max_stream_count;
      if (draft.its_auto_sync     !== config.its_auto_sync)     body.its_auto_sync     = draft.its_auto_sync;
      if (draft.its_sync_interval !== config.its_sync_interval) body.its_sync_interval = draft.its_sync_interval;

      if (Object.keys(body).length === 0) {
        setCfgError("변경된 항목이 없습니다."); setCfgSaving(false); return;
      }
      const res: any = await apiCall("/admin/system", { method: "PUT", body: JSON.stringify(body) });
      if (res?.success) {
        setConfig(res.data); setDraft(res.data);
        setCfgNotice("설정이 저장되었습니다."); setTimeout(() => setCfgNotice(""), 3000);
      }
    } catch (e: any) { setCfgError(e.message || "저장에 실패했습니다."); }
    setCfgSaving(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><Settings size={26} className={styles.headerIcon} /> 환경설정</h2>
        <p>알림 관련 설정을 관리합니다.</p>
      </div>

      <div className={isAdmin ? styles.settingsGrid : styles.settingsGridSingle}>
        {/* 알림 설정 */}
        <section className={styles.section}>
        <h3 className={styles.sectionTitle}>알림 설정</h3>
        <p className={styles.sectionDesc}>상단 종 아이콘의 알림 표시 여부를 설정합니다.</p>

        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowTitle}>알림 받기</span>
            <span className={styles.rowSub}>전체 알림 표시를 켜고 끕니다.</span>
          </div>
          <Toggle checked={prefs.enabled} disabled={!ready} onChange={(v) => update({ enabled: v })} />
        </div>

        {isAdmin && (
          <>
            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <span className={styles.rowTitle}>위험 감지 알림</span>
                <span className={styles.rowSub}>낙하물·역주행·과속 등 위험 감지 알림</span>
              </div>
              <Toggle
                checked={prefs.danger}
                disabled={!ready || !prefs.enabled}
                onChange={(v) => update({ danger: v })}
              />
            </div>

            <div className={styles.row}>
              <div className={styles.rowLabel}>
                <span className={styles.rowTitle}>시스템 알림</span>
                <span className={styles.rowSub}>점검·CCTV 상태 등 시스템 알림</span>
              </div>
              <Toggle
                checked={prefs.info}
                disabled={!ready || !prefs.enabled}
                onChange={(v) => update({ info: v })}
              />
            </div>
          </>
        )}
      </section>

        {/* 시스템 설정 — 관리자 전용 */}
        {isAdmin && (
          <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>시스템 설정</h3>
            <span className={styles.adminOnlyBadge}>관리자 전용</span>
          </div>
          <p className={styles.sectionDesc}>관리자만 변경할 수 있는 서비스 운영 전역 설정입니다.</p>

          {cfgError  && <div className={styles.cfgErrorBox}>{cfgError}</div>}
          {cfgNotice && <div className={styles.cfgNoticeBox}>{cfgNotice}</div>}

          {cfgLoading ? (
            <p className={styles.rowSub} style={{ padding: "12px 0" }}>불러오는 중...</p>
          ) : !config ? (
            <p className={styles.rowSub} style={{ padding: "12px 0" }}>설정을 불러오지 못했습니다.</p>
          ) : (
            <>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>알림 활성화</span>
                  <span className={styles.rowSub}>감지 발생 시 알림을 발송합니다</span>
                </div>
                <Toggle
                  checked={!!draft.alert_enabled}
                  onChange={v => setDraft(d => ({ ...d, alert_enabled: v }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>점검 모드</span>
                  <span className={styles.rowSub}>활성화 시 일반 사용자 접근을 제한합니다</span>
                </div>
                <Toggle
                  checked={!!draft.maintenance_mode}
                  onChange={v => setDraft(d => ({ ...d, maintenance_mode: v }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>ITS 자동 동기화</span>
                  <span className={styles.rowSub}>ITS 데이터를 주기적으로 자동 동기화합니다</span>
                </div>
                <Toggle
                  checked={!!draft.its_auto_sync}
                  onChange={v => setDraft(d => ({ ...d, its_auto_sync: v }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>최대 스트림 수</span>
                  <span className={styles.rowSub}>동시 처리 가능한 최대 CCTV 스트림 수</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={styles.numInput}
                  value={draft.max_stream_count ?? config.max_stream_count}
                  onChange={e => setDraft(d => ({ ...d, max_stream_count: Number(e.target.value) }))}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>ITS 동기화 주기</span>
                  <span className={styles.rowSub}>ITS 자동 동기화 간격 (분 단위)</span>
                </div>
                <div className={styles.numRow}>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    className={styles.numInput}
                    value={draft.its_sync_interval ?? config.its_sync_interval}
                    onChange={e => setDraft(d => ({ ...d, its_sync_interval: Number(e.target.value) }))}
                  />
                  <span className={styles.unit}>분</span>
                </div>
              </div>

              <div className={styles.cfgFooter}>
                <span className={styles.cfgMeta}>마지막 수정: {config.updated_at ? config.updated_at.replace("T", " ").slice(0, 16) : "—"}</span>
                <button className={styles.saveBtn} onClick={saveConfig} disabled={cfgSaving}>
                  {cfgSaving ? "저장 중..." : "변경사항 저장"}
                </button>
              </div>
            </>
          )}
          </section>
        )}
      </div>

      <p className={styles.note}>
        ※ 알림 설정은 현재 이 브라우저에 저장됩니다. 기기 간 동기화는 백엔드 설정 API 연동 후 지원될 예정입니다.
      </p>
    </div>
  );
}
