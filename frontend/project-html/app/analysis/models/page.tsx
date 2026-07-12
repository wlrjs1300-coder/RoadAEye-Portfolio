"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import styles from "./models.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

// AI 모델 비교 페이지 — /models 엔드포인트 기반 (백엔드 실제 스키마)

interface ModelRecord {
  version_no: number;
  model_name: string;
  version: string | null;
  map_score: number | null;
  precision_score: number | null;
  recall_score: number | null;
  model_path: string | null;
  notes: string | null;
  is_active: boolean;
  trained_at: string | null;
}

function detectArch(name: string): "Keras" | "YOLOv8" | "YOLOv11" | "기타" {
  const lower = name.toLowerCase();
  if (lower.includes("keras")) return "Keras";
  if (lower.includes("yolo") && (lower.includes("11") || lower.includes("v11"))) return "YOLOv11";
  if (lower.includes("yolo")) return "YOLOv8";
  return "기타";
}

const HIGHWAY_CLASSES = [
  "경운기", "전동 킥보드", "굴착기", "역주행 차량",
  "지게차", "트랙터", "휠체어", "일반 차량", "보행자", "오토바이",
];

const ARCH_CONFIGS = [
  {
    key: "Keras" as const,
    desc: "MobileNetV2 기반 FP16 TFLite 경량화 분류 모델 (10클래스)",
    color: "#e11d48",
    badgeBg: "rgba(225,29,72,0.12)",
    borderTop: "#e11d48",
    useCase: "고속도로 진입금지 차량 분류 · 이진 위험 판별",
    inputSize: "224 × 224 px",
    classes: HIGHWAY_CLASSES,
    features: ["MobileNetV2 백본 + FP16 양자화 경량화", "진입금지 차량 9종 / 허용 1종 이진 판별", "TFLite 최적화로 낮은 메모리 점유"],
  },
  {
    key: "YOLOv8" as const,
    desc: "You Only Look Once v8 — 실시간 객체 탐지 (구 버전)",
    color: "#3b82f6",
    badgeBg: "rgba(59,130,246,0.12)",
    borderTop: "#3b82f6",
    useCase: "프레임 단위 실시간 고속도로 진입금지 차량 탐지",
    inputSize: "640 × 640 px",
    classes: HIGHWAY_CLASSES,
    features: ["앵커프리 아키텍처 (소형 객체 탐지 개선)", "FPN + PAN Neck 멀티스케일 피처 융합", "CUDA GPU 최적화 추론"],
  },
  {
    key: "YOLOv11" as const,
    desc: "YOLO v11m — 최신 경량화 아키텍처 (현재 적용)",
    color: "#a855f7",
    badgeBg: "rgba(168,85,247,0.12)",
    borderTop: "#a855f7",
    useCase: "고속도로 CCTV 실시간 진입금지 차량 탐지",
    inputSize: "640 × 640 px",
    classes: HIGHWAY_CLASSES,
    features: ["C3k2 경량 블록 (파라미터 ~20% 절감)", "YOLOv8 대비 추론 속도 향상", "10클래스 고속도로 진입금지 차량 특화 학습"],
  },
] as const;

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return v.slice(0, 10);
}

function fmtPath(v: string | null): string {
  if (!v) return "—";
  const parts = v.split("/");
  return parts[parts.length - 1];
}

// 마지막 AI 테스트 결과 타입
interface LastTestResult {
  timestamp: string;
  keras:  { confidence: number | null; vehicle_class: string | null; is_prohibited: boolean };
  yolov8: { count: number; avg_confidence: number | null };
  yolov11:{ count: number; avg_confidence: number | null };
}

function loadLastTest(): LastTestResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ai_test_last");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ModelsPage() {
  const router = useRouter();
  usePageTitle("모델 관리");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastTest, setLastTest] = useState<LastTestResult | null>(null);

  // 마지막 테스트 결과 로드 + 페이지 포커스 시 갱신
  useEffect(() => {
    setLastTest(loadLastTest());
    const onFocus = () => setLastTest(loadLastTest());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  function fetchModels() {
    setLoading(true);
    setError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiCall("/models") as Promise<any>)
      .then((resp: any) => {
        if (resp?.success) setModels(resp.data.items ?? []);
        else setError("모델 데이터를 불러오지 못했습니다.");
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchModels(); }, []);

  function getArchModels(arch: string) {
    return models.filter(m => detectArch(m.model_name) === arch);
  }

  function getBestModel(arch: string): ModelRecord | null {
    const list = getArchModels(arch);
    if (list.length === 0) return null;
    const active = list.find(m => m.is_active);
    if (active) return active;
    return [...list].sort((a, b) => (b.map_score ?? 0) - (a.map_score ?? 0))[0];
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>AI 모델 비교</h2>
          <p>Keras, YOLOv8, YOLOv11 세 아키텍처의 성능 지표를 비교합니다.</p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchModels}
          disabled={loading}
          title="새로고침"
        >
          <RefreshCw size={13} className={loading ? styles.spinning : ""} />
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* 3개 비교 카드 */}
      <div className={styles.compareGrid}>
        {ARCH_CONFIGS.map(cfg => {
          const best = getBestModel(cfg.key);
          const allModels = getArchModels(cfg.key);
          const hasActive = allModels.some(m => m.is_active);

          return (
            <div
              key={cfg.key}
              className={styles.compareCard}
              style={{ borderTopColor: cfg.borderTop }}
            >
              <div className={styles.cardHeader}>
                <span
                  className={styles.archBadge}
                  style={{ background: cfg.badgeBg, color: cfg.color }}
                >
                  {cfg.key}
                </span>
                <div className={styles.cardTitleBlock}>
                  <div className={styles.cardTitle}>{cfg.key} 아키텍처</div>
                  <div className={styles.cardDesc}>{cfg.desc}</div>
                </div>
                {hasActive && <div className={styles.activePill}>● 운영중</div>}
              </div>

              <div className={styles.modelNameRow}>
                {loading ? (
                  <span className={styles.modelMuted}>불러오는 중...</span>
                ) : best ? (
                  <>
                    <span className={styles.modelName}>{best.model_name}</span>
                    {best.version && <span className={styles.modelVer}>v{best.version}</span>}
                  </>
                ) : (
                  <span className={styles.modelMuted}>등록된 모델 없음</span>
                )}
              </div>

              {(() => {
                // 아키텍처별로 lastTest에서 대응 지표 추출
                const lt = lastTest;
                let metrics: { label: string; raw: number | null; fromTest?: boolean }[];
                if (cfg.key === "Keras") {
                  metrics = [
                    { label: "mAP@50",  raw: best?.map_score       ?? null },
                    { label: "정밀도",  raw: best?.precision_score  ?? null },
                    { label: "재현율",  raw: best?.recall_score     ?? null },
                  ];
                  // 지표 없음 → notes(재학습 상태) 표시
                  if (!metrics[0].raw) {
                    const noteText = best?.notes ?? "성능 지표 업데이트 예정";
                    return (
                      <div className={styles.metrics}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "14px 10px", borderRadius: 8,
                          background: "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.3)",
                        }}>
                          <span style={{ fontSize: 18 }}>🔄</span>
                          <span style={{ fontSize: 12, color: "#b45309", fontWeight: 700, lineHeight: 1.5 }}>
                            {noteText}
                          </span>
                        </div>
                      </div>
                    );
                  }
                } else if (cfg.key === "YOLOv8") {
                  const testConf = lt?.yolov8.avg_confidence ?? null;
                  metrics = [
                    { label: "mAP@50",  raw: best?.map_score       ?? null },
                    { label: "정밀도",  raw: best?.precision_score  ?? null },
                    { label: "재현율",  raw: best?.recall_score     ?? null },
                  ];
                  if (!metrics[0].raw && testConf != null) {
                    metrics = [
                      { label: "탐지 평균 신뢰도", raw: testConf, fromTest: true },
                      { label: "탐지 건수", raw: Math.min((lt?.yolov8.count ?? 0) / 10, 1), fromTest: true },
                      { label: "재현율", raw: null },
                    ];
                  }
                } else {
                  const testConf = lt?.yolov11.avg_confidence ?? null;
                  metrics = [
                    { label: "mAP@50",  raw: best?.map_score       ?? null },
                    { label: "정밀도",  raw: best?.precision_score  ?? null },
                    { label: "재현율",  raw: best?.recall_score     ?? null },
                  ];
                  if (!metrics[0].raw && testConf != null) {
                    metrics = [
                      { label: "탐지 평균 신뢰도", raw: testConf, fromTest: true },
                      { label: "탐지 건수", raw: Math.min((lt?.yolov11.count ?? 0) / 10, 1), fromTest: true },
                      { label: "재현율", raw: null },
                    ];
                  }
                }
                return (
                  <div className={styles.metrics}>
                    {lt && metrics.some(m => m.fromTest) && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                        마지막 테스트 기준 · {new Date(lt.timestamp).toLocaleString("ko-KR", { hour12: false }).slice(0, 16)}
                      </div>
                    )}
                    {metrics.map(m => {
                      const displayVal = m.label === "탐지 건수"
                        ? (cfg.key === "YOLOv8" ? `${lt?.yolov8.count ?? 0}개` : `${lt?.yolov11.count ?? 0}개`)
                        : fmtPct(m.raw);
                      return (
                        <div key={m.label} className={styles.metricRow}>
                          <div className={styles.metricLabel} style={m.fromTest ? { color: cfg.color, fontWeight: 700 } : undefined}>
                            {m.label}
                          </div>
                          <div className={styles.metricBar}>
                            <div
                              className={styles.metricBarFill}
                              style={{ width: m.raw !== null ? `${m.raw * 100}%` : "0%", background: cfg.color }}
                            />
                          </div>
                          <div className={styles.metricValue}>{displayVal}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className={styles.extraRow}>
                <div className={styles.extraItem}>
                  <div className={styles.extraLabel}>학습일</div>
                  <div className={styles.extraValue}>{loading ? "—" : fmtDate(best?.trained_at ?? null)}</div>
                </div>
                <div className={styles.extraItem}>
                  <div className={styles.extraLabel}>입력 크기</div>
                  <div className={styles.extraValue} style={{ fontSize: 11 }}>{cfg.inputSize}</div>
                </div>
                <div className={styles.extraItem}>
                  <div className={styles.extraLabel}>등록 모델</div>
                  <div className={styles.extraValue}>{loading ? "—" : `${allModels.length}개`}</div>
                </div>
              </div>

              <div className={styles.modelMetaGrid}>
                <div className={styles.modelMetaItem}>
                  <span>파일</span>
                  <strong>{best ? fmtPath(best.model_path) : "등록 대기"}</strong>
                </div>
                <div className={styles.modelMetaItem}>
                  <span>메모</span>
                  <strong>{best ? best.notes || "기록 없음" : "모델 등록 후 표시"}</strong>
                </div>
              </div>

              {/* 탐지 클래스 */}
              <div className={styles.archInfoBlock}>
                <div className={styles.archInfoTitle}>탐지 클래스</div>
                <div className={styles.classTags}>
                  {(cfg.classes as readonly string[]).map(c => (
                    <span key={c} className={styles.classTag} style={{ borderColor: cfg.color + "55", color: cfg.color }}>{c}</span>
                  ))}
                </div>
              </div>

              {/* 주요 특징 */}
              <div className={styles.archInfoBlock}>
                <div className={styles.archInfoTitle}>주요 특징</div>
                <ul className={styles.featureList}>
                  {(cfg.features as readonly string[]).map(f => (
                    <li key={f} className={styles.featureItem}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* 활용 */}
              <div className={styles.useCaseRow} style={{ borderColor: cfg.color + "33", background: cfg.badgeBg }}>
                <span className={styles.useCaseLabel} style={{ color: cfg.color }}>활용</span>
                <span className={styles.useCaseText}>{cfg.useCase}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
