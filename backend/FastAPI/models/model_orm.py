"""
models/model_orm.py
AI 모델 버전 관리 SQLAlchemy ORM 모델
"""

from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    BigInteger, String, Date, DateTime,
    Numeric, Text, SmallInteger, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    version_no:      Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    model_name:      Mapped[str]           = mapped_column(String(100), nullable=False)
    version:         Mapped[str]           = mapped_column(String(50),  nullable=False)
    trained_at:      Mapped[date]          = mapped_column(Date,        nullable=False)
    precision_score: Mapped[Decimal|None]  = mapped_column(Numeric(5, 4), nullable=True)
    recall_score:    Mapped[Decimal|None]  = mapped_column(Numeric(5, 4), nullable=True)
    map_score:       Mapped[Decimal|None]  = mapped_column(Numeric(5, 4), nullable=True)
    model_path:      Mapped[str]           = mapped_column(String(500), nullable=False)
    notes:           Mapped[str|None]      = mapped_column(Text,        nullable=True)
    is_active:       Mapped[int]           = mapped_column(SmallInteger, nullable=False, default=0)
    created_at:      Mapped[datetime]      = mapped_column(DateTime, nullable=False, default=func.now())
