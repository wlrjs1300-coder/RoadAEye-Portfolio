"""
services/settings_service.py
사용자 설정 CRUD 서비스
"""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.orm import UserSetting
from schemas.settings_schema import (
    EmailSettingsRequest,
    PushNotificationSettings,
    NotificationInfoSettings,
    OtherSettings,
)


async def _get_or_create(db: AsyncSession, user_no: int) -> UserSetting:
    result = await db.execute(select(UserSetting).where(UserSetting.user_no == user_no))
    setting = result.scalars().first()
    if not setting:
        setting = UserSetting(user_no=user_no)
        db.add(setting)
        await db.flush()
    return setting


# ════════════════════════════════════════════════════════════════════════════
# 전체 설정 조회
# ════════════════════════════════════════════════════════════════════════════
async def get_all_settings(db: AsyncSession, user_no: int) -> dict:
    s = await _get_or_create(db, user_no)
    await db.commit()
    return _to_dict(s)


# ════════════════════════════════════════════════════════════════════════════
# 이메일 설정 (마케팅 수신 동의)
# ════════════════════════════════════════════════════════════════════════════
async def get_email_settings(db: AsyncSession, user_no: int) -> dict:
    from sqlalchemy import select as _select
    from models.orm import User
    s = await _get_or_create(db, user_no)
    user_result = await db.execute(_select(User).where(User.user_no == user_no))
    user = user_result.scalars().first()
    await db.commit()
    return {
        "email":             user.email if user else None,
        "receive_marketing": s.receive_marketing,
    }


async def update_email_settings(db: AsyncSession, user_no: int, data: EmailSettingsRequest) -> dict:
    from sqlalchemy import select as _select
    from models.orm import User
    s = await _get_or_create(db, user_no)
    s.receive_marketing = data.receive_marketing
    user_result = await db.execute(_select(User).where(User.user_no == user_no))
    user = user_result.scalars().first()
    if user:
        user.email = str(data.email)
    await db.commit()
    return {
        "email":             str(data.email),
        "receive_marketing": s.receive_marketing,
    }


# ════════════════════════════════════════════════════════════════════════════
# 푸시 알림 설정
# ════════════════════════════════════════════════════════════════════════════
async def get_push_settings(db: AsyncSession, user_no: int) -> dict:
    s = await _get_or_create(db, user_no)
    await db.commit()
    return {
        "push_enabled":   s.push_enabled,
        "push_sound":     s.push_sound,
        "push_vibration": s.push_vibration,
    }


async def update_push_settings(db: AsyncSession, user_no: int, data: PushNotificationSettings) -> dict:
    s = await _get_or_create(db, user_no)
    s.push_enabled   = data.push_enabled
    s.push_sound     = data.push_sound
    s.push_vibration = data.push_vibration
    await db.commit()
    return {
        "push_enabled":   s.push_enabled,
        "push_sound":     s.push_sound,
        "push_vibration": s.push_vibration,
    }


# ════════════════════════════════════════════════════════════════════════════
# 알림 정보 설정
# ════════════════════════════════════════════════════════════════════════════
async def get_notification_info(db: AsyncSession, user_no: int) -> dict:
    s = await _get_or_create(db, user_no)
    await db.commit()
    return {
        "notify_email":    s.notify_email,
        "notify_sms":      s.notify_sms,
        "notify_cctv_ids": json.loads(s.notify_cctv_ids) if s.notify_cctv_ids else None,
    }


async def update_notification_info(db: AsyncSession, user_no: int, data: NotificationInfoSettings) -> dict:
    s = await _get_or_create(db, user_no)
    s.notify_email    = data.notify_email
    s.notify_sms      = data.notify_sms
    s.notify_cctv_ids = json.dumps(data.notify_cctv_ids) if data.notify_cctv_ids is not None else None
    await db.commit()
    return {
        "notify_email":    s.notify_email,
        "notify_sms":      s.notify_sms,
        "notify_cctv_ids": data.notify_cctv_ids,
    }


# ════════════════════════════════════════════════════════════════════════════
# 그 외 설정
# ════════════════════════════════════════════════════════════════════════════
async def get_other_settings(db: AsyncSession, user_no: int) -> dict:
    s = await _get_or_create(db, user_no)
    await db.commit()
    return {
        "theme":    s.theme,
        "language": s.language,
    }


async def update_other_settings(db: AsyncSession, user_no: int, data: OtherSettings) -> dict:
    s = await _get_or_create(db, user_no)
    s.theme    = data.theme
    s.language = data.language
    await db.commit()
    return {
        "theme":    s.theme,
        "language": s.language,
    }


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────
def _to_dict(s: UserSetting) -> dict:
    return {
        "push": {
            "push_enabled":   s.push_enabled,
            "push_sound":     s.push_sound,
            "push_vibration": s.push_vibration,
        },
        "info": {
            "notify_email":    s.notify_email,
            "notify_sms":      s.notify_sms,
            "notify_cctv_ids": json.loads(s.notify_cctv_ids) if s.notify_cctv_ids else None,
        },
        "other": {
            "theme":    s.theme,
            "language": s.language,
        },
    }
