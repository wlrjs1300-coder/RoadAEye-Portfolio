"""
schemas/admin_schema.py
관리자 기능 Pydantic 스키마
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


# ── 사용자 관리 ───────────────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    user_no:            int
    login_id:           str
    email:              Optional[str]
    name:               str
    birth_date:         Optional[date]
    phone:              Optional[str]
    role:               str
    social_provider:    Optional[str]
    is_active:          bool
    suspension_reason:  Optional[str] = None
    created_at:         datetime
    updated_at:         datetime

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    users:   List[AdminUserResponse]
    total:   int
    page:    int
    pages:   int
    per_page: int


class RoleUpdateRequest(BaseModel):
    role: str   # "user" | "admin"


class StatusUpdateRequest(BaseModel):
    is_active:          bool
    suspension_reason:  Optional[str] = None


# ── 로그 조회 ─────────────────────────────────────────────────────────────────

class ActivityLogResponse(BaseModel):
    log_no:     int
    user_no:    Optional[int]
    login_id:   Optional[str]
    action:     str
    target:     Optional[str]
    detail:     Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    logs:     List[ActivityLogResponse]
    total:    int
    page:     int
    pages:    int
    per_page: int


# ── 시스템 설정 ───────────────────────────────────────────────────────────────

class SystemConfigResponse(BaseModel):
    config_no:         int
    alert_enabled:     bool
    maintenance_mode:  bool
    max_stream_count:  int
    its_auto_sync:     bool
    its_sync_interval: int
    updated_by:        Optional[int]
    updated_at:        datetime

    model_config = {"from_attributes": True}


class SystemConfigUpdate(BaseModel):
    alert_enabled:     Optional[bool] = None
    maintenance_mode:  Optional[bool] = None
    max_stream_count:  Optional[int]  = None
    its_auto_sync:     Optional[bool] = None
    its_sync_interval: Optional[int]  = None
