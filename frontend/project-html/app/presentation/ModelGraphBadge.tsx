"use client";

import { useState } from "react";
import { BarChart3, X } from "lucide-react";

type GraphItem = { label: string; value: number | null; color?: string; note?: string };
type GraphMetric = { label: string; unit?: string; items: GraphItem[]; min?: number; max?: number };

export default function ModelGraphBadge({ title, subtitle, metrics }: { title: string; subtitle?: string; metrics: GraphMetric[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        data-nav="true"
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="그래프 보기"
        style={{
          position: "absolute", top: 44, right: 164, zIndex: 20,
          width: 48, height: 48, borderRadius: 16,
          border: "1px solid #cfe0ec", background: "linear-gradient(135deg,#fff,#eef7ff)",
          color: "#173a70", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 20px rgba(91,140,174,.22)", cursor: "pointer"
        }}
      >
        <BarChart3 size={26} />
      </button>
      {open && (
        <div
          data-nav="true"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.62)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 1120, maxHeight: "88vh", background: "linear-gradient(180deg,#ffffff,#f8fbfd)", borderRadius: 26, padding: "26px 30px", boxShadow: "0 28px 80px rgba(0,0,0,.35)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ color: "#173a70", fontSize: 30, fontWeight: 950 }}>{title}</div>
                {subtitle && <div style={{ color: "#64748b", fontSize: 16.5, fontWeight: 780, marginTop: 6 }}>{subtitle}</div>}
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "#f1f5f9", color: "#334155", width: 38, height: 38, borderRadius: 14, cursor: "pointer" }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: metrics.length === 1 ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              {metrics.map((metric) => <MetricChart key={metric.label} metric={metric} />)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetricChart({ metric }: { metric: GraphMetric }) {
  const values = metric.items.map(i => i.value).filter((v): v is number => typeof v === "number");
  const max = metric.max ?? Math.max(...values, 100);
  const min = metric.min ?? 0;
  const wide = metric.items.length >= 10;
  const chartHeight = wide ? 214 : 176;
  const barMax = wide ? 154 : 122;
  return (
    <section style={{ gridColumn: wide ? "1 / -1" : undefined, background: "linear-gradient(180deg,#ffffff,#f8fbfd)", border: "1px solid #dce8f1", borderTop: `6px solid ${metric.items.find(i => i.value === max)?.color ?? "#2563eb"}`, borderRadius: 20, padding: wide ? "18px 20px" : "16px 18px", boxShadow: "0 10px 26px rgba(91,140,174,.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: wide ? 14 : 12 }}>
        <div>
          <div style={{ color: "#1f2d3d", fontSize: wide ? 22 : 20, fontWeight: 950 }}>{metric.label}</div>
          {wide && <div style={{ color: "#64748b", fontSize: 13.5, fontWeight: 800, marginTop: 3 }}>전체 학습 차수 흐름과 실패 실험을 한 번에 확인</div>}
        </div>
        <div style={{ color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 999, padding: "6px 10px", fontSize: 13.5, fontWeight: 900 }}>{metric.unit ?? "%"}</div>
      </div>
      <div style={{ height: chartHeight, display: "flex", alignItems: "end", gap: wide ? 12 : 10, padding: wide ? "12px 12px 0" : "10px 10px 0", borderBottom: "2px solid #d8e3ec", background: "linear-gradient(to top,#eef6ff 0%,#ffffff 76%)", borderRadius: 15, position: "relative" }}>
        <div style={{ position: "absolute", left: 12, right: 12, top: wide ? 38 : 30, borderTop: "1px dashed #cbd5e1" }} />
        {metric.items.map((item) => {
          const empty = item.value == null;
          const pct = empty ? 0 : Math.max(0.04, Math.min(1, ((item.value! - min) / Math.max(max - min, 1))));
          const decimals = item.value == null ? 0 : item.value % 1 ? (metric.unit === "score" ? 2 : 1) : 0;
          return (
            <div key={item.label} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", minWidth: 0, position: "relative", zIndex: 1 }}>
              <div style={{ color: item.color ?? "#2563eb", fontSize: wide ? 12.8 : 13, fontWeight: 950, marginBottom: 5, height: 17 }}>{empty ? "-" : item.value!.toFixed(decimals)}</div>
              <div style={{ width: wide ? "58%" : "68%", height: `${pct * barMax}px`, borderRadius: "8px 8px 0 0", background: empty ? "#e2e8f0" : `linear-gradient(to top, ${item.color ?? "#2563eb"}bb, ${item.color ?? "#2563eb"})`, boxShadow: empty ? "none" : `0 6px 16px ${(item.color ?? "#2563eb")}38` }} />
              <div style={{ color: "#334155", fontSize: wide ? 12 : 12.5, fontWeight: 900, marginTop: 8, textAlign: "center", lineHeight: 1.12, whiteSpace: "nowrap" }}>{item.label}</div>
              {item.note && <div style={{ color: "#64748b", fontSize: 10.5, fontWeight: 750, marginTop: 3 }}>{item.note}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
