"""
models/orm.py
전체 SQLAlchemy ORM 모델
- User / EmailVerification
- CCTV / ForbiddenClass / Detection
"""

import enum
from datetime import datetime, date, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger, Boolean, String, SmallInteger, Numeric,
    DateTime, Date, Enum, ForeignKey, func, Text, CHAR,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


# ════════════════════════════════════════════════════════════════════════════
# 회원
# ════════════════════════════════════════════════════════════════════════════
class User(Base):
    __tablename__ = "users"

    user_no:         Mapped[int]          = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    login_id:        Mapped[str]          = mapped_column(String(50),  nullable=False, unique=True)
    password:        Mapped[str | None]   = mapped_column(String(255), nullable=True)   # 소셜 로그인은 None
    email:           Mapped[str | None]   = mapped_column(String(255), nullable=True,  unique=True)
    name:            Mapped[str]          = mapped_column(String(50),  nullable=False)
    birth_date:      Mapped[date | None]  = mapped_column(Date,        nullable=True)
    phone:           Mapped[str | None]   = mapped_column(String(20),  nullable=True)
    address:         Mapped[str | None]   = mapped_column(String(255), nullable=True)
    address_detail:  Mapped[str | None]   = mapped_column(String(255), nullable=True)
    role:               Mapped[str]          = mapped_column(String(10),  nullable=False, default="user")  # 'user', 'admin'
    is_active:          Mapped[bool]         = mapped_column(Boolean,     nullable=False, default=True)    # 1=활성 0=정지
    suspension_reason:  Mapped[str | None]   = mapped_column(String(500), nullable=True)   # 정지 사유
    social_provider:    Mapped[str | None]   = mapped_column(String(20),  nullable=True)   # 'naver', 'kakao', 'google'
    social_id:       Mapped[str | None]   = mapped_column(String(100), nullable=True)
    created_at:      Mapped[datetime]     = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at:      Mapped[datetime]     = mapped_column(DateTime, nullable=False,
                                                           default=func.now(), onupdate=func.now())


class UserSetting(Base):
    __tablename__ = "user_settings"

    setting_no:    Mapped[int]          = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:       Mapped[int]          = mapped_column(BigInteger, ForeignKey("users.user_no"), unique=True, nullable=False)

    # 푸시 알림 설정
    push_enabled:   Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)
    push_sound:     Mapped[bool]        = mapped_column(Boolean, nullable=False, default=True)
    push_vibration: Mapped[bool]        = mapped_column(Boolean, nullable=False, default=False)

    # 알림 정보 설정
    notify_email:    Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    notify_sms:      Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    notify_cctv_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: null=전체, "[1,2,3]"=특정

    # 이메일 설정
    receive_marketing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 그 외 설정
    theme:    Mapped[str] = mapped_column(String(20), nullable=False, default="light")  # light | dark
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="ko")

    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False,
                                                  default=func.now(), onupdate=func.now())


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id:          Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email:       Mapped[str]           = mapped_column(String(255), nullable=False)
    code:        Mapped[str]           = mapped_column(String(6),   nullable=False)
    expires_at:  Mapped[datetime]      = mapped_column(DateTime,    nullable=False)
    verified_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:  Mapped[datetime]      = mapped_column(DateTime, nullable=False, default=func.now())

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return now > self.expires_at

    @property
    def is_verified(self) -> bool:
        return self.verified_at is not None


# ════════════════════════════════════════════════════════════════════════════
# CCTV
# ════════════════════════════════════════════════════════════════════════════
class CCTV(Base):
    __tablename__ = "cctvs"

    cctv_no:     Mapped[int]            = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    its_cctv_id: Mapped[str | None]     = mapped_column(String(100), nullable=True)
    name:        Mapped[str]            = mapped_column(String(100), nullable=False)
    alias:       Mapped[str | None]     = mapped_column(String(100), nullable=True)
    stream_url:  Mapped[str]            = mapped_column(String(500), nullable=False)
    latitude:    Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude:   Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    is_active:   Mapped[int]            = mapped_column(SmallInteger, nullable=False, default=1)
    created_at:  Mapped[datetime]       = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at:  Mapped[datetime]       = mapped_column(DateTime, nullable=False,
                                                         default=func.now(), onupdate=func.now())

    detections: Mapped[list["Detection"]] = relationship("Detection", back_populates="cctv")


# ════════════════════════════════════════════════════════════════════════════
# 금지 클래스
# ════════════════════════════════════════════════════════════════════════════
class ForbiddenClass(Base):
    __tablename__ = "forbidden_classes"

    class_no:     Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    class_name:   Mapped[str]      = mapped_column(String(50), nullable=False, unique=True)
    display_name: Mapped[str]      = mapped_column(String(50), nullable=False)
    is_active:    Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=1)
    created_at:   Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    detections: Mapped[list["Detection"]] = relationship("Detection", back_populates="forbidden_class")


# ════════════════════════════════════════════════════════════════════════════
# 감지 기록
# ════════════════════════════════════════════════════════════════════════════
class DetectionStatus(str, enum.Enum):
    UNREAD    = "UNREAD"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"


class Detection(Base):
    __tablename__ = "detections"

    detection_no: Mapped[int]             = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cctv_no:      Mapped[int]             = mapped_column(ForeignKey("cctvs.cctv_no"),              nullable=False)
    class_no:     Mapped[int]             = mapped_column(ForeignKey("forbidden_classes.class_no"), nullable=False)
    confidence:   Mapped[Decimal]         = mapped_column(Numeric(5, 4), nullable=False)
    image_path:   Mapped[str]             = mapped_column(String(500),   nullable=False)
    detected_at:  Mapped[datetime]        = mapped_column(DateTime,      nullable=False)
    status:       Mapped[DetectionStatus] = mapped_column(
                                               Enum(DetectionStatus),
                                               nullable=False,
                                               default=DetectionStatus.UNREAD,
                                           )
    handled_by:  Mapped[int | None]      = mapped_column(BigInteger, nullable=True)  # logical FK → member_db.users
    handled_at:  Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:  Mapped[datetime]        = mapped_column(DateTime, nullable=False, default=func.now())

    cctv:            Mapped["CCTV"]          = relationship("CCTV", back_populates="detections")
    forbidden_class: Mapped["ForbiddenClass"] = relationship("ForbiddenClass", back_populates="detections")


# ════════════════════════════════════════════════════════════════════
# Refresh Token
# ════════════════════════════════════════════════════════════════════
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id:         Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:    Mapped[int]      = mapped_column(BigInteger, nullable=False, index=True)
    token:      Mapped[str]      = mapped_column(String(512), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked:    Mapped[bool]     = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    @property
    def is_valid(self) -> bool:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return not self.revoked and now < self.expires_at
