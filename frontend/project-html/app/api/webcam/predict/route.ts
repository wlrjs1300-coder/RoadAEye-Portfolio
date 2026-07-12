export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Detection = {
  class_name?: string;
  confidence?: number;
  box?: { x1: number; y1: number; x2: number; y2: number };
  source?: string;
};

type ForbiddenClass = {
  class_no: number;
  class_name: string;
};

// DB forbidden_classes 목록을 캐시 (1분)
let cachedForbiddenMap: Record<string, number> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

async function loadForbiddenMap(): Promise<Record<string, number>> {
  if (cachedForbiddenMap && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedForbiddenMap;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/cctv/classes?active_only=true`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error("class api failed");
    const data = await res.json();
    const classes = (data?.data?.classes || []) as ForbiddenClass[];
    const map = classes.reduce<Record<string, number>>((acc, item) => {
      if (item.class_name && item.class_no) acc[item.class_name] = item.class_no;
      return acc;
    }, {});
    if (Object.keys(map).length > 0) {
      cachedForbiddenMap = map;
      cacheTime = Date.now();
      return map;
    }
  } catch {}
  // DB 조회 실패 시 실제 모델 클래스명 기반 폴백
  return {
    "Electric Scooter": 1,
    "motorcycle":       2,
    "Excavator":        3,
    "Cultivator":       4,
    "Tractor":          5,
    "Stacker":          6,
    "Wheelchair":       7,
    "person":           8,
    "Rear Car":         9,
  };
}

export async function POST(request: Request) {
  try {
    const aiServerUrl = process.env.AI_SERVER_URL || "http://localhost:8001";
    const aiApiKey    = process.env.AI_API_KEY;

    if (!aiApiKey) {
      return Response.json(
        { success: false, detail: "AI_API_KEY가 프론트 서버 환경변수에 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { success: false, detail: "file 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const upload = new FormData();
    upload.append("file", file, file.name || "webcam.jpg");

    // Keras 게이트 모델 품질 문제로 비활성화 → YOLOv11(v3) 직접 사용
    const aiRes = await fetch(`${aiServerUrl}/api/v1/yolo/predict/v3`, {
      method: "POST",
      headers: { "X-Api-Key": aiApiKey },
      body: upload,
      cache: "no-store",
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return Response.json(
        { success: false, detail: detail || "AI 서버 분석 요청 실패" },
        { status: 502 }
      );
    }

    const ai = await aiRes.json();

    // YOLOv11 응답: ai.results (직접 탐지 결과)
    const detections = (Array.isArray(ai?.results) ? ai.results : []) as Detection[];
    const kerasResult = null;

    const forbiddenMap = await loadForbiddenMap();

    // 클래스명 직접 매칭 (모델 출력명 = DB 저장명)
    const forbiddenDetections = detections.flatMap(det => {
      const className = det.class_name;
      if (!className) return [];
      const classNo = forbiddenMap[className];
      return classNo ? [{ ...det, class_no: classNo }] : [];
    });

    return Response.json({
      success: true,
      camera_id:   "webcam-demo",
      camera_name: "내 웹캠 (AI 시연)",
      timestamp:   new Date().toISOString(),
      total_detections:     detections.length,
      all_detections:       detections,        // bbox 오버레이용 전체 탐지 결과
      forbidden_detections: forbiddenDetections,
      yolo_skipped:         ai?.yolo_skipped ?? false,
      keras:                kerasResult,
    });
  } catch (error) {
    console.error("[webcam/predict] 오류:", error);
    return Response.json(
      { success: false, detail: "웹캠 AI 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
