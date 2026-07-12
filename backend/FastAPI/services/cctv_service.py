"""
services/cctv_service.py
CCTV / 금지클래스 / 감지기록 / ITS API / 통계 비동기 서비스
"""

from __future__ import annotations

from datetime import datetime, date, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from models.orm import CCTV, ForbiddenClass, Detection, DetectionStatus
from services.ws_service import ws_manager
from schemas.cctv_schema import (
    CCTVCreate, CCTVUpdate,
    ForbiddenClassCreate, ForbiddenClassUpdate,
    DetectionCreate, ITSSyncRequest,
)


# ════════════════════════════════════════════════════════════════════════════
# 기본 금지 클래스 시딩
# ════════════════════════════════════════════════════════════════════════════
_DEFAULT_CLASSES = [
    {"class_name": "kickboard",            "display_name": "킥보드"},
    {"class_name": "motorcycle",           "display_name": "오토바이"},
    {"class_name": "construction_vehicle", "display_name": "건설차량"},
    {"class_name": "pedestrian",           "display_name": "보행자"},
    {"class_name": "bicycle",              "display_name": "자전거"},
    {"class_name": "wrong_way_vehicle",    "display_name": "역주행 차량"},
]


async def seed_default_classes(db: AsyncSession) -> None:
    for item in _DEFAULT_CLASSES:
        result = await db.execute(
            select(ForbiddenClass).where(ForbiddenClass.class_name == item["class_name"])
        )
        if not result.scalar_one_or_none():
            db.add(ForbiddenClass(**item))
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# CCTV CRUD
# ════════════════════════════════════════════════════════════════════════════
async def get_all_cctvs(db: AsyncSession, active_only: bool = False) -> list[CCTV]:
    stmt = select(CCTV)
    if active_only:
        stmt = stmt.where(CCTV.is_active == 1)
    result = await db.execute(stmt.order_by(CCTV.cctv_no))
    return result.scalars().all()


async def get_cctv(db: AsyncSession, cctv_no: int) -> CCTV | None:
    result = await db.execute(select(CCTV).where(CCTV.cctv_no == cctv_no))
    return result.scalar_one_or_none()


async def create_cctv(db: AsyncSession, data: CCTVCreate) -> CCTV:
    cctv = CCTV(**data.model_dump())
    db.add(cctv)
    await db.commit()
    await db.refresh(cctv)
    return cctv


async def update_cctv(db: AsyncSession, cctv_no: int, data: CCTVUpdate) -> CCTV | None:
    cctv = await get_cctv(db, cctv_no)
    if not cctv:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cctv, field, value)
    await db.commit()
    await db.refresh(cctv)
    return cctv


async def delete_cctv(db: AsyncSession, cctv_no: int) -> bool:
    cctv = await get_cctv(db, cctv_no)
    if not cctv:
        return False
    count = (await db.execute(
        select(func.count()).where(Detection.cctv_no == cctv_no)
    )).scalar()
    if count > 0:
        cctv.is_active = 0  # 감지 기록 있으면 비활성화
    else:
        await db.delete(cctv)
    await db.commit()
    return True


async def toggle_cctv(db: AsyncSession, cctv_no: int) -> CCTV | None:
    cctv = await get_cctv(db, cctv_no)
    if not cctv:
        return None
    new_state = 0 if cctv.is_active else 1
    cctv.is_active = new_state
    await db.commit()
    await db.refresh(cctv)

    # AI 서버 스트림 시작/중지 연동
    if cctv.stream_url:
        try:
            ai_url = settings.AI_SERVER_URL
            async with httpx.AsyncClient(timeout=5.0) as hc:
                if new_state == 1:
                    await hc.post(f"{ai_url}/api/v1/its/stream/start", json={
                        "camera_id": cctv.its_cctv_id or str(cctv.cctv_no),
                        "stream_url": cctv.stream_url,
                        "name": cctv.name or "",
                    })
                else:
                    await hc.post(f"{ai_url}/api/v1/its/stream/stop", json={
                        "camera_id": cctv.its_cctv_id or str(cctv.cctv_no),
                    })
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"AI 서버 스트림 연동 실패 (cctv_no={cctv_no}): {e}")

    return cctv


# ════════════════════════════════════════════════════════════════════════════
# 금지 클래스 CRUD
# ════════════════════════════════════════════════════════════════════════════
async def get_all_classes(db: AsyncSession, active_only: bool = False) -> list[ForbiddenClass]:
    stmt = select(ForbiddenClass)
    if active_only:
        stmt = stmt.where(ForbiddenClass.is_active == 1)
    result = await db.execute(stmt.order_by(ForbiddenClass.class_no))
    return result.scalars().all()


async def get_class(db: AsyncSession, class_no: int) -> ForbiddenClass | None:
    result = await db.execute(select(ForbiddenClass).where(ForbiddenClass.class_no == class_no))
    return result.scalar_one_or_none()


async def create_class(db: AsyncSession, data: ForbiddenClassCreate) -> ForbiddenClass:
    dup = await db.execute(
        select(ForbiddenClass).where(ForbiddenClass.class_name == data.class_name)
    )
    if dup.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(409, f"'{data.class_name}' 클래스는 이미 존재합니다.")
    fc = ForbiddenClass(**data.model_dump())
    db.add(fc)
    await db.commit()
    await db.refresh(fc)
    return fc


async def update_class(db: AsyncSession, class_no: int, data: ForbiddenClassUpdate) -> ForbiddenClass | None:
    fc = await get_class(db, class_no)
    if not fc:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(fc, field, value)
    await db.commit()
    await db.refresh(fc)
    return fc


async def toggle_class(db: AsyncSession, class_no: int) -> ForbiddenClass | None:
    fc = await get_class(db, class_no)
    if not fc:
        return None
    fc.is_active = 0 if fc.is_active else 1
    await db.commit()
    await db.refresh(fc)
    return fc


# ════════════════════════════════════════════════════════════════════════════
# 감지 기록
# ════════════════════════════════════════════════════════════════════════════
async def save_detection(db: AsyncSession, data: DetectionCreate) -> Detection:
    detection = Detection(
        cctv_no     = data.cctv_no,
        class_no    = data.class_no,
        confidence  = data.confidence,
        image_path  = data.image_path,
        detected_at = data.detected_at or datetime.now(timezone.utc),
        status      = DetectionStatus.UNREAD,
    )
    db.add(detection)
    await db.commit()
    await db.refresh(detection)

    # WebSocket 실시간 알림 브로드캐스트
    await ws_manager.broadcast({
        "type": "detection",
        "data": {
            "detection_no": detection.detection_no,
            "cctv_no":      detection.cctv_no,
            "class_no":     detection.class_no,
            "confidence":   float(detection.confidence),
            "detected_at":  detection.detected_at.isoformat(),
        },
    })

    return detection


async def get_detections(
    db:        AsyncSession,
    cctv_no:   Optional[int]  = None,
    class_no:  Optional[int]  = None,
    status:    Optional[str]  = None,
    date_from: Optional[date] = None,
    date_to:   Optional[date] = None,
    page:      int = 1,
    per_page:  int = 20,
) -> dict:
    stmt = (
        select(Detection)
        .options(selectinload(Detection.cctv), selectinload(Detection.forbidden_class))
    )
    if cctv_no:
        stmt = stmt.where(Detection.cctv_no == cctv_no)
    if class_no:
        stmt = stmt.where(Detection.class_no == class_no)
    if status:
        stmt = stmt.where(Detection.status == DetectionStatus(status))
    if date_from:
        stmt = stmt.where(Detection.detected_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(Detection.detected_at <= datetime.combine(date_to, datetime.max.time()))

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar()

    rows = (await db.execute(
        stmt.order_by(Detection.detected_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
    )).scalars().all()

    return {
        "items":    [_detection_to_dict(d) for d in rows],
        "total":    total,
        "page":     page,
        "pages":    -(-total // per_page),
        "per_page": per_page,
    }


async def get_detection(db: AsyncSession, detection_no: int) -> Detection | None:
    result = await db.execute(
        select(Detection)
        .options(selectinload(Detection.cctv), selectinload(Detection.forbidden_class))
        .where(Detection.detection_no == detection_no)
    )
    return result.scalar_one_or_none()


async def change_detection_status(
    db: AsyncSession,
    detection_no: int,
    status: DetectionStatus,
    handler_no: int,
) -> Detection | None:
    d = await get_detection(db, detection_no)
    if not d:
        return None
    d.status     = status
    d.handled_by = handler_no
    d.handled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(d)
    return d


async def count_unread(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).where(Detection.status == DetectionStatus.UNREAD)
    )
    return result.scalar()


# ════════════════════════════════════════════════════════════════════════════
# 통계
# ════════════════════════════════════════════════════════════════════════════
async def get_daily_stats(db: AsyncSession, target_date: Optional[date] = None) -> dict:
    target = target_date or date.today()
    start  = datetime.combine(target, datetime.min.time())
    end    = datetime.combine(target, datetime.max.time())

    total = (await db.execute(
        select(func.count()).where(Detection.detected_at.between(start, end))
    )).scalar()

    by_class_rows = (await db.execute(
        select(ForbiddenClass.class_no, ForbiddenClass.display_name,
               func.count(Detection.detection_no).label("cnt"))
        .join(Detection, Detection.class_no == ForbiddenClass.class_no)
        .where(Detection.detected_at.between(start, end))
        .group_by(ForbiddenClass.class_no, ForbiddenClass.display_name)
    )).all()

    by_status = {}
    for s in DetectionStatus:
        cnt = (await db.execute(
            select(func.count()).where(
                and_(Detection.status == s, Detection.detected_at.between(start, end))
            )
        )).scalar()
        by_status[s.value] = cnt

    by_cctv_rows = (await db.execute(
        select(CCTV.cctv_no, CCTV.name,
               func.count(Detection.detection_no).label("cnt"))
        .join(Detection, Detection.cctv_no == CCTV.cctv_no)
        .where(Detection.detected_at.between(start, end))
        .group_by(CCTV.cctv_no, CCTV.name)
        .order_by(func.count(Detection.detection_no).desc())
        .limit(10)
    )).all()

    return {
        "date":      target.isoformat(),
        "total":     total,
        "by_class":  [{"class_no": r.class_no, "display_name": r.display_name, "count": r.cnt}
                      for r in by_class_rows],
        "by_status": by_status,
        "by_cctv":   [{"cctv_no": r.cctv_no, "name": r.name, "count": r.cnt}
                      for r in by_cctv_rows],
    }


async def get_heatmap_data(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(CCTV.cctv_no, CCTV.name, CCTV.latitude, CCTV.longitude,
               func.count(Detection.detection_no).label("cnt"))
        .join(Detection, Detection.cctv_no == CCTV.cctv_no)
        .where(CCTV.latitude.isnot(None), CCTV.longitude.isnot(None))
        .group_by(CCTV.cctv_no, CCTV.name, CCTV.latitude, CCTV.longitude)
    )).all()
    return [
        {"cctv_no": r.cctv_no, "name": r.name,
         "latitude": float(r.latitude), "longitude": float(r.longitude), "count": r.cnt}
        for r in rows
    ]


async def get_heatmap_class_stats(
    db: AsyncSession,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[dict]:
    filters = [CCTV.latitude.isnot(None), CCTV.longitude.isnot(None)]
    if date_from:
        filters.append(Detection.detected_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(Detection.detected_at <= datetime.combine(date_to, datetime.max.time()))

    rows = (await db.execute(
        select(
            CCTV.cctv_no,
            CCTV.name,
            CCTV.latitude,
            CCTV.longitude,
            ForbiddenClass.class_no,
            ForbiddenClass.class_name,
            ForbiddenClass.display_name,
            func.count(Detection.detection_no).label("cnt"),
            func.max(Detection.detected_at).label("last_at"),
        )
        .join(Detection, Detection.cctv_no == CCTV.cctv_no)
        .join(ForbiddenClass, ForbiddenClass.class_no == Detection.class_no)
        .where(and_(*filters))
        .group_by(
            CCTV.cctv_no,
            CCTV.name,
            CCTV.latitude,
            CCTV.longitude,
            ForbiddenClass.class_no,
            ForbiddenClass.class_name,
            ForbiddenClass.display_name,
        )
        .order_by(func.count(Detection.detection_no).desc())
    )).all()

    by_cctv: dict[int, dict] = {}
    for row in rows:
        item = by_cctv.setdefault(row.cctv_no, {
            "cctv_no": row.cctv_no,
            "name": row.name,
            "latitude": float(row.latitude),
            "longitude": float(row.longitude),
            "total": 0,
            "last_detected_at": None,
            "classes": [],
        })
        count = int(row.cnt or 0)
        item["total"] += count
        if row.last_at:
            last_iso = row.last_at.isoformat()
            if item["last_detected_at"] is None or last_iso > item["last_detected_at"]:
                item["last_detected_at"] = last_iso
        item["classes"].append({
            "class_no": row.class_no,
            "class_name": row.class_name,
            "display_name": row.display_name,
            "count": count,
        })

    return sorted(by_cctv.values(), key=lambda item: item["total"], reverse=True)


async def get_repeat_detections(
    db: AsyncSession, min_count: int = 3, days: int = 7
) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(
        select(CCTV.cctv_no, CCTV.name,
               func.count(Detection.detection_no).label("cnt"),
               func.max(Detection.detected_at).label("last_at"))
        .join(Detection, Detection.cctv_no == CCTV.cctv_no)
        .where(Detection.detected_at >= since)
        .group_by(CCTV.cctv_no, CCTV.name)
        .having(func.count(Detection.detection_no) >= min_count)
        .order_by(func.count(Detection.detection_no).desc())
    )).all()
    return [
        {"cctv_no": r.cctv_no, "name": r.name, "count": r.cnt,
         "last_detected_at": r.last_at.isoformat() if r.last_at else None}
        for r in rows
    ]


# ════════════════════════════════════════════════════════════════════════════
# ITS API 동기화
# ════════════════════════════════════════════════════════════════════════════
async def sync_its_cctv(db: AsyncSession, road_type: int = 1) -> dict:
    if not settings.ITS_API_KEY:
        from fastapi import HTTPException
        raise HTTPException(400, "ITS_API_KEY가 설정되지 않았습니다.")

    params = {
        "apiKey":   settings.ITS_API_KEY,
        "type":     "json",
        "cctvType": road_type,
        "minX": 126.0, "maxX": 130.0,
        "minY": 34.0,  "maxY": 38.5,
        "getType": "json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get("https://openapi.its.go.kr:9443/cctvInfo", params=params)
        resp.raise_for_status()
        items = resp.json().get("response", {}).get("data", [])

    inserted = updated = 0
    for item in items:
        stream_url = item.get("cctvurl", "")
        if not stream_url:
            continue
        its_id = item.get("cctvuniqueid") or item.get("cctvId")
        existing = (await db.execute(
            select(CCTV).where(CCTV.its_cctv_id == its_id)
        )).scalar_one_or_none()

        lat = _safe_float(item.get("coordy"))
        lng = _safe_float(item.get("coordx"))

        if existing:
            existing.name = item.get("cctvname", "")
            existing.stream_url = stream_url
            existing.latitude = lat
            existing.longitude = lng
            updated += 1
        else:
            db.add(CCTV(
                its_cctv_id=its_id, name=item.get("cctvname", ""),
                stream_url=stream_url, latitude=lat, longitude=lng, is_active=1,
            ))
            inserted += 1

    await db.commit()
    return {"inserted": inserted, "updated": updated, "total": inserted + updated}


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────
def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


def _detection_to_dict(d: Detection) -> dict:
    return {
        "detection_no": d.detection_no,
        "cctv_no":      d.cctv_no,
        "class_no":     d.class_no,
        "confidence":   float(d.confidence),
        "image_path":   d.image_path,
        "detected_at":  d.detected_at.isoformat(),
        "status":       d.status.value,
        "handled_by":   d.handled_by,
        "handled_at":   d.handled_at.isoformat() if d.handled_at else None,
        "cctv_name":    d.cctv.name if d.cctv else None,
        "class_name":   d.forbidden_class.display_name if d.forbidden_class else None,
    }
