"""
schemas/cctv_schema.py
CCTV / 금지클래스 / 감지기록 Pydantic 스키마
"""

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field

from models.orm import DetectionStatus


# ── CCTV ─────────────────────────────────────────────────────────────────────
class CCTVCreate(BaseModel):
    its_cctv_id: Optional[str]   = None
    name:        str              = Field(..., min_length=1, max_length=100)
    alias:       Optional[str]   = None
    stream_url:  str              = Field(..., min_length=1, max_length=500)
    latitude:    Optional[float] = None
    longitude:   Optional[float] = None
    is_active:   int              = Field(default=1, ge=0, le=1)


class CCTVUpdate(BaseModel):
    name:       Optional[str]   = None
    alias:      Optional[str]   = None
    stream_url: Optional[str]   = None
    latitude:   Optional[float] = None
    longitude:  Optional[float] = None
    is_active:  Optional[int]   = Field(default=None, ge=0, le=1)


# ── 금지 클래스 ───────────────────────────────────────────────────────────────
class ForbiddenClassCreate(BaseModel):
    class_name:   str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=50)


class ForbiddenClassUpdate(BaseModel):
    display_name: Optional[str] = None
    is_active:    Optional[int] = Field(default=None, ge=0, le=1)


# ── 감지 기록 ─────────────────────────────────────────────────────────────────
class DetectionCreate(BaseModel):
    """AI Vision 서버에서 감지 결과 전송 시 사용"""
    cctv_no:     int
    class_no:    int
    confidence:  float           = Field(..., ge=0.0, le=1.0)
    image_path:  str
    detected_at: Optional[datetime] = None


class DetectionStatusUpdate(BaseModel):
    status: DetectionStatus = Field(..., description="CONFIRMED | DISMISSED")


# ── ITS 동기화 ────────────────────────────────────────────────────────────────
class ITSSyncRequest(BaseModel):
    road_type: int = Field(default=1, ge=1, le=2, description="1=고속도로, 2=국도")
