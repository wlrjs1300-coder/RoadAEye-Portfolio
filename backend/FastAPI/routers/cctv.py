"""
routers/cctv.py
CCTV 전체 라우터

엔드포인트:
─────────────────────────────────────────────────────
[CCTV 관리]
  GET    /cctv                         전체 목록
  POST   /cctv                         수동 등록
  GET    /cctv/{cctv_no}               단일 조회
  PUT    /cctv/{cctv_no}               수정
  DELETE /cctv/{cctv_no}              삭제(비활성)
  PATCH  /cctv/{cctv_no}/toggle       활성 토글
  POST   /cctv/its/sync               ITS API 동기화

[실시간 스트림]
  GET    /cctv/{cctv_no}/stream        MJPEG 스트림
  GET    /cctv/{cctv_no}/snapshot      단일 프레임 JPEG

[금지 클래스]
  GET    /cctv/classes
  POST   /cctv/classes
  PUT    /cctv/classes/{class_no}
  PATCH  /cctv/classes/{class_no}/toggle

[감지 기록]
  GET    /cctv/detections              목록 (필터+페이지)
  POST   /cctv/detections             AI서버 → 저장
  GET    /cctv/detections/{no}         단일 조회
  PATCH  /cctv/detections/{no}/status  상태 변경

[통계/분석]
  GET    /cctv/stats/daily
  GET    /cctv/stats/heatmap
  GET    /cctv/stats/repeat
  GET    /cctv/stats/unread
─────────────────────────────────────────────────────
"""

from datetime import date
from typing import Optional

import httpx
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response

from core.config import settings
from core.database import get_ai_db
from core.security import get_current_user, require_admin
from models.orm import DetectionStatus
from schemas.cctv_schema import (
    CCTVCreate, CCTVUpdate,
    ForbiddenClassCreate, ForbiddenClassUpdate,
    DetectionCreate, DetectionStatusUpdate,
    ITSSyncRequest,
)
from services import cctv_service as svc
from services.stream_service import mjpeg_generator, capture_snapshot


def _ai_headers() -> dict:
    return {"X-API-Key": settings.AI_API_KEY} if settings.AI_API_KEY else {}

router = APIRouter(prefix="/cctv", tags=["CCTV"])


# ════════════════════════════════════════════════════════════════════════════
# CCTV 관리
# ════════════════════════════════════════════════════════════════════════════

@router.get("", summary="전체 CCTV 목록")
async def list_cctvs(
    active_only: bool = Query(False),
    db=Depends(get_ai_db),
):
    cctvs = await svc.get_all_cctvs(db, active_only=active_only)
    return {"success": True, "data": {"cctvs": [_cctv(c) for c in cctvs]}}


@router.post("", status_code=201, summary="CCTV 수동 등록")
async def add_cctv(body: CCTVCreate, db=Depends(get_ai_db), _=Depends(require_admin)):
    cctv = await svc.create_cctv(db, body)
    return {"success": True, "message": "등록되었습니다.", "data": {"cctv": _cctv(cctv)}}


# ════════════════════════════════════════════════════════════════════════════
# ITS 동기화 (정적 경로 — /{cctv_no} 보다 먼저 등록)
# ════════════════════════════════════════════════════════════════════════════

@router.post("/its/sync", summary="ITS API CCTV 동기화")
async def its_sync(body: ITSSyncRequest, db=Depends(get_ai_db), _=Depends(require_admin)):
    result = await svc.sync_its_cctv(db, road_type=body.road_type)
    return {"success": True, "message": "동기화 완료", "data": result}


# ════════════════════════════════════════════════════════════════════════════
# 금지 클래스 (정적 경로 — /{cctv_no} 보다 먼저 등록)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/classes", summary="금지 클래스 목록", tags=["금지클래스"])
async def list_classes(active_only: bool = Query(False), db=Depends(get_ai_db)):
    classes = await svc.get_all_classes(db, active_only=active_only)
    return {"success": True, "data": {"classes": [_fc(c) for c in classes]}}


@router.post("/classes", status_code=201, tags=["금지클래스"])
async def add_class(body: ForbiddenClassCreate, db=Depends(get_ai_db), _=Depends(require_admin)):
    fc = await svc.create_class(db, body)
    return {"success": True, "message": "등록되었습니다.", "data": {"class": _fc(fc)}}


@router.put("/classes/{class_no}", tags=["금지클래스"])
async def edit_class(class_no: int, body: ForbiddenClassUpdate, db=Depends(get_ai_db), _=Depends(require_admin)):
    fc = await svc.update_class(db, class_no, body)
    if not fc:
        raise HTTPException(404, "클래스를 찾을 수 없습니다.")
    return {"success": True, "message": "수정되었습니다.", "data": {"class": _fc(fc)}}


@router.patch("/classes/{class_no}/toggle", tags=["금지클래스"])
async def toggle_class(class_no: int, db=Depends(get_ai_db), _=Depends(require_admin)):
    fc = await svc.toggle_class(db, class_no)
    if not fc:
        raise HTTPException(404, "클래스를 찾을 수 없습니다.")
    state = "활성화" if fc.is_active else "비활성화"
    return {"success": True, "message": f"{state}되었습니다.", "data": {"class": _fc(fc)}}


# ════════════════════════════════════════════════════════════════════════════
# 감지 기록 (정적 경로 — /{cctv_no} 보다 먼저 등록)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/detections", summary="감지 기록 목록", tags=["감지기록"])
async def list_detections(
    cctv_no:   Optional[int]  = Query(None),
    class_no:  Optional[int]  = Query(None),
    status:    Optional[str]  = Query(None, description="UNREAD | CONFIRMED | DISMISSED"),
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    page:      int            = Query(1,  ge=1),
    per_page:  int            = Query(20, ge=1, le=100),
    db=Depends(get_ai_db),
):
    result = await svc.get_detections(
        db, cctv_no=cctv_no, class_no=class_no,
        status=status, date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return {"success": True, "data": result}


@router.post("/detections", status_code=201, summary="감지 기록 저장 (AI 서버 전용)", tags=["감지기록"])
async def create_detection(body: DetectionCreate, db=Depends(get_ai_db)):
    d = await svc.save_detection(db, body)
    return {"success": True, "message": "저장되었습니다.", "data": {"detection_no": d.detection_no}}


@router.get("/detections/{detection_no}", tags=["감지기록"])
async def get_detection(detection_no: int, db=Depends(get_ai_db)):
    d = await svc.get_detection(db, detection_no)
    if not d:
        raise HTTPException(404, "감지 기록을 찾을 수 없습니다.")
    from services.cctv_service import _detection_to_dict
    return {"success": True, "data": {"detection": _detection_to_dict(d)}}


@router.patch("/detections/{detection_no}/status", tags=["감지기록"])
async def change_status(
    detection_no: int,
    body:         DetectionStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_ai_db),
):
    d = await svc.change_detection_status(db, detection_no, body.status, int(current_user["sub"]))
    if not d:
        raise HTTPException(404, "감지 기록을 찾을 수 없습니다.")
    from services.cctv_service import _detection_to_dict
    return {"success": True, "message": "상태가 변경되었습니다.", "data": {"detection": _detection_to_dict(d)}}


# ════════════════════════════════════════════════════════════════════════════
# 통계 / 분석 (정적 경로 — /{cctv_no} 보다 먼저 등록)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/stats/daily", summary="일별 감지 통계", tags=["통계"])
async def daily_stats(
    target_date: Optional[date] = Query(None, alias="date"),
    db=Depends(get_ai_db),
):
    return {"success": True, "data": await svc.get_daily_stats(db, target_date)}


@router.get("/stats/heatmap", summary="위험도 히트맵", tags=["통계"])
async def heatmap(db=Depends(get_ai_db)):
    return {"success": True, "data": {"heatmap": await svc.get_heatmap_data(db)}}




@router.get("/stats/heatmap/classes", summary="위험도 히트맵 객체별 통계", tags=["통계"])
async def heatmap_classes(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db=Depends(get_ai_db),
):
    return {
        "success": True,
        "data": {
            "items": await svc.get_heatmap_class_stats(db, date_from=date_from, date_to=date_to),
        },
    }


@router.get("/stats/repeat", summary="반복 감지 분석", tags=["통계"])
async def repeat(
    min_count: int = Query(3, ge=1),
    days:      int = Query(7, ge=1),
    db=Depends(get_ai_db),
):
    return {"success": True, "data": {"repeat_detections": await svc.get_repeat_detections(db, min_count, days)}}


@router.get("/stats/unread", summary="미확인 감지 건수", tags=["통계"])
async def unread(db=Depends(get_ai_db)):
    return {"success": True, "data": {"unread_count": await svc.count_unread(db)}}


# ════════════════════════════════════════════════════════════════════════════
# CCTV 단건 조작 (동적 경로 — 정적 경로들 뒤에 등록)
# ════════════════════════════════════════════════════════════════════════════

@router.get("/{cctv_no}", summary="단일 CCTV 조회")
async def get_cctv(cctv_no: int, db=Depends(get_ai_db)):
    cctv = await svc.get_cctv(db, cctv_no)
    if not cctv:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")
    return {"success": True, "data": {"cctv": _cctv(cctv)}}


@router.put("/{cctv_no}", summary="CCTV 수정")
async def edit_cctv(cctv_no: int, body: CCTVUpdate, db=Depends(get_ai_db), _=Depends(require_admin)):
    cctv = await svc.update_cctv(db, cctv_no, body)
    if not cctv:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")
    return {"success": True, "message": "수정되었습니다.", "data": {"cctv": _cctv(cctv)}}


@router.delete("/{cctv_no}", summary="CCTV 삭제")
async def remove_cctv(cctv_no: int, db=Depends(get_ai_db), _=Depends(require_admin)):
    ok = await svc.delete_cctv(db, cctv_no)
    if not ok:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")
    return {"success": True, "message": "삭제(비활성)되었습니다."}


@router.patch("/{cctv_no}/toggle", summary="활성/비활성 토글")
async def toggle_cctv(cctv_no: int, db=Depends(get_ai_db), _=Depends(require_admin)):
    cctv = await svc.toggle_cctv(db, cctv_no)
    if not cctv:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")
    state = "활성화" if cctv.is_active else "비활성화"
    return {"success": True, "message": f"{state}되었습니다.", "data": {"cctv": _cctv(cctv)}}


# ════════════════════════════════════════════════════════════════════════════
# 실시간 스트림
# ════════════════════════════════════════════════════════════════════════════

@router.get(
    "/{cctv_no}/stream",
    summary="MJPEG 실시간 스트림",
    description="React: `<img src='/cctv/{cctv_no}/stream' />` 으로 바로 사용 가능",
    response_class=StreamingResponse,
)
async def stream_cctv(cctv_no: int, db=Depends(get_ai_db)):
    cctv = await svc.get_cctv(db, cctv_no)
    if not cctv:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")
    # ITS streams are managed by the AI server. The DB flag can be stale after
    # an AI server recovery, so let the AI proxy decide whether frames exist.
    if not cctv.is_active and not cctv.its_cctv_id:
        raise HTTPException(400, "비활성화된 CCTV입니다.")

    # ITS 카메라 → AI 서버 MJPEG 스트림 프록시
    if cctv.its_cctv_id:
        cam_id_enc = quote(cctv.its_cctv_id, safe="")
        ai_url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/its/stream/{cam_id_enc}"

        async def proxy_stream():
            try:
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("GET", ai_url, headers=_ai_headers()) as r:
                        async for chunk in r.aiter_bytes(chunk_size=4096):
                            yield chunk
            except Exception:
                pass

        return StreamingResponse(
            proxy_stream(),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )

    # 일반 스트림 (직접 연결)
    return StreamingResponse(
        mjpeg_generator(cctv.stream_url),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get(
    "/{cctv_no}/annotated-stream",
    summary="AI bbox 오버레이 MJPEG 스트림",
    response_class=StreamingResponse,
)
async def annotated_stream_cctv(cctv_no: int, db=Depends(get_ai_db)):
    """bbox가 그려진 어노테이션 MJPEG 스트림 — 대시보드 AI 분석 뷰용"""
    cctv = await svc.get_cctv(db, cctv_no)
    if not cctv or not cctv.its_cctv_id:
        raise HTTPException(404, "ITS CCTV를 찾을 수 없습니다.")

    cam_id_enc = quote(cctv.its_cctv_id, safe="")
    ai_url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/its/annotated-stream/{cam_id_enc}"

    async def proxy_annotated():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("GET", ai_url, headers=_ai_headers()) as r:
                    async for chunk in r.aiter_bytes(chunk_size=4096):
                        yield chunk
        except Exception:
            pass

    return StreamingResponse(
        proxy_annotated(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/{cctv_no}/annotated-snapshot", summary="AI bbox 오버레이 단일 스냅샷 (JPEG)")
async def annotated_snapshot(cctv_no: int, db=Depends(get_ai_db)):
    """bbox가 그려진 최신 프레임 단일 JPEG — 폴링 방식으로 사용 (렉 없음)"""
    cctv = await svc.get_cctv(db, cctv_no)
    if not cctv or not cctv.its_cctv_id:
        raise HTTPException(404, "ITS CCTV를 찾을 수 없습니다.")

    cam_id_enc = quote(cctv.its_cctv_id, safe="")
    ai_url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/its/annotated/{cam_id_enc}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(ai_url, headers=_ai_headers())
            if r.status_code == 200:
                return Response(
                    content=r.content,
                    media_type="image/jpeg",
                    headers={"Cache-Control": "no-store"},
                )
    except Exception:
        pass
    raise HTTPException(503, "어노테이션 스냅샷을 가져올 수 없습니다.")


@router.get("/{cctv_no}/snapshot", summary="단일 프레임 캡처 (JPEG)")
async def snapshot(cctv_no: int, db=Depends(get_ai_db)):
    cctv = await svc.get_cctv(db, cctv_no)
    if not cctv:
        raise HTTPException(404, "CCTV를 찾을 수 없습니다.")

    # ITS 카메라 → AI 서버 스냅샷 프록시
    if cctv.its_cctv_id:
        # ITS 카메라는 AI 서버만 스트림에 접근 가능 — 직접 OpenCV fallback 없음
        cam_id_enc = quote(cctv.its_cctv_id, safe="")
        ai_url = f"{settings.AI_SERVER_URL.rstrip('/')}/api/v1/its/snapshot/{cam_id_enc}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(ai_url, headers=_ai_headers())
                if r.status_code == 200:
                    return Response(content=r.content, media_type="image/jpeg")
        except Exception:
            pass
        raise HTTPException(503, "스트림이 시작되지 않았거나 아직 프레임 없음")

    # 일반 CCTV (직접 연결)
    frame = await capture_snapshot(cctv.stream_url)
    if not frame:
        raise HTTPException(503, "프레임을 가져올 수 없습니다.")
    return Response(content=frame, media_type="image/jpeg")


# ── 직렬화 헬퍼 ──────────────────────────────────────────────────────────────
def _cctv(c) -> dict:
    return {
        "cctv_no":     c.cctv_no,
        "its_cctv_id": c.its_cctv_id,
        "name":        c.name,
        "alias":       c.alias,
        "stream_url":  c.stream_url,
        "latitude":    float(c.latitude)  if c.latitude  else None,
        "longitude":   float(c.longitude) if c.longitude else None,
        "is_active":   bool(c.is_active),
        "created_at":  c.created_at.isoformat() if c.created_at else None,
        "updated_at":  c.updated_at.isoformat() if c.updated_at else None,
    }


def _fc(c) -> dict:
    return {
        "class_no":     c.class_no,
        "class_name":   c.class_name,
        "display_name": c.display_name,
        "is_active":    bool(c.is_active),
        "created_at":   c.created_at.isoformat() if c.created_at else None,
    }
