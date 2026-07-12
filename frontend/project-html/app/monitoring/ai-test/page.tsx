"use client";

import { useState, useRef } from "react";
import { usePageTitle } from "@/app/hooks/usePageTitle";
import { Upload, ImageIcon, CheckCircle, AlertTriangle, Loader2, RefreshCw, Film, Clock, BarChart3 } from "lucide-react";
import styles from "./ai-test.module.css";

interface KerasResult {
  vehicle_class: string;
  confidence: number;
  is_prohibited: boolean;
  prohibited_prob: number;
}

interface YoloDetection {
  class_name: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
  keras_score?: number;
}

interface YoloResult { count: number; results: YoloDetection[]; model?: string; }
interface EnsembleResult {
  keras: KerasResult | null;
  yolo_skipped: boolean;
  yolo: { model: string; count: number; results: YoloDetection[] };
  detail?: {
    yolov8:  { count: number; results: YoloDetection[] };
    yolov11: { count: number; results: YoloDetection[] };
  };
}

interface VideoAnalysisResult {
  video: {
    filename: string;
    fps: number | null;
    total_frames: number;
    duration_sec: number | null;
    sample_interval_sec: number;
    frames_analyzed: number;
    max_frames: number;
  };
  summary: {
    total_detections: number;
    frames_with_detections: number;
    yolo_skipped_frames: number;
    class_counts: Record<string, number>;
  };
  events: Array<{
    timestamp_sec: number;
    frame_index: number;
    detections: YoloDetection[];
  }>;
  frames: Array<{
    frame_index: number;
    timestamp_sec: number;
    keras: KerasResult | null;
    yolo_skipped: boolean;
    yolo: { count: number; results: YoloDetection[] };
    detail?: {
      yolov8:  { count: number; results: YoloDetection[] };
      yolov11: { count: number; results: YoloDetection[] };
    };
  }>;
}

// 서버측 프록시 경유 → API 키 노출 없이 road-ai 호출
const AI_URL = "/api/ai-proxy";
const AI_KEY = "";

const CLASS_KO: Record<string, string> = {
  "Cultivator": "경운기", "Electric Scooter": "전동 킥보드",
  "Excavator": "굴착기", "Rear Car": "역주행 차량",
  "Stacker": "지게차", "Tractor": "트랙터",
  "Wheelchair": "휠체어", "car": "일반 차량",
  "person": "보행자", "motorcycle": "오토바이",
};

function ConfBar({ value, danger }: { value: number; danger: boolean }) {
  return (
    <div className={styles.confBar}>
      <div className={styles.confFill} style={{ width: `${value * 100}%`, background: danger ? "#e11d48" : "#16a34a" }} />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.metaRow}><span>{label}</span><strong>{value}</strong></div>;
}

function DetList({ items }: { items: YoloDetection[] }) {
  if (items.length === 0) return <div className={styles.placeholder}><CheckCircle size={16} /> 탐지 없음</div>;
  return (
    <div className={styles.detectionList}>
      {items.map((d, i) => {
        const prohibited = d.class_name !== "car";
        return (
          <div key={i} className={`${styles.detItem} ${prohibited ? styles.detDanger : styles.detSafe}`}>
            <span className={styles.detClass}>{CLASS_KO[d.class_name] ?? d.class_name}</span>
            <span className={styles.detConf}>{(d.confidence * 100).toFixed(1)}%</span>
            {prohibited && <span className={styles.detBadge}>금지</span>}
          </div>
        );
      })}
    </div>
  );
}

function formatTime(sec: number | null | undefined) {
  if (sec == null || Number.isNaN(sec)) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

function VideoResults({ result }: { result: VideoAnalysisResult | null }) {
  if (!result) {
    return (
      <div className={styles.videoResults}>
        <div className={styles.videoEmptyCard}>
          <Film size={28} />
          <strong>영상 분석 대기 중</strong>
          <span>영상을 업로드한 뒤 분석을 시작하면 프레임별 앙상블 결과가 이곳에 표시됩니다.</span>
        </div>
      </div>
    );
  }

  const classEntries = Object.entries(result.summary.class_counts ?? {}).sort((a, b) => b[1] - a[1]);
  const events = result.events ?? [];

  return (
    <div className={styles.videoResults}>
      <div className={styles.videoSummaryCard}>
        <div className={styles.cardHeader}>
          <span className={styles.modelTag} style={{ background: "#0f172a" }}>영상 분석</span>
          <span className={styles.modelSub}>Keras 게이트 + YOLOv8/YOLOv11 Soft Voting</span>
        </div>
        <div className={styles.videoStatsGrid}>
          <div className={styles.videoStat}><Clock size={17} /><span>영상 길이</span><strong>{formatTime(result.video.duration_sec)}</strong></div>
          <div className={styles.videoStat}><BarChart3 size={17} /><span>분석 프레임</span><strong>{result.video.frames_analyzed}개</strong></div>
          <div className={styles.videoStat}><AlertTriangle size={17} /><span>탐지 객체</span><strong>{result.summary.total_detections}개</strong></div>
          <div className={styles.videoStat}><CheckCircle size={17} /><span>YOLO 생략</span><strong>{result.summary.yolo_skipped_frames}프레임</strong></div>
        </div>
      </div>

      <div className={styles.videoSummaryCard}>
        <div className={styles.videoSectionTitle}>객체별 탐지 집계</div>
        {classEntries.length === 0 ? (
          <div className={styles.placeholder}><CheckCircle size={16} /> 분석 프레임 내 탐지 객체 없음</div>
        ) : (
          <div className={styles.videoClassList}>
            {classEntries.map(([cls, count]) => (
              <div key={cls} className={styles.videoClassItem}>
                <span>{CLASS_KO[cls] ?? cls}</span>
                <strong>{count}회</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.videoSummaryCard}>
        <div className={styles.videoSectionTitle}>탐지 이벤트 타임라인</div>
        {events.length === 0 ? (
          <div className={styles.placeholder}>탐지 이벤트 없음</div>
        ) : (
          <div className={styles.videoEventList}>
            {events.slice(0, 20).map((event, idx) => (
              <div key={`${event.frame_index}-${idx}`} className={styles.videoEventItem}>
                <div className={styles.videoEventTime}>{formatTime(event.timestamp_sec)}</div>
                <div className={styles.videoEventBody}>
                  <strong>Frame #{event.frame_index}</strong>
                  <DetList items={event.detections} />
                </div>
              </div>
            ))}
            {events.length > 20 && <div className={styles.videoMore}>외 {events.length - 20}개 이벤트는 요약 집계에 반영되었습니다.</div>}
          </div>
        )}

      </div>
    </div>
  );
}

export default function AITestPage() {
  usePageTitle("AI 모델 테스트");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kerasResult, setKerasResult]       = useState<KerasResult | null>(null);
  const [kerasUnavailable, setKerasUnavailable] = useState(false); // 재학습 중 상태
  const [yolov8Result, setYolov8Result]     = useState<YoloResult | null>(null);
  const [yolov11Result, setYolov11Result]   = useState<YoloResult | null>(null);
  const [ensembleResult, setEnsembleResult] = useState<EnsembleResult | null>(null);
  const [videoResult, setVideoResult] = useState<VideoAnalysisResult | null>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const imgRef          = useRef<HTMLImageElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const videoCanvasRef  = useRef<HTMLCanvasElement>(null);

  const handleFile = (f: File) => {
    const isVideo = f.type.startsWith("video/");
    setFile(f); setPreview(URL.createObjectURL(f)); setMediaKind(isVideo ? "video" : "image");
    setKerasResult(null); setYolov8Result(null); setYolov11Result(null); setEnsembleResult(null); setVideoResult(null); setError(null);
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const headers: Record<string, string> = {};
    if (AI_KEY) headers["X-Api-Key"] = AI_KEY;

    const makeForm = () => { const fd = new FormData(); fd.append("file", file); return fd; };

    try {
      if (mediaKind === "video") {
        const res = await fetch(`${AI_URL}/api/v1/yolo/analyze-video?sample_interval_sec=1&max_frames=60`, {
          method: "POST",
          headers,
          body: makeForm(),
        });
        if (!res.ok) throw new Error(`영상 분석 오류: ${res.status}`);
        const data = await res.json();
        const result = data.data ?? data;
        setVideoResult(result);
        try {
          localStorage.setItem("ai_test_last_video", JSON.stringify({
            timestamp: new Date().toISOString(),
            frames_analyzed: result.video?.frames_analyzed ?? 0,
            total_detections: result.summary?.total_detections ?? 0,
            class_counts: result.summary?.class_counts ?? {},
          }));
        } catch {}
        return;
      }
      const [kr, v8r, v11r, er] = await Promise.all([
        fetch(`${AI_URL}/api/v1/keras/classify`,       { method: "POST", headers, body: makeForm() }),
        fetch(`${AI_URL}/api/v1/yolo/predict`,         { method: "POST", headers, body: makeForm() }),
        fetch(`${AI_URL}/api/v1/yolo/predict/v3`,      { method: "POST", headers, body: makeForm() }),
        fetch(`${AI_URL}/api/v1/yolo/predict/ensemble`,{ method: "POST", headers, body: makeForm() }),
      ]);

      // Keras 503 = 재학습 중 (오류 아님) — YOLO는 정상 실패 처리
      if (!v8r.ok) throw new Error(`YOLOv8 오류: ${v8r.status}`);
      if (!v11r.ok)throw new Error(`YOLOv11 오류: ${v11r.status}`);
      if (!er.ok)  throw new Error(`앙상블 오류: ${er.status}`);

      const [kd, v8d, v11d, ed] = await Promise.all([
        kr.ok ? kr.json() : Promise.resolve(null),
        v8r.json(), v11r.json(), er.json(),
      ]);

      // Keras 503 = 재학습 중, null 처리
      const keras  = kr.ok ? (kd?.data ?? kd) : null;
      if (!kr.ok) setKerasUnavailable(true);
      const yolov8  = v8d.data  ?? v8d;
      const yolov11 = v11d.data ?? v11d;
      const ensemble = ed.data ?? ed;

      setKerasResult(keras);
      setYolov8Result(yolov8);
      setYolov11Result(yolov11);
      setEnsembleResult(ensemble);

      // 모델 비교 페이지에서 "마지막 테스트 결과"로 활용하도록 localStorage 저장
      try {
        const v8Confs  = (yolov8.results  ?? []).map((d: any) => d.confidence as number);
        const v11Confs = (yolov11.results ?? []).map((d: any) => d.confidence as number);
        const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
        localStorage.setItem("ai_test_last", JSON.stringify({
          timestamp: new Date().toISOString(),
          keras:  { confidence: keras.prohibited_prob ?? null, vehicle_class: keras.vehicle_class ?? null, is_prohibited: keras.is_prohibited ?? false },
          yolov8: { count: yolov8.count ?? 0,  avg_confidence: avg(v8Confs)  },
          yolov11:{ count: yolov11.count ?? 0, avg_confidence: avg(v11Confs) },
        }));
      } catch {}

      // YOLOv11 바운딩박스 그리기
      setTimeout(() => drawBoxes(yolov11.results ?? []), 100);
    } catch (e: any) {
      setError(e.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const drawBoxes = (dets: YoloDetection[]) => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dets.forEach(det => {
      const { x1, y1, x2, y2 } = det.box;
      const ok = det.class_name === "car";
      ctx.strokeStyle = ok ? "#16a34a" : "#e11d48"; ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = ok ? "#16a34a" : "#e11d48";
      const label = `${CLASS_KO[det.class_name] ?? det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.fillRect(x1, y1 - 22, ctx.measureText(label).width + 10, 22);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(label, x1 + 5, y1 - 5);
    });
  };

  /** 영상 프레임 위에 bbox 그리기 */
  const drawVideoBoxes = (dets: YoloDetection[]) => {
    const canvas = videoCanvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    // canvas를 컨테이너 CSS 크기로 설정
    const dispW = canvas.offsetWidth;
    const dispH = canvas.offsetHeight;
    canvas.width  = dispW;
    canvas.height = dispH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, dispW, dispH);

    // object-fit: contain → letterbox 오프셋 계산
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = dispW / dispH;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (videoAspect > canvasAspect) {
      renderW = dispW;
      renderH = dispW / videoAspect;
      offsetX = 0;
      offsetY = (dispH - renderH) / 2;
    } else {
      renderH = dispH;
      renderW = dispH * videoAspect;
      offsetX = (dispW - renderW) / 2;
      offsetY = 0;
    }

    const scaleX = renderW / video.videoWidth;
    const scaleY = renderH / video.videoHeight;

    dets.forEach(det => {
      const { x1, y1, x2, y2 } = det.box;
      const rx = x1 * scaleX + offsetX;
      const ry = y1 * scaleY + offsetY;
      const rw = (x2 - x1) * scaleX;
      const rh = (y2 - y1) * scaleY;

      const ok = det.class_name === "car";
      ctx.strokeStyle = ok ? "#16a34a" : "#e11d48";
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, rw, rh);

      const label = `${CLASS_KO[det.class_name] ?? det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 14px sans-serif";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = ok ? "#16a34a" : "#e11d48";
      ctx.fillRect(rx, Math.max(ry - 24, 0), tw + 10, 24);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, rx + 5, Math.max(ry - 6, 16));
    });
  };

  /** 비디오 재생 중 현재 시간에 맞는 프레임 박스 표시 */
  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !videoResult?.frames?.length) return;
    const cur = video.currentTime;
    // 현재 재생 시간과 가장 가까운 프레임 탐색
    const frame = videoResult.frames.reduce((best: any, f: any) =>
      Math.abs(f.timestamp_sec - cur) < Math.abs(best.timestamp_sec - cur) ? f : best,
      videoResult.frames[0]
    );
    if (frame && Math.abs(frame.timestamp_sec - cur) < 1.5) {
      drawVideoBoxes(frame.yolo?.results ?? []);
    } else {
      const canvas = videoCanvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setMediaKind("image");
    setKerasResult(null); setKerasUnavailable(false);
    setYolov8Result(null); setYolov11Result(null); setEnsembleResult(null); setVideoResult(null); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    videoCanvasRef.current?.getContext("2d")?.clearRect(0, 0, videoCanvasRef.current.width, videoCanvasRef.current.height);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI 모델 테스트</h1>
        <p className={styles.desc}>이미지 또는 영상을 업로드하여 Keras, YOLOv8, YOLOv11, 앙상블 분석 결과를 비교합니다.</p>
      </div>

      <div className={styles.content}>
        {/* 업로드 영역 */}
        <div className={styles.uploadSection}>
          <div className={styles.dropZone} onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && (f.type.startsWith("image/") || f.type.startsWith("video/"))) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}>
            {preview ? (
              <div className={styles.previewWrapper}>
                {mediaKind === "video" ? (
                  <div className={styles.videoContainer} style={{ position: "relative" }}>
                    <video
                      ref={videoRef}
                      src={preview}
                      className={styles.videoPreview}
                      controls
                      onTimeUpdate={handleVideoTimeUpdate}
                      onLoadedMetadata={() => {
                        const c = videoCanvasRef.current, v = videoRef.current;
                        if (c && v) { c.width = v.videoWidth; c.height = v.videoHeight; }
                      }}
                    />
                    <canvas
                      ref={videoCanvasRef}
                      style={{
                        position: "absolute", top: 0, left: 0,
                        width: "100%", height: "100%",
                        pointerEvents: "none",
                      }}
                    />
                    <span className={styles.modeBadge}><Film size={13} /> 영상 분석 모드</span>
                  </div>
                ) : (
                  <div className={styles.imgContainer}>
                    <img ref={imgRef} src={preview} alt="preview" className={styles.previewImg}
                      onLoad={() => yolov11Result && drawBoxes(yolov11Result.results ?? [])} />
                    <canvas ref={canvasRef} className={styles.overlayCanvas} />
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.dropPlaceholder}>
                <ImageIcon size={48} strokeWidth={1.2} />
                <p>이미지 또는 영상을 드래그하거나 클릭하여 업로드</p>
                <span>JPG, PNG, WEBP / MP4, WEBM, AVI 지원</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className={styles.btnRow}>
            {file && <button className={styles.resetBtn} onClick={reset}><RefreshCw size={14} /> 초기화</button>}
            <button className={styles.analyzeBtn} disabled={!file || loading} onClick={runAnalysis}>
              {loading ? <><Loader2 size={16} className={styles.spin} /> 분석 중...</> : <><Upload size={16} /> {mediaKind === "video" ? "영상 분석 시작" : "4개 모델 분석 시작"}</>}
            </button>
          </div>
          {error && <div className={styles.errorBox}><AlertTriangle size={15} /> {error}</div>}
        </div>

        {/* 오른쪽 열: 영상 모드 → VideoResults / 이미지 모드 → 4개 결과 카드 */}
        {mediaKind === "video"
          ? <VideoResults result={videoResult} />
          : <div className={styles.resultsGrid}>
          {/* 1. Keras — 전체 너비 */}
          <div className={`${styles.resultCard} ${styles.kerasCard} ${kerasResult ? (kerasResult.is_prohibited ? styles.danger : styles.safe) : ""}`}>
            <div className={styles.cardHeader}>
              <span className={styles.modelTag} style={{ background: "#e11d48" }}>Keras</span>
              <span className={styles.modelSub}>MobileNetV2 · FP16 TFLite</span>
            </div>
            {kerasUnavailable ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"20px 0", color:"#b45309" }}>
                <span style={{ fontSize:28 }}>🔄</span>
                <strong style={{ fontSize:13 }}>재학습 진행 중</strong>
                <span style={{ fontSize:12, color:"#888", textAlign:"center" }}>학습 완료 후 업로드 시 자동 활성화</span>
              </div>
            ) : !kerasResult ? <div className={styles.placeholder}>분석 전</div> : (
              <div className={styles.kerasInner}>
                <div className={styles.verdict} style={{ fontSize: 20, marginBottom: 0 }}>
                  {kerasResult.is_prohibited
                    ? <><AlertTriangle size={22} className={styles.dangerIcon} /><span className={styles.dangerText}>진입금지 감지</span></>
                    : <><CheckCircle size={22} className={styles.safeIcon} /><span className={styles.safeText}>정상 차량</span></>}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.metaList}>
                    <MetaRow label="탐지 클래스" value={CLASS_KO[kerasResult.vehicle_class] ?? kerasResult.vehicle_class} />
                    <MetaRow label="클래스 신뢰도" value={`${(kerasResult.confidence * 100).toFixed(1)}%`} />
                    <MetaRow label="금지 판별 확률" value={`${(kerasResult.prohibited_prob * 100).toFixed(1)}%`} />
                  </div>
                  <ConfBar value={kerasResult.prohibited_prob} danger={kerasResult.is_prohibited} />
                </div>
              </div>
            )}
          </div>

          {/* 2. YOLOv8 */}
          <div className={styles.resultCard}>
            <div className={styles.cardHeader}>
              <span className={styles.modelTag} style={{ background: "#3b82f6" }}>YOLOv8</span>
              <span className={styles.modelSub}>v1 · 구 버전</span>
            </div>
            {!yolov8Result ? <div className={styles.placeholder}>분석 전</div> : (
              <>
                <div className={styles.yoloCount}>탐지 <strong>{yolov8Result.count ?? yolov8Result.results?.length ?? 0}개</strong></div>
                <DetList items={yolov8Result.results ?? []} />
              </>
            )}
          </div>

          {/* 3. YOLOv11 */}
          <div className={styles.resultCard}>
            <div className={styles.cardHeader}>
              <span className={styles.modelTag} style={{ background: "#a855f7" }}>YOLOv11</span>
              <span className={styles.modelSub}>v3 · 바운딩박스 표시</span>
            </div>
            {!yolov11Result ? <div className={styles.placeholder}>분석 전</div> : (
              <>
                <div className={styles.yoloCount}>탐지 <strong>{yolov11Result.count ?? yolov11Result.results?.length ?? 0}개</strong></div>
                <DetList items={yolov11Result.results ?? []} />
              </>
            )}
          </div>

          {/* 4. 앙상블 (Soft Voting 파이프라인 시각화) */}
          <div className={`${styles.resultCard} ${styles.ensembleCard}`}>
            <div className={styles.cardHeader}>
              <span className={styles.modelTag} style={{ background: "#0f172a" }}>앙상블</span>
              <span className={styles.modelSub}>3모델 Soft Voting 파이프라인</span>
            </div>

            {!ensembleResult ? (
              /* 분석 전 — 파이프라인 구조 미리 보여주기 */
              <div className={styles.pipelineIdle}>
                <div className={styles.pipelineStep} style={{ borderColor: "#e11d48" }}>
                  <div className={styles.pipelineStepTitle} style={{ color: "#e11d48" }}>① Keras 게이트</div>
                  <div className={styles.pipelineStepDesc}>전체 프레임 분류<br/>금지 차량 여부 빠르게 판별</div>
                </div>
                <div className={styles.pipelineArrow}>↓ 금지 판별 시에만</div>
                <div className={styles.pipelineRow}>
                  <div className={styles.pipelineStep} style={{ borderColor: "#3b82f6" }}>
                    <div className={styles.pipelineStepTitle} style={{ color: "#3b82f6" }}>② YOLOv8</div>
                    <div className={styles.pipelineStepDesc}>객체 탐지<br/>가중치 35%</div>
                  </div>
                  <div className={styles.pipelineArrow} style={{ transform: "none" }}>+</div>
                  <div className={styles.pipelineStep} style={{ borderColor: "#a855f7" }}>
                    <div className={styles.pipelineStepTitle} style={{ color: "#a855f7" }}>② YOLOv11</div>
                    <div className={styles.pipelineStepDesc}>객체 탐지<br/>가중치 65%</div>
                  </div>
                </div>
                <div className={styles.pipelineArrow}>↓ IoU ≥ 0.45 → 가중 평균</div>
                <div className={styles.pipelineStep} style={{ borderColor: "#16a34a" }}>
                  <div className={styles.pipelineStepTitle} style={{ color: "#16a34a" }}>③ Soft Voting 병합</div>
                  <div className={styles.pipelineStepDesc}>두 YOLO 결과 통합<br/>최종 감지 결과 반환</div>
                </div>
              </div>
            ) : (
              /* 분석 후 — 실제 결과와 함께 파이프라인 표시 */
              <div className={styles.pipelineResult}>

                {/* STEP 1: Keras 게이트 */}
                <div className={`${styles.pipelineResultStep} ${ensembleResult.keras?.is_prohibited ? styles.pipelineActive : styles.pipelineSafe}`}>
                  <div className={styles.pipelineResultHeader}>
                    <span className={styles.pipelineNum}>①</span>
                    <span className={styles.pipelineLabel}>Keras 게이트</span>
                    <span className={`${styles.pipelineStatus} ${ensembleResult.keras?.is_prohibited ? styles.pipelineStatusDanger : styles.pipelineStatusSafe}`}>
                      {ensembleResult.keras?.is_prohibited ? "⚠ 금지 감지" : "✅ 안전"}
                    </span>
                  </div>
                  {ensembleResult.keras && (
                    <div className={styles.pipelineResultBody}>
                      <div className={styles.pipelineConfRow}>
                        <span>판별 클래스</span>
                        <strong>{CLASS_KO[ensembleResult.keras.vehicle_class] ?? ensembleResult.keras.vehicle_class}</strong>
                      </div>
                      <div className={styles.pipelineConfRow}>
                        <span>금지 판별 확률</span>
                        <strong>{(ensembleResult.keras.prohibited_prob * 100).toFixed(1)}%</strong>
                      </div>
                      <div className={styles.pipelineBar}>
                        <div style={{ width: `${ensembleResult.keras.prohibited_prob * 100}%`, background: ensembleResult.keras.is_prohibited ? "#e11d48" : "#16a34a" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 분기 화살표 */}
                <div className={styles.pipelineBranch}>
                  {ensembleResult.yolo_skipped ? (
                    <span className={styles.pipelineBranchStop}>✅ 안전 판별 → YOLO 생략 (연산 절감)</span>
                  ) : (
                    <span className={styles.pipelineBranchGo}>⚠ 금지 감지 → YOLOv8 + YOLOv11 동시 실행</span>
                  )}
                </div>

                {/* STEP 2: 두 YOLO 병렬 (금지 감지 시에만) */}
                {!ensembleResult.yolo_skipped && (
                  <div className={styles.pipelineParallel}>
                    {/* YOLOv8 */}
                    <div className={`${styles.pipelineResultStep} ${styles.pipelineV8}`}>
                      <div className={styles.pipelineResultHeader}>
                        <span className={styles.pipelineNum} style={{ color: "#3b82f6" }}>②</span>
                        <span className={styles.pipelineLabel}>YOLOv8</span>
                        <span className={styles.pipelineWeight}>가중치 35%</span>
                      </div>
                      <div className={styles.pipelineResultBody}>
                        <div className={styles.pipelineConfRow}>
                          <span>탐지 객체</span>
                          <strong>{ensembleResult.detail?.yolov8.count ?? 0}개</strong>
                        </div>
                        {(ensembleResult.detail?.yolov8.results ?? []).slice(0, 3).map((d, i) => (
                          <div key={i} className={styles.pipelineDet}>
                            <span className={styles.pipelineDetCls}>{CLASS_KO[d.class_name] ?? d.class_name}</span>
                            <span className={styles.pipelineDetConf}>{(d.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.pipelineVote}>
                      <div className={styles.pipelineVoteIcon}>⊕</div>
                      <div className={styles.pipelineVoteLabel}>IoU 기반<br/>Soft<br/>Voting</div>
                    </div>

                    {/* YOLOv11 */}
                    <div className={`${styles.pipelineResultStep} ${styles.pipelineV11}`}>
                      <div className={styles.pipelineResultHeader}>
                        <span className={styles.pipelineNum} style={{ color: "#a855f7" }}>②</span>
                        <span className={styles.pipelineLabel}>YOLOv11</span>
                        <span className={styles.pipelineWeight}>가중치 65%</span>
                      </div>
                      <div className={styles.pipelineResultBody}>
                        <div className={styles.pipelineConfRow}>
                          <span>탐지 객체</span>
                          <strong>{ensembleResult.detail?.yolov11.count ?? 0}개</strong>
                        </div>
                        {(ensembleResult.detail?.yolov11.results ?? []).slice(0, 3).map((d, i) => (
                          <div key={i} className={styles.pipelineDet}>
                            <span className={styles.pipelineDetCls}>{CLASS_KO[d.class_name] ?? d.class_name}</span>
                            <span className={styles.pipelineDetConf}>{(d.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: 최종 병합 결과 */}
                {!ensembleResult.yolo_skipped && (
                  <>
                    <div className={styles.pipelineBranch}>
                      <span className={styles.pipelineBranchGo}>↓ 동일 객체(IoU ≥ 0.45) 가중 평균 신뢰도 산출</span>
                    </div>
                    <div className={`${styles.pipelineResultStep} ${styles.pipelineFinal}`}>
                      <div className={styles.pipelineResultHeader}>
                        <span className={styles.pipelineNum} style={{ color: "#16a34a" }}>③</span>
                        <span className={styles.pipelineLabel}>Soft Voting 최종 결과</span>
                        <span className={styles.pipelineStatus} style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac" }}>
                          {ensembleResult.yolo.count}개 감지
                        </span>
                      </div>
                      {ensembleResult.yolo.results.length === 0 ? (
                        <div className={styles.pipelineResultBody} style={{ color: "var(--text-muted)", fontSize: 13 }}>
                          임계값(신뢰도 60%) 이상 탐지 없음
                        </div>
                      ) : (
                        <div className={styles.pipelineResultBody}>
                          {ensembleResult.yolo.results.map((det, i) => {
                            const src = (det as any).source ?? "";
                            const srcMap: Record<string, { label: string; color: string }> = {
                              soft_voting:  { label: "두 모델 병합", color: "#0f172a" },
                              yolov8_only:  { label: "YOLOv8 단독",  color: "#3b82f6" },
                              yolov11_only: { label: "YOLOv11 단독", color: "#a855f7" },
                            };
                            const s = srcMap[src] ?? { label: src, color: "#64748b" };
                            const v8c = (det as any).v8_conf;
                            const v11c = (det as any).v11_conf;
                            return (
                              <div key={i} className={styles.pipelineFinalDet}>
                                <div className={styles.pipelineFinalTop}>
                                  <span className={styles.pipelineFinalCls}>
                                    {CLASS_KO[det.class_name] ?? det.class_name}
                                  </span>
                                  <span className={styles.pipelineFinalConf}>
                                    최종 신뢰도 <strong>{(det.confidence * 100).toFixed(1)}%</strong>
                                  </span>
                                  <span style={{ fontSize: 11, color: s.color, fontWeight: 700, padding: "1px 7px", border: `1.5px solid ${s.color}`, borderRadius: 999 }}>
                                    {s.label}
                                  </span>
                                </div>
                                {src === "soft_voting" && v8c != null && v11c != null && (
                                  <div className={styles.pipelineFinalCalc}>
                                    <span style={{ color: "#3b82f6" }}>YOLOv8 {(v8c * 100).toFixed(0)}%</span>
                                    <span> × 0.35  +  </span>
                                    <span style={{ color: "#a855f7" }}>YOLOv11 {(v11c * 100).toFixed(0)}%</span>
                                    <span> × 0.65  =  </span>
                                    <strong style={{ color: "#0f172a" }}>{(det.confidence * 100).toFixed(1)}%</strong>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        }

      </div>
    </div>
  );
}
