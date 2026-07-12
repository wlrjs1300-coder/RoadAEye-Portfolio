"""
schemas/chat_schema.py
챗봇 요청/응답 Pydantic 스키마
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models.chat_orm import MessageRole


# ── 메시지 ────────────────────────────────────────────────────────────────────
class MessageResponse(BaseModel):
    message_no: int
    session_no: int
    role:       MessageRole
    content:    str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── 세션 ──────────────────────────────────────────────────────────────────────
class SessionResponse(BaseModel):
    session_no:      int
    user_no:         int
    last_message_at: Optional[datetime]
    created_at:      datetime
    messages:        list[MessageResponse] = []

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    """목록용 — 메시지 미포함"""
    session_no:      int
    user_no:         int
    last_message_at: Optional[datetime]
    created_at:      datetime
    preview:         Optional[str] = None  # 마지막 메시지 미리보기

    model_config = {"from_attributes": True}


# ── 채팅 요청/응답 ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:    str            = Field(..., min_length=1, description="사용자 입력 메시지")
    session_no: Optional[int] = Field(default=None, description="이어서 대화할 세션 번호 (없으면 새 세션)")


class ChatResponse(BaseModel):
    session_no: int
    answer:     str
    created_at: datetime
