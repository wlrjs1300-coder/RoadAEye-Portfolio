"use client";

import { useState } from "react";
import { ScanSearch, X } from "lucide-react";

type Detection = { label: string; confidence: string; color: string; x: number; y: number; w: number; h: number };
type ResultExample = {
  image: string;
  label: string;
  confidence: string;
  caption: string;
  color?: string;
  detections?: Detection[];
};

type AiAnalysisBadgeProps = {
  title: string;
  subtitle?: string;
  modelName: string;
  examples: ResultExample[];
  accent?: string;
  buttonRight?: number;
};

export default function AiAnalysisBadge({
  title,
  subtitle,
  modelName,
  examples,
  accent = "#0d9488",
  buttonRight = 220,
}: AiAnalysisBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        data-nav="true"
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="이미지 분석 결과 보기"
        style={{
          position: "absolute", top: 44, right: buttonRight, zIndex: 20,
          width: 48, height: 48, borderRadius: 16,
          border: `1px solid ${accent}35`, background: "linear-gradient(135deg,#fff,#f7fffb)",
          color: accent, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 20px rgba(91,140,174,.22)", cursor: "pointer"
        }}
      >
        <ScanSearch size={26} />
      </button>

      {open && (
        <div
          data-nav="true"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.62)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 1120, background: "linear-gradient(180deg,#ffffff,#f8fbfd)", borderRadius: 26, padding: "26px 30px 30px", boxShadow: "0 28px 80px rgba(0,0,0,.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: accent, background: `${accent}12`, border: `1px solid ${accent}32`, borderRadius: 999, padding: "6px 12px", fontSize: 14.5, fontWeight: 900, marginBottom: 9 }}>
                  <ScanSearch size={17} /> {modelName} 결과 예시
                </div>
                <div style={{ color: "#173a70", fontSize: 30, fontWeight: 950 }}>{title}</div>
                {subtitle && <div style={{ color: "#64748b", fontSize: 16.5, fontWeight: 780, marginTop: 6 }}>{subtitle}</div>}
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "#f1f5f9", color: "#334155", width: 38, height: 38, borderRadius: 14, cursor: "pointer" }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
              {examples.slice(0, 2).map((example) => (
                <ResultCard key={`${example.image}-${example.label}`} example={example} accent={example.color ?? accent} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultCard({ example, accent }: { example: ResultExample; accent: string }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #dce8f1", borderTop: `6px solid ${accent}`, borderRadius: 20, padding: 16, boxShadow: "0 10px 26px rgba(91,140,174,.12)" }}>
      <div style={{ position: "relative", height: 318, borderRadius: 15, overflow: "hidden", border: "1px solid #cbd5e1", background: "#111827" }}>
        <img src={example.image} alt={example.label} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        <div style={{ position: "absolute", top: 14, left: 14, background: accent, color: "#fff", borderRadius: 9, padding: "7px 11px", fontSize: 16, lineHeight: 1.1, fontWeight: 950, boxShadow: "0 4px 12px rgba(15,23,42,.24)" }}>
          {example.label} {example.confidence}
        </div>
        {example.detections?.map((d) => (
          <div key={`${d.label}-${d.x}-${d.y}`} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, border: `5px solid ${d.color}`, boxSizing: "border-box" }}>
            <div style={{ position: "absolute", left: -4, top: -33, background: d.color, color: "#fff", padding: "4px 8px", borderRadius: "6px 6px 0 0", fontSize: 14.5, fontWeight: 950, whiteSpace: "nowrap" }}>{d.label} {d.confidence}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, minHeight: 70, background: `${accent}0d`, border: `1px solid ${accent}28`, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center" }}>
        <div style={{ color: "#334155", fontSize: 16.4, lineHeight: 1.42, fontWeight: 820 }}>{example.caption}</div>
      </div>
    </section>
  );
}
