"""
models/admin_orm.py
관리자 기능 ORM 모델
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    log_no:     Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:    Mapped[int | None]    = mapped_column(BigInteger, nullable=True)
    login_id:   Mapped[str | None]    = mapped_column(String(50), nullable=True)
    action:     Mapped[str]           = mapped_column(String(50), nullable=False)   # LOGIN, LOGOUT, USER_ROLE_CHANGE ...
    target:     Mapped[str | None]    = mapped_column(String(100), nullable=True)   # "user:5", "cctv:sync" 등
    detail:     Mapped[str | None]    = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None]    = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime]      = mapped_column(DateTime, nullable=False, default=func.now())


class SystemConfig(Base):
    __tablename__ = "system_configs"

    config_no:          Mapped[int]       = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_enabled:      Mapped[bool]      = mapped_column(Boolean, nullable=False, default=True)
    maintenance_mode:   Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)
    max_stream_count:   Mapped[int]       = mapped_column(Integer, nullable=False, default=10)
    its_auto_sync:      Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)
    its_sync_interval:  Mapped[int]       = mapped_column(Integer, nullable=False, default=60)   # 분 단위
    updated_by:         Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_at:         Mapped[datetime]  = mapped_column(DateTime, nullable=False,
                                                           default=func.now(), onupdate=func.now())
