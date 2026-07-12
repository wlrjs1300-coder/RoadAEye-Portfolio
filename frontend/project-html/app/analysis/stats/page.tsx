"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw, AlertTriangle, Eye, TrendingUp, CalendarDays,
  ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import styles from "./stats.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface DailyData {
  total: number;
  by_class: { class_no: number; display_name: string; count: number }[];
  by_status: Record<string, number>;
  by_cctv: { cctv_no: number; name: string; count: number }[];
}
interface ClassItem { class_name: string; display_name: string; count: number; }

const LINE_COLOR  = "#ffb2af";   // 감지 추이 — 연한 핑크 (일반 막대)
const PEAK_COLOR  = "#e11d48";   // 감지 추이 — 진한 핑크 (최고값 막대)
const CLASS_COLOR = "#ffb2af";   // 위험 유형 — 연한 핑크 (일반 막대, 감지 추이 일반 막대와 동일)
const CLASS_PEAK  = "#e11d48";   // 위험 유형 — 최다 감지일 색상 (최고값 막대)
const TODAY = new Date().toISOString().slice(0, 10);
const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

const STATUS_ITEMS = [
  { key: "UNREAD",    label: "미처리",  color: "#e11d48" },
  { key: "CONFIRMED", label: "확인완료", color: "#16a34a" },
  { key: "DISMISSED", label: "기각",    color: "#6b7280" },
];

function addDays(base: string, n: number) {
  const d = new Date(base); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function datesBetween(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(from), end = new Date(to);
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return out;
}
function isoToLabel(iso: string) {
  const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`;
}
function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-"); return `${y}.${m}.${d}`;
}
function monthStart(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
function buildCells(y: number, m: number): (string | null)[] {
  const first = new Date(y, m, 1).getDay();
  const days  = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++)
    cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

/* ─── 캘린더 범위 피커 ─────────────────────────────────── */
function CalendarRangePicker({
  initFrom, initTo, onApply,
}: { initFrom: string; initTo: string; onApply: (f: string, t: string) => void }) {
  const init = new Date(initFrom);
  const [vy, setVy] = useState(init.getFullYear());
  const [vm, setVm] = useState(init.getMonth());          // 0-indexed, left month
  const [start,  setStart]  = useState(initFrom);
  const [end,    setEnd]    = useState(initTo);
  const [hover,  setHover]  = useState<string | null>(null);
  const [phase,  setPhase]  = useState<"from" | "to">("from");

  const right = new Date(vy, vm + 1, 1);
  const ry = right.getFullYear(), rm = right.getMonth();

  function prev() { const d = new Date(vy, vm - 1, 1); setVy(d.getFullYear()); setVm(d.getMonth()); }
  function next() { const d = new Date(vy, vm + 1, 1); setVy(d.getFullYear()); setVm(d.getMonth()); }

  function clickDay(iso: string) {
    if (iso > TODAY) return;
    if (phase === "from") {
      setStart(iso); setEnd(iso); setPhase("to");
    } else {
      if (iso < start) { setStart(iso); setEnd(start); setPhase("to"); }
      else             { setEnd(iso);   setPhase("from"); }
    }
  }

  function preset(days: number) {
    const from = addDays(TODAY, -(days - 1));
    setStart(from); setEnd(TODAY); setPhase("from");
    const d = new Date(from); setVy(d.getFullYear()); setVm(d.getMonth());
  }
  function presetThisMonth() {
    const d = new Date();
    const s = monthStart(d.getFullYear(), d.getMonth());
    setStart(s); setEnd(TODAY); setPhase("from");
    setVy(d.getFullYear()); setVm(d.getMonth());
  }

  const effEnd = phase === "to" && hover && hover >= start ? hover : end;

  function dayClass(iso: string) {
    const isS = iso === start;
    const isE = iso === effEnd && iso !== start;
    const isR = iso > start && iso < effEnd;
    const isFut = iso > TODAY;
    const isTod = iso === TODAY;
    return [
      styles.calDay,
      isS   ? styles.calDayStart  : "",
      isE   ? styles.calDayEnd    : "",
      isR   ? styles.calDayRange  : "",
      isFut ? styles.calDayFuture : "",
      isTod ? styles.calDayToday  : "",
      parseInt(iso.slice(8)) === new Date(iso).getDay() - new Date(iso).getDay() ? "" : "",  // placeholder
    ].filter(Boolean).join(" ");
  }

  function renderGrid(y: number, m: number) {
    return buildCells(y, m).map((iso, i) => {
      if (!iso) return <span key={i} />;
      const dow = new Date(iso).getDay();
      return (
        <button
          key={iso}
          className={dayClass(iso)}
          style={{ color: dow === 0 ? "var(--cal-sun)" : dow === 6 ? "var(--cal-sat)" : undefined }}
          onClick={() => clickDay(iso)}
          onMouseEnter={() => phase === "to" && setHover(iso)}
          onMouseLeave={() => setHover(null)}
          disabled={iso > TODAY}
        >
          {parseInt(iso.slice(8))}
        </button>
      );
    });
  }

  const mLabel = (y: number, m: number) =>
    new Date(y, m, 1).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  return (
    <div className={styles.calPanel}>
      {/* 퀵 프리셋 */}
      <div className={styles.calPresets}>
        {[
          { l: "오늘",   fn: () => { setStart(TODAY); setEnd(TODAY); setPhase("from"); } },
          { l: "7일",    fn: () => preset(7)   },
          { l: "30일",   fn: () => preset(30)  },
          { l: "90일",   fn: () => preset(90)  },
          { l: "이번달", fn: presetThisMonth   },
        ].map(({ l, fn }) => (
          <button key={l} className={styles.calPresetBtn} onClick={fn}>{l}</button>
        ))}
      </div>

      {/* 두 달 그리드 */}
      <div className={styles.calGridWrap}>
        {/* 왼쪽 달 */}
        <div className={styles.calMonth}>
          <div className={styles.calMonthHeader}>
            <button className={styles.calNavBtn} onClick={prev}><ChevronLeft size={13} /></button>
            <span className={styles.calMonthLabel}>{mLabel(vy, vm)}</span>
            <span style={{ width: 24 }} />
          </div>
          <div className={styles.calDayNames}>
            {DAY_KO.map((d, i) => (
              <span key={d} className={styles.calDayName}
                style={{ color: i === 0 ? "var(--cal-sun)" : i === 6 ? "var(--cal-sat)" : undefined }}>
                {d}
              </span>
            ))}
          </div>
          <div className={styles.calDaysGrid}>{renderGrid(vy, vm)}</div>
        </div>

        <div className={styles.calDivider} />

        {/* 오른쪽 달 */}
        <div className={styles.calMonth}>
          <div className={styles.calMonthHeader}>
            <span style={{ width: 24 }} />
            <span className={styles.calMonthLabel}>{mLabel(ry, rm)}</span>
            <button className={styles.calNavBtn} onClick={next}><ChevronRight size={13} /></button>
          </div>
          <div className={styles.calDayNames}>
            {DAY_KO.map((d, i) => (
              <span key={d} className={styles.calDayName}
                style={{ color: i === 0 ? "var(--cal-sun)" : i === 6 ? "var(--cal-sat)" : undefined }}>
                {d}
              </span>
            ))}
          </div>
          <div className={styles.calDaysGrid}>{renderGrid(ry, rm)}</div>
        </div>
      </div>

      {/* 푸터 */}
      <div className={styles.calFooter}>
        <div className={styles.calSelected}>
          <span className={styles.calSelectedDate}>{isoToDisplay(start)}</span>
          <span className={styles.calSelectedSep}>→</span>
          <span className={styles.calSelectedDate}>{isoToDisplay(effEnd)}</span>
          <span className={styles.calSelectedDays}>({datesBetween(start, effEnd).length}일)</span>
        </div>
        <button
          className={styles.calApplyBtn}
          disabled={phase === "to"}
          onClick={() => onApply(start, end)}
        >
          적용
        </button>
      </div>
    </div>
  );
}

/* ─── 메인 페이지 ──────────────────────────────────────── */
export default function StatsPage() {
  usePageTitle("통계 분석");
  const [dateFrom, setDateFrom] = useState(() => addDays(TODAY, -29));
  const [dateTo,   setDateTo]   = useState(TODAY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [trend,        setTrend]        = useState<{ date: string; total: number }[]>([]);
  const [cctvRank,     setCctvRank]     = useState<{ cctv_no: number; name: string; count: number }[]>([]);
  const [classItems,   setClassItems]   = useState<ClassItem[]>([]);
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({});
  const [totalCount,   setTotalCount]   = useState<number | null>(null);
  const [unread,       setUnread]       = useState<number | null>(null);
  const [peakDay,      setPeakDay]      = useState<{ date: string; total: number } | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; };
  }, []);

  const fetchAll = useCallback(async (from: string, to: string) => {
    setLoading(true); setError("");
    try {
      const dates = datesBetween(from, to);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const daily: { date: string; data: DailyData | null }[] = await Promise.all(
        dates.map(d =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          apiCall(`/cctv/stats/daily?date=${d}`).then((r: any) => ({ date: d, data: r?.success ? r.data : null }))
          .catch(() => ({ date: d, data: null }))
        )
      );

      const trendData = daily.map(r => ({ date: r.date, total: r.data?.total ?? 0 }));
      setTrend(trendData);

      const tot = trendData.reduce((s, d) => s + d.total, 0);
      setTotalCount(tot);
      const pk = trendData.reduce((a, b) => a.total >= b.total ? a : b, { date: "", total: 0 });
      setPeakDay(pk.total > 0 ? pk : null);

      const cctvMap = new Map<number, { name: string; count: number }>();
      for (const r of daily)
        for (const c of r.data?.by_cctv ?? []) {
          const cur = cctvMap.get(c.cctv_no);
          cur ? (cur.count += c.count) : cctvMap.set(c.cctv_no, { name: c.name, count: c.count });
        }
      setCctvRank(Array.from(cctvMap.entries()).map(([id, v]) => ({ cctv_no: id, ...v })).sort((a, b) => b.count - a.count));

      const stMap: Record<string, number> = {};
      for (const r of daily)
        for (const [k, v] of Object.entries(r.data?.by_status ?? {}))
          stMap[k] = (stMap[k] ?? 0) + (v as number);
      setStatusTotals(stMap);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // heatmap/classes는 CCTV별 데이터 → 클래스별로 flatten 집계
      const clsR: any = await apiCall(`/cctv/stats/heatmap/classes?date_from=${from}&date_to=${to}`).catch(() => null);
      const cctvItems: any[] = clsR?.success ? (clsR.data?.items ?? []) : [];
      const clsAgg = new Map<string, { display_name: string; count: number }>();
      for (const cctv of cctvItems) {
        for (const c of cctv.classes ?? []) {
          const key = c.display_name ?? c.class_name;
          const cur = clsAgg.get(key);
          cur ? (cur.count += c.count) : clsAgg.set(key, { display_name: key, count: c.count });
        }
      }
      if (clsAgg.size > 0) {
        setClassItems(Array.from(clsAgg.values()).sort((a, b) => b.count - a.count) as ClassItem[]);
      } else {
        // 폴백: 일별 집계
        const clsMap = new Map<string, { display_name: string; count: number }>();
        for (const r of daily)
          for (const c of r.data?.by_class ?? []) {
            const cur = clsMap.get(c.display_name);
            cur ? (cur.count += c.count) : clsMap.set(c.display_name, { display_name: c.display_name, count: c.count });
          }
        setClassItems(Array.from(clsMap.entries()).map(([k, v]) => ({ class_name: k, ...v })).sort((a, b) => b.count - a.count));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unR: any = await apiCall("/cctv/stats/unread").catch(() => null);
      if (unR?.success) setUnread(unR.data.unread_count);
    } catch { setError("데이터를 불러오지 못했습니다."); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(dateFrom, dateTo); }, []); // eslint-disable-line

  function handleApply(from: string, to: string) {
    setDateFrom(from); setDateTo(to);
    setPickerOpen(false);
    fetchAll(from, to);
  }

  const dayCount    = datesBetween(dateFrom, dateTo).length;
  const avgPerDay   = totalCount !== null && dayCount > 0 ? (totalCount / dayCount).toFixed(1) : null;
  const totalStatus = Object.values(statusTotals).reduce((s, v) => s + v, 0);
  const intervalStep = Math.max(0, Math.floor(dayCount / 10) - 1);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>통계 리포트</h2>
          <p>기간별 전체 감지 현황 및 누적 통계를 확인합니다.</p>
        </div>
        <div className={styles.headerRight}>
          {/* 날짜 범위 트리거 */}
          <div className={styles.rangeWrap} ref={wrapRef}>
            <button
              className={`${styles.rangeBtn} ${pickerOpen ? styles.rangeBtnOpen : ""}`}
              onClick={() => setPickerOpen(v => !v)}
            >
              <CalendarDays size={14} />
              <span>{isoToDisplay(dateFrom)}</span>
              <span className={styles.rangeSep}>~</span>
              <span>{isoToDisplay(dateTo)}</span>
              <span className={styles.rangeDays}>{dayCount}일</span>
              <ChevronDown size={12} className={pickerOpen ? styles.chevronUp : ""} />
            </button>

            {pickerOpen && (
              <CalendarRangePicker
                initFrom={dateFrom}
                initTo={dateTo}
                onApply={handleApply}
              />
            )}
          </div>

          <button className={styles.refreshBtn} onClick={() => fetchAll(dateFrom, dateTo)} disabled={loading} title="새로고침">
            <RefreshCw size={13} className={loading ? styles.spinning : ""} />
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: "rgba(220,38,38,0.1)" }}>
            <AlertTriangle size={17} color="#e11d48" />
          </div>
          <div>
            <div className={styles.summaryLabel}>기간 내 총 감지 ({dayCount}일)</div>
            <div className={styles.summaryValue}>{loading ? "—" : (totalCount ?? 0).toLocaleString()}건</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: "rgba(234,179,8,0.1)" }}>
            <Eye size={17} color="#ca8a04" />
          </div>
          <div>
            <div className={styles.summaryLabel}>미확인 감지 (누적)</div>
            <div className={styles.summaryValue}>{loading || unread === null ? "—" : unread.toLocaleString()}건</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: "rgba(59,130,246,0.1)" }}>
            <TrendingUp size={17} color="#3b82f6" />
          </div>
          <div>
            <div className={styles.summaryLabel}>일 평균 감지</div>
            <div className={styles.summaryValue}>{loading || avgPerDay === null ? "—" : avgPerDay}건</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: "rgba(124,58,237,0.1)" }}>
            <CalendarDays size={17} color="#7c3aed" />
          </div>
          <div>
            <div className={styles.summaryLabel}>최다 감지일</div>
            <div className={styles.summaryValue} style={{ fontSize: "14px" }}>
              {loading || !peakDay ? "—" : `${isoToLabel(peakDay.date)} · ${peakDay.total.toLocaleString()}건`}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>감지 추이 ({isoToDisplay(dateFrom)} ~ {isoToDisplay(dateTo)})</div>
            <div className={styles.chartBody}>
              <div className={styles.chartInner}>
                {trend.length === 0 ? (
                  <div className={styles.chartEmpty}>{loading ? "불러오는 중..." : "데이터 없음"}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" tickFormatter={isoToLabel} tick={{ fontSize: 9 }} interval={intervalStep} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v}건`, "감지 수"]} labelFormatter={(v) => String(v)} />
                      <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                        {trend.map((e, i) => (
                          <Cell key={i} fill={peakDay && e.date === peakDay.date ? PEAK_COLOR : LINE_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>위험 유형별 감지 현황 (기간 누계)</div>
            <div className={styles.chartBody}>
              <div className={styles.chartInner}>
                {classItems.length === 0 ? (
                  <div className={styles.chartEmpty}>{loading ? "불러오는 중..." : "데이터 없음"}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classItems.map(c => ({ ...c, label: c.display_name }))}
                      margin={{ top: 4, right: 12, left: -10, bottom: 36 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v}건`, "감지 수"]} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {(() => {
                          // 동일 최고값 모두 강조
                          const maxVal = Math.max(...classItems.map(c => c.count));
                          return classItems.map((c, i) => (
                            <Cell key={i} fill={c.count === maxVal ? CLASS_PEAK : CLASS_COLOR} />
                          ));
                        })()}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.rankCard}>
            <div className={styles.chartTitle}>CCTV별 감지 순위 (기간 누계)</div>
            <div className={styles.rankTableWrap}>
              {cctvRank.length === 0 ? (
                <div className={styles.chartEmpty}>{loading ? "불러오는 중..." : "데이터 없음"}</div>
              ) : (
                <table className={styles.rankTable}>
                  <thead><tr><th>순위</th><th>CCTV명</th><th>감지 건수</th></tr></thead>
                  <tbody>
                    {cctvRank.slice(0, 10).map((c, i) => (
                      <tr key={c.cctv_no}>
                        <td className={styles.rankNo}>{i + 1}</td>
                        <td>{c.name}</td>
                        <td className={styles.rankCount}>{c.count.toLocaleString()}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className={styles.statusCard}>
            <div className={styles.chartTitle}>처리 현황 (기간 누계)</div>
            <div className={styles.statusRow}>
              {STATUS_ITEMS.map(({ key, label, color }) => {
                const cnt = statusTotals[key] ?? 0;
                const pct = totalStatus > 0 ? Math.round((cnt / totalStatus) * 100) : 0;
                return (
                  <div key={key} className={styles.statusItem}>
                    <div className={styles.statusLabel} style={{ color }}>{label}</div>
                    <div className={styles.statusBar}>
                      <div className={styles.statusBarFill} style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className={styles.statusCount}>{loading ? "—" : cnt.toLocaleString()}건</div>
                    <div className={styles.statusPct}>{loading ? "" : `${pct}%`}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
