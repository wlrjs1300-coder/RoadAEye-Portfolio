"""
schemas/settings_schema.py
사용자 설정 Pydantic 스키마
"""

from typing import List, Optional
from pydantic import BaseModel, EmailStr


class EmailSettingsRequest(BaseModel):
    email:              EmailStr
    receive_marketing:  bool = False


class EmailSettingsResponse(BaseModel):
    email:              Optional[str]
    receive_marketing:  bool


class PushNotificationSettings(BaseModel):
    push_enabled:   bool = True
    push_sound:     bool = True
    push_vibration: bool = False


class NotificationInfoSettings(BaseModel):
    notify_email:    bool              = False
    notify_sms:      bool              = False
    notify_cctv_ids: Optional[List[int]] = None  # None = 전체 CCTV


class OtherSettings(BaseModel):
    theme:    str = "light"   # "light" | "dark"
    language: str = "ko"


class AllSettings(BaseModel):
    push:  PushNotificationSettings
    info:  NotificationInfoSettings
    other: OtherSettings
