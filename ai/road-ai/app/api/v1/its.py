import asyncio

import httpx
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, StreamingResponse

from app.modules.its.client import fetch_cameras
from app.modules.its.schemas import StartStreamRequest, StopStreamRequest
from app.modules.its.service import manager
from app.core.config import settings

router = APIRouter(prefix="/its", tags=["ITS"])


@router.get("/cameras")
async def get_cameras(
    min_x: float = Query(126.0, description="최소 경도"),
    max_x: float = Query(130.0, description="최대 경도"),
    min_y: float = Query(34.0, description="최소 위도"),
    max_y: float = Query(38.5, description="최대 위도"),
):
    """ITS API에서 고속도로 CCTV 카메라 목록 조회"""
    cameras = await fetch_cameras(min_x, max_x, min_y, max_y)
    return {"success": True, "count": len(cameras), "cameras": [c.model_dump() for c in cameras]}


@router.post("/stream/start")
def start_stream(req: StartStreamRequest):
    """CCTV 스트림 분석 시작 (cctvs 테이블 자동 등록)"""
    started = manager.start_stream(req.camera_id, req.stream_url, req.name)
    if not started:
        raise HTTPException(status_code=409, detail="이미 실행 중인 스트림입니다.")
    return {"success": True, "camera_id": req.camera_id}


@router.post("/stream/stop")
def stop_stream(req: StopStreamRequest):
    """CCTV 스트림 분석 중지"""
    stopped = manager.stop_stream(req.camera_id)
    if not stopped:
        raise HTTPException(status_code=404, detail="해당 카메라 스트림이 없습니다.")
    return {"success": True, "camera_id": req.camera_id}


@router.get("/stream/status")
def stream_status():
    """현재 실행 중인 스트림 목록 조회"""
    return {"streams": [s.model_dump() for s in manager.get_status()]}


@router.get("/stats", summary="Keras 게이트 효율 통계")
def stream_stats():
    """
    카메라별 Keras 게이트 필터링 효율 및 감지 통계를 반환한다.

    - keras_filtered  : Keras가 안전 프레임으로 판별해 YOLO를 건너뛴 프레임 수
    - filter_rate_pct : Keras 필터링 비율 (높을수록 YOLO 연산 절감 효과 큼)
    - yolo_calls      : 실제 YOLO 추론이 실행된 프레임 수 (= analyzed - filtered)
    - detections      : YOLO가 금지 차량을 감지한 누적 횟수
    """
    statuses = manager.get_status()
    cameras = []
    total_analyzed = total_yolo = total_detections = 0

    for s in statuses:
        filtered = s.analyzed_count - s.keras_pass_count
        rate = round(filtered / s.analyzed_count * 100, 1) if s.analyzed_count > 0 else 0.0
        cameras.append({
            "camera_id":      s.camera_id,
            "name":           s.name,
            "analyzed":       s.analyzed_count,
            "keras_filtered": filtered,
            "filter_rate_pct": rate,
            "yolo_calls":     s.keras_pass_count,
            "detections":     s.detection_count,
            "last_analyzed_at": s.last_analyzed_at,
        })
        total_analyzed   += s.analyzed_count
        total_yolo       += s.keras_pass_count
        total_detections += s.detection_count

    total_filtered = total_analyzed - total_yolo
    overall_rate = round(total_filtered / total_analyzed * 100, 1) if total_analyzed > 0 else 0.0

    return {
        "summary": {
            "total_cameras":      len(cameras),
            "total_analyzed":     total_analyzed,
            "total_keras_filtered": total_filtered,
            "filter_rate_pct":    overall_rate,
            "total_yolo_calls":   total_yolo,
            "total_detections":   total_detections,
        },
        "cameras": cameras,
    }


@router.get("/detections")
async def recent_detections(
    limit: int = Query(50, ge=1, le=200),
    cctv_no: int = Query(None),
    class_no: int = Query(None),
):
    """최근 감지 기록 조회 (백엔드 API 프록시)"""
    params = {"per_page": limit}
    if cctv_no:
        params["cctv_no"] = cctv_no
    if class_no:
        params["class_no"] = class_no

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            f"{settings.ai_backend_url}/cctv/detections", params=params
        )
        resp.raise_for_status()
        return resp.json()


@router.get("/snapshot/{camera_id}", summary="카메라 최신 스냅샷 (JPEG)")
def its_snapshot(camera_id: str):
    """분석 중인 카메라의 최신 프레임을 JPEG로 반환 (백엔드 프록시용)"""
    jpeg = manager.get_latest_jpeg(camera_id)
    if not jpeg:
        raise HTTPException(status_code=503, detail="스냅샷 없음 — 스트림이 아직 시작되지 않았거나 프레임 없음")
    return Response(content=jpeg, media_type="image/jpeg")


@router.get("/annotated/{camera_id}", summary="AI 분석 결과 오버레이 스냅샷 (JPEG)")
def its_annotated_snapshot(camera_id: str):
    """bbox가 그려진 최신 어노테이션 프레임을 JPEG로 반환"""
    jpeg = manager.get_latest_annotated_jpeg(camera_id)
    if not jpeg:
        raise HTTPException(status_code=503, detail="어노테이션 스냅샷 없음")
    return Response(content=jpeg, media_type="image/jpeg")


@router.get("/annotated-stream/{camera_id}", summary="AI 분석 결과 오버레이 MJPEG 스트림")
async def its_annotated_mjpeg(camera_id: str):
    """최신 raw 프레임에 마지막 AI bbox를 오버레이해 빠르게 스트림 (~20fps)"""
    async def gen():
        for _ in range(36000):
            jpeg = manager.get_fast_annotated_jpeg(camera_id)
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )
            await asyncio.sleep(0.05)
    return StreamingResponse(
        gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/stream/{camera_id}", summary="카메라 MJPEG 스트림")
async def its_mjpeg_stream(camera_id: str):
    """분석 중인 카메라의 최신 프레임을 MJPEG 스트림으로 반환 (백엔드 프록시용)"""
    async def gen():
        for _ in range(6000):  # 최대 10분
            jpeg = manager.get_latest_jpeg(camera_id)
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )
            await asyncio.sleep(0.1)  # 영상 캐시 갱신 주기(약 10fps)에 맞춤
    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.websocket("/ws/{camera_id}")
async def stream_websocket(websocket: WebSocket, camera_id: str):
    """실시간 분석 결과 수신 (WebSocket)"""
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def on_result(cid: str, result: dict):
        loop.call_soon_threadsafe(queue.put_nowait, result)

    if not manager.subscribe(camera_id, on_result):
        await websocket.send_json({"error": f"카메라 {camera_id} 스트림이 실행 중이 아닙니다."})
        await websocket.close()
        return

    try:
        while True:
            result = await asyncio.wait_for(queue.get(), timeout=30.0)
            await websocket.send_json(result)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        manager.unsubscribe(camera_id, on_result)
