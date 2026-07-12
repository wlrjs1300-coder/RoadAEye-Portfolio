"""
services/admin_service.py
관리자 기능 비즈니스 로직
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from models.orm import User
from models.admin_orm import ActivityLog, SystemConfig
from schemas.admin_schema import RoleUpdateRequest, SystemConfigUpdate


# ════════════════════════════════════════════════════════════════════════════
# 활동 로그 기록 (내부 유틸)
# ════════════════════════════════════════════════════════════════════════════
async def write_log(
    db:         AsyncSession,
    action:     str,
    user_no:    Optional[int]  = None,
    login_id:   Optional[str]  = None,
    target:     Optional[str]  = None,
    detail:     Optional[str]  = None,
    ip_address: Optional[str]  = None,
) -> None:
    db.add(ActivityLog(
        user_no    = user_no,
        login_id   = login_id,
        action     = action,
        target     = target,
        detail     = detail,
        ip_address = ip_address,
    ))
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 사용자 관리
# ════════════════════════════════════════════════════════════════════════════
async def get_users(
    db:       AsyncSession,
    page:     int = 1,
    per_page: int = 20,
    search:   Optional[str] = None,
    role:     Optional[str] = None,
) -> dict:
    q = select(User)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        q = q.where(or_(
            User.login_id.like(like),
            User.name.like(like),
            User.email.like(like),
        ))
    if role:
        q = q.where(User.role == role)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    pages = max(1, math.ceil(total / per_page))
    users = (await db.execute(
        q.order_by(desc(User.created_at)).offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {"users": users, "total": total, "page": page, "pages": pages, "per_page": per_page}


async def get_user(db: AsyncSession, user_no: int) -> User:
    user = (await db.execute(select(User).where(User.user_no == user_no))).scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")
    return user


async def update_user_role(
    db:           AsyncSession,
    user_no:      int,
    data:         RoleUpdateRequest,
    admin_no:     int,
    admin_id:     str,
    ip_address:   Optional[str] = None,
) -> User:
    if data.role not in ("user", "admin"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "role은 'user' 또는 'admin'이어야 합니다.")

    user = await get_user(db, user_no)
    old_role = user.role
    user.role = data.role
    await db.commit()
    await db.refresh(user)

    await write_log(
        db, action="USER_ROLE_CHANGE",
        user_no=admin_no, login_id=admin_id,
        target=f"user:{user_no}",
        detail=f"{old_role} → {data.role}",
        ip_address=ip_address,
    )
    return user


async def delete_user(
    db:         AsyncSession,
    user_no:    int,
    admin_no:   int,
    admin_id:   str,
    ip_address: Optional[str] = None,
) -> None:
    user = await get_user(db, user_no)
    if user.role == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "관리자 계정은 삭제할 수 없습니다.")

    await db.delete(user)
    await db.commit()

    await write_log(
        db, action="USER_DELETE",
        user_no=admin_no, login_id=admin_id,
        target=f"user:{user_no}",
        detail=f"login_id={user.login_id}",
        ip_address=ip_address,
    )



async def toggle_user_status(
    db:                 AsyncSession,
    user_no:            int,
    is_active:          bool,
    admin_no:           int,
    admin_id:           str,
    ip_address:         Optional[str] = None,
    suspension_reason:  Optional[str] = None,
) -> User:
    user = await get_user(db, user_no)
    if user.role == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "관리자 계정은 정지할 수 없습니다.")

    user.is_active = is_active
    if not is_active:
        user.suspension_reason = suspension_reason or None
    else:
        user.suspension_reason = None  # 활성화 시 사유 초기화
    await db.commit()
    await db.refresh(user)

    await write_log(
        db, action="USER_STATUS_CHANGE",
        user_no=admin_no, login_id=admin_id,
        target=f"user:{user_no}",
        detail=f"is_active={is_active}",
        ip_address=ip_address,
    )
    return user

# ════════════════════════════════════════════════════════════════════════════
# 로그 조회
# ════════════════════════════════════════════════════════════════════════════
async def get_logs(
    db:       AsyncSession,
    page:     int = 1,
    per_page: int = 30,
    action:   Optional[str] = None,
    login_id: Optional[str] = None,
) -> dict:
    q = select(ActivityLog)
    if action:
        q = q.where(ActivityLog.action == action)
    if login_id:
        q = q.where(ActivityLog.login_id == login_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    pages = max(1, math.ceil(total / per_page))
    logs  = (await db.execute(
        q.order_by(desc(ActivityLog.created_at)).offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {"logs": logs, "total": total, "page": page, "pages": pages, "per_page": per_page}


# ════════════════════════════════════════════════════════════════════════════
# 시스템 설정
# ════════════════════════════════════════════════════════════════════════════
async def _get_or_create_config(db: AsyncSession) -> SystemConfig:
    cfg = (await db.execute(select(SystemConfig))).scalars().first()
    if not cfg:
        cfg = SystemConfig()
        db.add(cfg)
        await db.flush()
    return cfg


async def get_system_config(db: AsyncSession) -> SystemConfig:
    cfg = await _get_or_create_config(db)
    await db.commit()
    return cfg


async def update_system_config(
    db:         AsyncSession,
    data:       SystemConfigUpdate,
    admin_no:   int,
    admin_id:   str,
    ip_address: Optional[str] = None,
) -> SystemConfig:
    cfg = await _get_or_create_config(db)

    if data.alert_enabled     is not None: cfg.alert_enabled     = data.alert_enabled
    if data.maintenance_mode  is not None: cfg.maintenance_mode  = data.maintenance_mode
    if data.max_stream_count  is not None: cfg.max_stream_count  = data.max_stream_count
    if data.its_auto_sync     is not None: cfg.its_auto_sync     = data.its_auto_sync
    if data.its_sync_interval is not None: cfg.its_sync_interval = data.its_sync_interval

    cfg.updated_by = admin_no
    await db.commit()
    await db.refresh(cfg)

    await write_log(
        db, action="SYSTEM_CONFIG_UPDATE",
        user_no=admin_no, login_id=admin_id,
        detail=str(data.model_dump(exclude_none=True)),
        ip_address=ip_address,
    )
    return cfg
