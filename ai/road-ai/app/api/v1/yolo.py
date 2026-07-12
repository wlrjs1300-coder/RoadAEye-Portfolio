from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi import Query

from app.modules.yolo.schemas import YoloPredictResponse, ItsStreamsResponse
from app.modules.yolo.service import predict_image, predict_image_v3, predict_ensemble, analyze_video, predict_b64, stream_rtsp_detections, fetch_its_streams
from app.core.config import settings


router = APIRouter(
    prefix="/yolo",
    tags=["YOLO"]
)


@router.post("/predict", summary="YOLOv8 예측 (v1)")
async def predict(file: UploadFile = File(...)):
    return await predict_image(file)


@router.post("/predict/v3", summary="YOLOv11 예측 (v3)")
async def predict_v3(file: UploadFile = File(...)):
    return await predict_image_v3(file)


@router.post("/predict/ensemble", summary="앙상블 예측 (Keras → YOLOv11)")
async def predict_ensemble_route(file: UploadFile = File(...)):
    return await predict_ensemble(file)


@router.post("/analyze-video", summary="영상 앙상블 분석 (Keras → YOLOv8+YOLOv11)")
async def analyze_video_route(
    file: UploadFile = File(...),
    sample_interval_sec: float = Query(1.0, ge=0.2, le=10.0),
    max_frames: int = Query(60, ge=1, le=180),
):
    try:
        return await analyze_video(file, sample_interval_sec=sample_interval_sec, max_frames=max_frames)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/streams",
    response_model=ItsStreamsResponse
)
async def get_its_streams(
    road_route_code: str = Query(None, description="고속도로 노선 코드 (예: 0010 경부선)")
):
    """한국도로공사 ITS CCTV 스트림 목록 조회"""
    if not settings.its_api_key:
        raise HTTPException(status_code=503, detail="ITS_API_KEY가 설정되지 않았습니다")
    streams = await fetch_its_streams(settings.its_api_key, road_route_code)
    return {"success": True, "count": len(streams), "streams": streams}


@router.websocket("/ws")
async def websocket_predict(websocket: WebSocket):
    """Base64 이미지 프레임 실시간 예측 (클라이언트 → 서버 방향 스트리밍)"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            b64 = data.get("frame", "")
            if not b64:
                continue
            result = await predict_b64(b64)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"error": str(e)})


@router.websocket("/ws/stream")
async def websocket_rtsp_stream(websocket: WebSocket):
    """RTSP/HLS 스트림 실시간 분석 (서버가 직접 스트림을 캡처해 결과 전송)"""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        url = data.get("url")
        if not url:
            await websocket.send_json({"error": "url 필드가 필요합니다"})
            return
        async for result in stream_rtsp_detections(url):
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass
    except ConnectionError as e:
        await websocket.send_json({"error": str(e)})
    except Exception as e:
        await websocket.send_json({"error": str(e)})
