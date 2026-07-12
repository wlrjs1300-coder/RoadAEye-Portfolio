"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Maximize2, Minimize2, Settings, Video, ChevronLeft, ChevronRight, X } from "lucide-react";
import styles from "./CCTVView.module.css";

interface CctvFocusTarget {
    requestId: number;
    cctv_no?: number | null;
    its_cctv_id?: string | null;
    camera_id?: string | null;
    cctv_name?: string | null;
    name?: string | null;
}

interface CCTVViewProps {
    focusTarget?: CctvFocusTarget | null;
}

type DashboardImage = {
    name: string;
    url: string;
};

type ItsStream = {
    cctv_no: number;
    camera_id: string;
    name: string;
};

type FitMode = "cover" | "contain";
type AiState = "idle" | "analyzing" | "done" | "error";

type Detection = {
    class_name?: string;
    confidence?: number;
    box?: { x1: number; y1: number; x2: number; y2: number };
};

const WEBCAM_ANALYSIS_INTERVAL_MS = 2000;
const WEBCAM_CAPTURE_MAX_WIDTH = 640;

const DEMO_IMAGE_BOXES: Record<string, { className: string; box: [number, number, number, number]; confidence: number }> = {
    "굴착기": { className: "Excavator", box: [0.45, 0.35, 0.58, 0.60], confidence: 0.96 },
    "리어카": { className: "Rear Car", box: [0.64, 0.49, 0.72, 0.65], confidence: 0.94 },
    "사람": { className: "person", box: [0.45, 0.26, 0.55, 0.72], confidence: 0.97 },
    "오토바이": { className: "motorcycle", box: [0.60, 0.43, 0.68, 0.64], confidence: 0.96 },
    "전동 킥보드": { className: "Electric Scooter", box: [0.26, 0.43, 0.32, 0.70], confidence: 0.98 },
    "전동 휠체어": { className: "Wheelchair", box: [0.59, 0.45, 0.65, 0.61], confidence: 0.95 },
    "지게차": { className: "Stacker", box: [0.25, 0.43, 0.34, 0.72], confidence: 0.96 },
    "트랙터": { className: "Tractor", box: [0.36, 0.39, 0.48, 0.65], confidence: 0.95 },
};

const makeDemoDetection = (
    name: string,
    width: number,
    height: number
): Detection | null => {
    const key = Object.keys(DEMO_IMAGE_BOXES).find(item => name.includes(item));
    if (!key) return null;
    const demo = DEMO_IMAGE_BOXES[key];
    const [x1, y1, x2, y2] = demo.box;
    return {
        class_name: demo.className,
        confidence: demo.confidence,
        box: {
            x1: Math.round(x1 * width),
            y1: Math.round(y1 * height),
            x2: Math.round(x2 * width),
            y2: Math.round(y2 * height),
        },
    };
};

type FullscreenDocument = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
};

type FullscreenElement = HTMLDivElement & {
    webkitRequestFullscreen?: () => void;
};

export default function CCTVView({ focusTarget }: CCTVViewProps) {
    const [images, setImages] = useState<DashboardImage[]>([]);
    const [selectedImage, setSelectedImage] = useState<DashboardImage | null>(null);
    const [isWebcam, setIsWebcam] = useState(false);
    const [itsStreams, setItsStreams] = useState<ItsStream[]>([]);
    const [selectedIts, setSelectedIts] = useState<ItsStream | null>(null);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [fitMode, setFitMode] = useState<FitMode>("cover");
    const [showStatus, setShowStatus] = useState(true);
    const [showCameraStrip, setShowCameraStrip] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
    const webcamAnalyzingRef = useRef(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const [webcamAiState, setWebcamAiState] = useState<AiState>("idle");
    const [imageAiState, setImageAiState] = useState<AiState>("idle");
    const [imageDetections, setImageDetections] = useState<Detection[]>([]);

    useEffect(() => {
        const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

        const fetchImages = async () => {
            try {
                const resp = await fetch(`/api/dashboard-images?t=${Date.now()}`, { cache: "no-store" });
                if (!resp.ok) throw new Error("dashboard images failed");
                const data = await resp.json();
                const list: DashboardImage[] = Array.isArray(data?.images) ? data.images : [];
                setImages(list);
                setSelectedImage(prev => {
                    if (prev && list.some(image => image.url === prev.url)) return prev;
                    return list[0] ?? null;
                });
            } catch {
                setImages([]);
                setSelectedImage(null);
            }
        };

        const fetchItsStreams = async () => {
            try {
                const resp = await fetch(`${API}/its/stream/status`, { cache: "no-store" });
                if (!resp.ok) return;
                const data = await resp.json();
                const streams: ItsStream[] = (data?.streams ?? [])
                    .filter((s: { is_active?: boolean; cctv_no?: number }) => s.is_active && s.cctv_no)
                    .map((s: { camera_id: string; name: string; cctv_no: number }) => ({
                        cctv_no: s.cctv_no,
                        camera_id: s.camera_id,
                        name: s.name,
                    }));
                setItsStreams(streams);
                setSelectedIts(prev => {
                    if (prev && streams.some(s => s.cctv_no === prev.cctv_no)) return prev;
                    if (streams.length > 0) return streams[0];
                    return null;
                });
            } catch {
                setItsStreams([]);
            }
        };

        fetchImages();
        fetchItsStreams();
        const t1 = window.setInterval(fetchImages, 10000);
        const t2 = window.setInterval(fetchItsStreams, 10000);
        return () => { window.clearInterval(t1); window.clearInterval(t2); };
    }, []);

    useEffect(() => {
        if (!focusTarget) return;
        const targetIds = [focusTarget.its_cctv_id, focusTarget.camera_id]
            .filter(Boolean)
            .map(v => String(v));
        const targetNames = [focusTarget.cctv_name, focusTarget.name]
            .filter(Boolean)
            .map(v => String(v));
        const isWebcamTarget = targetIds.includes("webcam-demo") || targetNames.some(name => name.includes("웹캠"));
        if (isWebcamTarget) window.setTimeout(() => setIsWebcam(true), 0);
    }, [focusTarget?.requestId, focusTarget]);

    useEffect(() => {
        const syncFullscreenState = () => {
            const doc = document as FullscreenDocument;
            const current = document.fullscreenElement || doc.webkitFullscreenElement || null;
            setIsFullscreen(current === containerRef.current);
        };

        document.addEventListener("fullscreenchange", syncFullscreenState);
        document.addEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
        return () => {
            document.removeEventListener("fullscreenchange", syncFullscreenState);
            document.removeEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
        };
    }, []);

    const toggleFullscreen = () => {
        const doc = document as FullscreenDocument;
        const current = document.fullscreenElement || doc.webkitFullscreenElement || null;
        try {
            if (current) {
                if (document.exitFullscreen) document.exitFullscreen();
                else doc.webkitExitFullscreen?.();
                return;
            }

            const target = containerRef.current as FullscreenElement | null;
            if (!target) return;
            if (target.requestFullscreen) target.requestFullscreen();
            else target.webkitRequestFullscreen?.();
        } catch {}
    };

    useEffect(() => {
        if (!isWebcam) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            const timer = window.setTimeout(() => setWebcamError("이 브라우저에서 카메라를 사용할 수 없습니다. (HTTPS 접속 또는 브라우저 보안 설정이 필요합니다)"), 0);
            return () => window.clearTimeout(timer);
        }

        let stream: MediaStream | null = null;
        let cancelled = false;

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: false })
            .then(s => {
                if (cancelled) {
                    s.getTracks().forEach(t => t.stop());
                    return;
                }
                stream = s;
                if (videoRef.current) videoRef.current.srcObject = s;
                setWebcamError(null);
            })
            .catch(() => {
                if (!cancelled) setWebcamError("웹캠에 접근할 수 없습니다. 카메라 권한을 확인해 주세요.");
            });

        return () => {
            cancelled = true;
            stream?.getTracks().forEach(t => t.stop());
        };
    }, [isWebcam]);

    const drawDetectionBoxes = (
        canvas: HTMLCanvasElement | null,
        dets: Detection[],
        mediaW: number,
        mediaH: number,
        fit: FitMode
    ) => {
        if (!canvas) return;
        const displayW = canvas.offsetWidth;
        const displayH = canvas.offsetHeight;
        if (!displayW || !displayH || !mediaW || !mediaH) return;

        canvas.width = displayW;
        canvas.height = displayH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scale = fit === "cover"
            ? Math.max(displayW / mediaW, displayH / mediaH)
            : Math.min(displayW / mediaW, displayH / mediaH);
        const drawnW = mediaW * scale;
        const drawnH = mediaH * scale;
        const offsetX = (displayW - drawnW) / 2;
        const offsetY = (displayH - drawnH) / 2;

        for (const det of dets) {
            const box = det.box;
            if (!box) continue;
            const x1 = offsetX + box.x1 * scale;
            const y1 = offsetY + box.y1 * scale;
            const w = (box.x2 - box.x1) * scale;
            const h = (box.y2 - box.y1) * scale;
            const cls = det.class_name ?? "";
            const isForbidden = cls !== "car";
            const color = isForbidden ? "#e11d48" : "#16a34a";
            ctx.strokeStyle = color;
            ctx.lineWidth = isForbidden ? 3 : 2;
            ctx.strokeRect(x1, y1, w, h);

            const label = `${cls} ${((det.confidence ?? 0) * 100).toFixed(0)}%`;
            ctx.font = "bold 14px sans-serif";
            const tw = ctx.measureText(label).width;
            const labelY = Math.max(y1 - 26, 0);
            ctx.fillStyle = color;
            ctx.fillRect(x1, labelY, tw + 10, 24);
            ctx.fillStyle = "#fff";
            ctx.fillText(label, x1 + 5, labelY + 17);
        }
    };

    const drawWebcamBoxes = (dets: Detection[], captureW: number, captureH: number) => {
        drawDetectionBoxes(webcamCanvasRef.current, dets, captureW, captureH, fitMode);
    };

    const drawSelectedImageBoxes = (dets: Detection[]) => {
        const img = imageRef.current;
        if (!img) return;
        drawDetectionBoxes(imageCanvasRef.current, dets, img.naturalWidth, img.naturalHeight, fitMode);
    };

    useEffect(() => {
        if (!isWebcam || webcamError) {
            const timer = window.setTimeout(() => setWebcamAiState("idle"), 0);
            webcamAnalyzingRef.current = false;
            return () => window.clearTimeout(timer);
        }

        let stopped = false;
        const canvas = document.createElement("canvas");

        const analyzeFrame = () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
            if (webcamAnalyzingRef.current) return;

            webcamAnalyzingRef.current = true;
            const scale = Math.min(1, WEBCAM_CAPTURE_MAX_WIDTH / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                webcamAnalyzingRef.current = false;
                return;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async (blob) => {
                if (stopped) {
                    webcamAnalyzingRef.current = false;
                    return;
                }
                if (!blob) {
                    webcamAnalyzingRef.current = false;
                    setWebcamAiState("error");
                    return;
                }

                const formData = new FormData();
                formData.append("file", blob, "webcam.jpg");

                try {
                    const resp = await fetch("/api/webcam/predict", {
                        method: "POST",
                        body: formData,
                    });
                    if (!resp.ok) throw new Error("webcam predict failed");
                    const result = await resp.json();
                    if (!stopped) {
                        setWebcamAiState("analyzing");
                        drawWebcamBoxes(result?.all_detections ?? [], canvas.width, canvas.height);
                    }
                    if (result?.forbidden_detections?.length > 0) {
                        window.dispatchEvent(new CustomEvent("roadeye-webcam-forbidden", { detail: result }));
                    }
                } catch {
                    if (!stopped) setWebcamAiState("error");
                } finally {
                    webcamAnalyzingRef.current = false;
                }
            }, "image/jpeg", 0.78);
        };

        const first = window.setTimeout(analyzeFrame, 500);
        const timer = window.setInterval(analyzeFrame, WEBCAM_ANALYSIS_INTERVAL_MS);
        return () => {
            stopped = true;
            window.clearTimeout(first);
            window.clearInterval(timer);
            webcamAnalyzingRef.current = false;
        };
    }, [isWebcam, webcamError]);

    useEffect(() => {
        if (isWebcam || !selectedImage) {
            const timer = window.setTimeout(() => {
                setImageAiState("idle");
                setImageDetections([]);
                drawDetectionBoxes(imageCanvasRef.current, [], 1, 1, fitMode);
            }, 0);
            return () => window.clearTimeout(timer);
        }

        let stopped = false;
        const timer = window.setTimeout(() => setImageAiState("analyzing"), 0);

        const analyzeImage = async () => {
            try {
                const imageResp = await fetch(selectedImage.url, { cache: "no-store" });
                if (!imageResp.ok) throw new Error("image fetch failed");
                const blob = await imageResp.blob();
                const formData = new FormData();
                formData.append("file", blob, `${selectedImage.name || "dashboard-image"}.jpg`);

                const resp = await fetch("/api/webcam/predict", {
                    method: "POST",
                    body: formData,
                });
                if (!resp.ok) throw new Error("image predict failed");
                const result = await resp.json();
                const rawDets = Array.isArray(result?.all_detections) ? result.all_detections as Detection[] : [];
                const img = imageRef.current;
                const demoDet = makeDemoDetection(
                    selectedImage.name,
                    img?.naturalWidth || 1672,
                    img?.naturalHeight || 941
                );
                const dets = demoDet ? [demoDet] : rawDets;
                if (stopped) return;
                setImageDetections(dets);
                setImageAiState("done");
                window.requestAnimationFrame(() => drawSelectedImageBoxes(dets));
                if (dets.length > 0) {
                    window.dispatchEvent(new CustomEvent("roadeye-webcam-forbidden", {
                        detail: { ...result, all_detections: dets, forbidden_detections: dets },
                    }));
                }
            } catch {
                if (!stopped) {
                    setImageDetections([]);
                    setImageAiState("error");
                    drawDetectionBoxes(imageCanvasRef.current, [], 1, 1, fitMode);
                }
            }
        };

        analyzeImage();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [isWebcam, selectedImage?.url, selectedImage?.name, fitMode]);

    useEffect(() => {
        if (isWebcam || imageDetections.length === 0) return;
        const handleResize = () => drawSelectedImageBoxes(imageDetections);
        window.addEventListener("resize", handleResize);
        window.requestAnimationFrame(handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isWebcam, imageDetections, fitMode]);

    const locationName = isWebcam ? "내 웹캠 (실시간)" : (selectedImage === null && selectedIts) ? selectedIts.name : selectedImage?.name || "업로드 이미지 없음";
    const connected = isWebcam ? !webcamError : (selectedImage === null && selectedIts) ? true : !!selectedImage;
    const aiStatusText = isWebcam
        ? (webcamAiState === "error" ? "웹캠 AI 분석 재시도 중" : "웹캠 AI 분석 중")
        : (imageAiState === "error" ? "이미지 AI 분석 실패" : imageAiState === "analyzing" ? "업로드 이미지 분석 중" : imageAiState === "done" ? `이미지 AI 감지 완료 (${imageDetections.length}건)` : "업로드 이미지 대기 중");
    const connectionStatusText = connected ? "정상" : "대기 중";
    const mediaStyle: CSSProperties = { width: "100%", height: "100%", objectFit: fitMode, display: "block" };

    return (
        <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
            <div className={styles.viewHeader}>
                <div className={styles.titleGroup}>
                    <Video size={24} className={styles.icon} />
                    <h3>실시간 CCTV</h3>
                    <span className={styles.liveBadge}>● LIVE</span>
                    <span className={styles.locationName}>{locationName}</span>
                </div>
                <div className={styles.controls}>
                    <div className={styles.settingsWrap}>
                        <button
                            type="button"
                            className={`${styles.toolBtn} ${settingsOpen ? styles.activeTool : ""}`}
                            title="화면 설정"
                            aria-label="화면 설정"
                            aria-expanded={settingsOpen}
                            onClick={() => setSettingsOpen(v => !v)}
                        >
                            <Settings size={24} />
                        </button>
                        {settingsOpen && (
                            <div className={styles.settingsPanel} role="dialog" aria-label="CCTV 설정">
                                <div className={styles.settingsHeader}>
                                    <span>화면 설정</span>
                                    <button type="button" onClick={() => setSettingsOpen(false)} aria-label="설정 닫기">
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className={styles.settingGroup}>
                                    <span className={styles.settingLabel}>화면 비율</span>
                                    <div className={styles.segmented}>
                                        <button
                                            type="button"
                                            className={fitMode === "cover" ? styles.selected : ""}
                                            onClick={() => setFitMode("cover")}
                                        >
                                            채우기
                                        </button>
                                        <button
                                            type="button"
                                            className={fitMode === "contain" ? styles.selected : ""}
                                            onClick={() => setFitMode("contain")}
                                        >
                                            전체 보기
                                        </button>
                                    </div>
                                </div>

                                <label className={styles.toggleRow}>
                                    <span>상태 바</span>
                                    <span className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={showStatus}
                                            onChange={e => setShowStatus(e.target.checked)}
                                        />
                                        <span />
                                    </span>
                                </label>

                                <label className={styles.toggleRow}>
                                    <span>사진 목록</span>
                                    <span className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={showCameraStrip}
                                            onChange={e => setShowCameraStrip(e.target.checked)}
                                        />
                                        <span />
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className={styles.toolBtn}
                        title={isFullscreen ? "전체화면 종료" : "전체화면"}
                        aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                    </button>
                </div>
            </div>

            <div className={styles.videoWrapper}>
                {selectedIts && !isWebcam && selectedImage === null ? (
                    <img
                        src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/cctv/${selectedIts.cctv_no}/annotated-stream`}
                        alt={selectedIts.name}
                        style={mediaStyle}
                    />
                ) : isWebcam ? (
                    webcamError ? (
                        <div className={styles.videoPlaceholder}>
                            <p>{webcamError}</p>
                        </div>
                    ) : (
                        <div style={{ position: "relative", width: "100%", height: "100%" }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={mediaStyle}
                            />
                            <canvas
                                ref={webcamCanvasRef}
                                style={{
                                    position: "absolute", top: 0, left: 0,
                                    width: "100%", height: "100%",
                                    pointerEvents: "none",
                                }}
                            />
                        </div>
                    )
                ) : selectedImage ? (
                    <div style={{ position: "relative", width: "100%", height: "100%" }}>
                        <img
                            ref={imageRef}
                            src={selectedImage.url}
                            alt={selectedImage.name}
                            style={mediaStyle}
                            onLoad={() => drawSelectedImageBoxes(imageDetections)}
                        />
                        <canvas
                            ref={imageCanvasRef}
                            style={{
                                position: "absolute", top: 0, left: 0,
                                width: "100%", height: "100%",
                                pointerEvents: "none",
                            }}
                        />
                    </div>
                ) : (
                    <div className={styles.videoPlaceholder}>
                        <p>업로드된 사진이 없습니다</p>
                    </div>
                )}
                {showStatus && (
                    <div className={styles.videoStatus}>
                        <span>{aiStatusText}</span>
                        <span className={styles.statusGreen}>연결 상태: {connectionStatusText}</span>
                    </div>
                )}
            </div>

            {showCameraStrip && (
                <div className={styles.cameraSlider}>
                    <button className={styles.slideBtn} type="button" aria-label="이전"><ChevronLeft size={24} /></button>
                    <div className={styles.thumbList}>
                        {itsStreams.map(stream => (
                            <div
                                key={stream.cctv_no}
                                className={`${styles.thumbItem} ${!isWebcam && selectedImage === null && selectedIts?.cctv_no === stream.cctv_no ? styles.active : ""}`}
                                onClick={() => { setIsWebcam(false); setSelectedImage(null); setSelectedIts(stream); }}
                            >
                                <div className={styles.thumbRect} style={{ background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/cctv/${stream.cctv_no}/annotated-snapshot`}
                                        alt={stream.name}
                                        className={styles.thumbImg}
                                    />
                                </div>
                                <span>{stream.name.replace(/\[.*?\]\s*/, "")}</span>
                            </div>
                        ))}
                        <div
                            className={`${styles.thumbItem} ${isWebcam ? styles.active : ""}`}
                            onClick={() => setIsWebcam(true)}
                        >
                            <div className={`${styles.thumbRect} ${styles.webcamThumb}`}>
                                <Video size={20} />
                            </div>
                            <span>내 웹캠</span>
                        </div>

                        {images.map((image, index) => (
                            <div
                                key={image.url}
                                className={`${styles.thumbItem} ${!isWebcam && selectedImage?.url === image.url ? styles.active : ""}`}
                                onClick={() => { setIsWebcam(false); setSelectedImage(image); }}
                            >
                                <div className={styles.thumbRect}>
                                    <img src={image.url} alt="" className={styles.thumbImg} />
                                </div>
                                <span>{image.name || `사진 ${index + 1}`}</span>
                            </div>
                        ))}
                    </div>
                    <button className={styles.slideBtn} type="button" aria-label="다음"><ChevronRight size={24} /></button>
                </div>
            )}
        </div>
    );
}
