"""
routers/its.py
ITS(국토교통부) 카메라 / AI 서버 스트림 관리 프록시

브라우저 → 백엔드 → AI 서버(.246:8001) 경유.
AI 서버는 외부에서 직접 접근이 차단되어 있어 백엔드가 프록시 역할을 함.

엔드포인트:
  GET       /its/cameras                  카메라 검색 (좌표 범위)
  GET       /its/stream/status            활성 스트림 목록
  POST      /its/stream/start             스트림 분석 시작
  POST      /its/stream/stop              스트림 분석 중지
  WebSocket /its/ws/{camera_id}           실시간 감지 결과 (AI 서버 WS 단방향 forwarding)
"""

import asyncio
import time
from typing import Any, Dict, Optional, Tuple

import httpx
import websockets
from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_ai_db
from models.orm import CCTV

router = APIRouter(prefix="/its", tags=["ITS Proxy"])

# AI 서버 주소 — settings에서 가져옴 (.env의 AI_SERVER_URL).
AI_BASE = settings.AI_SERVER_URL.rstrip("/")
AI_WS_BASE = AI_BASE.replace("http://", "ws://").replace("https://", "wss://")
DEFAULT_TIMEOUT = 30.0
SHORT_TIMEOUT = 8.0


def _ai_headers() -> Dict[str, str]:
    """AI 서버 호출 시 사용할 인증 헤더. AI 서버의 verify_api_key가 요구하는 X-API-Key."""
    return {"X-API-Key": settings.AI_API_KEY} if settings.AI_API_KEY else {}


async def _proxy_get(path: str, params: Optional[Dict[str, Any]] = None, timeout: float = DEFAULT_TIMEOUT):
    """AI 서버로 GET 프록시. AI 서버 에러는 502로 변환해 상위에 알림."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.get(f"{AI_BASE}{path}", params=params, headers=_ai_headers())
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"AI 서버 호출 실패: {e}")
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


async def _proxy_post(path: str, body: Dict[str, Any], timeout: float = SHORT_TIMEOUT):
    """AI 서버로 POST 프록시. 409(이미 실행 중) 같은 의미 있는 상태코드는 보존."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(f"{AI_BASE}{path}", json=body, headers=_ai_headers())
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"AI 서버 호출 실패: {e}")
    if r.status_code >= 400:
        # AI 서버가 의도적으로 보낸 4xx는 그대로 전달 (409 이미 실행 중 등)
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        raise HTTPException(status_code=r.status_code, detail=detail)
    return r.json()


# ───────────────────────────────────────────────────────────────────────
# ITS 카메라 목록 — 좌표 박스 단위 메모리 캐싱 (TTL 5분)
# 외부 ITS API 호출이 2~3초 걸리고 응답이 1.5MB라, 동일 좌표 박스는 캐시에서 즉시 응답.
# 사용자가 권역 칩으로 매번 같은 박스를 호출하는 패턴에 효과적.
# ───────────────────────────────────────────────────────────────────────
_camera_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CAMERA_CACHE_TTL = 300.0  # 5분


@router.get("/cameras", summary="ITS 카메라 목록 조회 (좌표 범위, 5분 캐시)")
async def list_cameras(
    min_x: float = Query(126.0, description="최소 경도"),
    max_x: float = Query(130.0, description="최대 경도"),
    min_y: float = Query(34.0,  description="최소 위도"),
    max_y: float = Query(38.5,  description="최대 위도"),
):
    key = f"{min_x},{max_x},{min_y},{max_y}"
    now = time.time()
    cached = _camera_cache.get(key)
    if cached and (now - cached[0]) < _CAMERA_CACHE_TTL:
        # 캐시 메타 한 줄 추가 — 프론트 디버깅용 (필수 X)
        return {**cached[1], "cached": True, "cache_age_sec": int(now - cached[0])}

    data = await _proxy_get(
        "/api/v1/its/cameras",
        params={"min_x": min_x, "max_x": max_x, "min_y": min_y, "max_y": max_y},
    )
    _camera_cache[key] = (now, data)
    return data


@router.get("/stream/status", summary="현재 활성 스트림 목록 (+ cctv_no 첨부)")
async def stream_status(db: AsyncSession = Depends(get_ai_db)):
    """
    AI 서버의 활성 스트림 목록을 가져오면서, 각 항목의 `camera_id`(=its_cctv_id)에 대응하는
    백엔드 `cctvs.cctv_no`를 lookup해 첨부. 프론트가 `/cctv/{cctv_no}/stream`(MJPEG)로
    영상 미리보기를 표시할 수 있도록.
    """
    ai_resp = await _proxy_get("/api/v1/its/stream/status", timeout=SHORT_TIMEOUT)
    streams = ai_resp.get("streams") or []
    if streams:
        its_ids = [s.get("camera_id") for s in streams if s.get("camera_id")]
        if its_ids:
            try:
                result = await db.execute(
                    select(CCTV)
                    .where(CCTV.its_cctv_id.in_(its_ids))
                    .order_by(CCTV.is_active.desc(), CCTV.updated_at.desc(), CCTV.cctv_no.desc())
                )
                id_map = {}
                for cctv in result.scalars():
                    id_map.setdefault(cctv.its_cctv_id, cctv.cctv_no)
                for s in streams:
                    s["cctv_no"] = id_map.get(s.get("camera_id"))
            except Exception:
                pass  # lookup 실패해도 활성 목록 자체는 그대로 반환
    return ai_resp


@router.post("/stream/start", summary="스트림 분석 시작 + cctvs UPSERT")
async def stream_start(request: Request, db: AsyncSession = Depends(get_ai_db)):
    """
    AI 서버에 분석 시작을 요청하고, 동시에 백엔드 `cctvs` 테이블에 UPSERT.
    프론트가 영상 미리보기를 위해 `/cctv/{cctv_no}/stream` 을 호출할 수 있도록 cctv_no를 응답에 포함.

    같은 `its_cctv_id`(=`camera_id`)가 이미 있으면 stream_url·name만 갱신해 fresh URL을 유지.
    """
    body = await request.json()

    # 1) AI 서버로 프록시 (분석 시작) — 실패하면 여기서 예외
    ai_resp = await _proxy_post("/api/v1/its/stream/start", body)

    # 2) 백엔드 DB cctvs UPSERT — 영상 미리보기·MJPEG 표시용. VIP 정상화되면 .249로 자동 복제.
    its_id = body.get("camera_id") or ""
    name = body.get("name", "") or its_id
    stream_url = body.get("stream_url", "") or ""

    cctv_no: Optional[int] = None
    try:
        result = await db.execute(
            select(CCTV)
            .where(CCTV.its_cctv_id == its_id)
            .order_by(CCTV.is_active.desc(), CCTV.updated_at.desc(), CCTV.cctv_no.desc())
        )
        cctv = result.scalars().first()
        if cctv:
            # 같은 카메라 재시작 — fresh URL/이름으로 갱신, 활성화
            cctv.name = name
            cctv.stream_url = stream_url
            cctv.is_active = 1
        else:
            cctv = CCTV(its_cctv_id=its_id, name=name, stream_url=stream_url, is_active=1)
            db.add(cctv)
        await db.commit()
        await db.refresh(cctv)
        cctv_no = cctv.cctv_no
    except Exception:
        # DB UPSERT 실패해도 분석 자체는 이미 시작됐으므로 성공으로 반환 (미리보기만 안 보임)
        await db.rollback()

    return {**ai_resp, "cctv_no": cctv_no}


@router.post("/stream/stop", summary="스트림 분석 중지 + cctvs 비활성화")
async def stream_stop(request: Request, db: AsyncSession = Depends(get_ai_db)):
    """
    AI 서버 분석 중지 + 백엔드 cctvs.is_active=0 동시 수행.
    그렇지 않으면 CCTV 목록(/cctv?active_only=true)에 계속 남아 사용자가 "삭제 후 다시 등장"으로 인식.
    """
    body = await request.json()
    ai_resp = await _proxy_post("/api/v1/its/stream/stop", body)

    its_id = body.get("camera_id")
    if its_id:
        try:
            result = await db.execute(
            select(CCTV)
            .where(CCTV.its_cctv_id == its_id)
            .order_by(CCTV.is_active.desc(), CCTV.updated_at.desc(), CCTV.cctv_no.desc())
        )
            cctv = result.scalars().first()
            if cctv:
                cctv.is_active = 0
        except Exception:
            await db.rollback()  # stop 자체는 이미 성공, 실패해도 응답은 정상 반환
    return ai_resp


@router.websocket("/ws/{camera_id}")
async def ws_proxy(websocket: WebSocket, camera_id: str):
    """
    AI 서버의 `/api/v1/its/ws/{camera_id}` WebSocket을 백엔드가 중계.

    단방향(AI → 클라이언트) forwarding. 클라이언트는 메시지를 보내지 않는다고 가정.
    클라이언트 또는 AI 서버 어느 쪽이든 끊기면 정리하고 종료.
    """
    await websocket.accept()
    ai_url = f"{AI_WS_BASE}/api/v1/its/ws/{camera_id}"
    # AI 서버 verify_api_key를 통과하려면 WebSocket 핸드셰이크 헤더에도 X-API-Key 필요
    extra_headers = [("X-API-Key", settings.AI_API_KEY)] if settings.AI_API_KEY else None
    try:
        async with websockets.connect(ai_url, open_timeout=8, additional_headers=extra_headers) as ai_ws:
            async for raw in ai_ws:
                # websockets는 str / bytes 둘 다 가능. FastAPI는 send_text 우선
                if isinstance(raw, bytes):
                    await websocket.send_bytes(raw)
                else:
                    await websocket.send_text(raw)
    except WebSocketDisconnect:
        pass
    except (websockets.exceptions.ConnectionClosedError,
            websockets.exceptions.ConnectionClosedOK):
        # AI 서버 측 정상/비정상 종료
        pass
    except Exception as e:
        # AI 서버 연결 실패 등은 에러 메시지 한 줄 보내고 종료
        try:
            await websocket.send_json({"error": f"AI 서버 WS 연결 실패: {e}"})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
