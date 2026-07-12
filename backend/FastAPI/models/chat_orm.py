"""
models/chat_orm.py
챗봇 대화 세션 / 메시지 SQLAlchemy ORM 모델
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Enum, ForeignKey, Text, func,  # ForeignKey: chat_messages → chat_sessions에 사용
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class MessageRole(str, enum.Enum):
    USER      = "user"
    ASSISTANT = "assistant"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_no:      Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:         Mapped[int]           = mapped_column(BigInteger, nullable=False)  # logical FK → member_db.users
    last_message_at: Mapped[datetime|None] = mapped_column(DateTime, nullable=True)
    created_at:      Mapped[datetime]      = mapped_column(DateTime, nullable=False, default=func.now())

    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_no: Mapped[int]         = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_no: Mapped[int]         = mapped_column(
                                          ForeignKey("chat_sessions.session_no", ondelete="CASCADE"),
                                          nullable=False,
                                      )
    role:       Mapped[MessageRole] = mapped_column(Enum(MessageRole, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    content:    Mapped[str]         = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime]    = mapped_column(DateTime, nullable=False, default=func.now())

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")
