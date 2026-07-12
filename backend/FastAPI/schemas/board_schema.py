"""
schemas/board_schema.py
게시판 전체 Pydantic 요청/응답 스키마
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from models.board_orm import InquiryStatus


# ════════════════════════════════════════════════════════════════════════════
# 공지사항
# ════════════════════════════════════════════════════════════════════════════
class NoticeCreate(BaseModel):
    title:     str = Field(..., min_length=1, max_length=200)
    content:   str = Field(..., min_length=1)
    is_pinned: int = Field(default=0, ge=0, le=1)


class NoticeUpdate(BaseModel):
    title:     Optional[str] = Field(default=None, max_length=200)
    content:   Optional[str] = None
    is_pinned: Optional[int] = Field(default=None, ge=0, le=1)


class NoticeResponse(BaseModel):
    notice_no:  int
    title:      str
    content:    str
    is_pinned:  bool
    view_count: int
    author_no:  int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ════════════════════════════════════════════════════════════════════════════
# 1:1 문의
# ════════════════════════════════════════════════════════════════════════════
class InquiryCreate(BaseModel):
    title:      str = Field(..., min_length=1, max_length=200)
    content:    str = Field(..., min_length=1)
    is_private: int = Field(default=0, ge=0, le=1)


class InquiryUpdate(BaseModel):
    title:      str = Field(..., min_length=1, max_length=200)
    content:    str = Field(..., min_length=1)
    is_private: int = Field(default=0, ge=0, le=1)


class InquiryAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, description="관리자 답변 내용")


class AttachmentResponse(BaseModel):
    attachment_no: int
    original_name: str
    file_size:     int
    download_url:  str
    created_at:    datetime

    model_config = {"from_attributes": True}


class InquiryResponse(BaseModel):
    inquiry_no:  int
    user_no:     int
    title:       str
    content:     str
    answer:      Optional[str]
    answered_by: Optional[int]
    answered_at: Optional[datetime]
    status:      InquiryStatus
    is_private:  int = 0
    created_at:  datetime
    updated_at:  datetime
    attachments: list[AttachmentResponse] = []

    model_config = {"from_attributes": True}


# ════════════════════════════════════════════════════════════════════════════
# FAQ
# ════════════════════════════════════════════════════════════════════════════
class FAQCreate(BaseModel):
    question:   str = Field(..., min_length=1, max_length=500)
    answer:     str = Field(..., min_length=1)
    sort_order: int = Field(default=0, ge=0)


class FAQUpdate(BaseModel):
    question:   Optional[str] = Field(default=None, max_length=500)
    answer:     Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0)


class FAQResponse(BaseModel):
    faq_no:     int
    question:   str
    answer:     str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ════════════════════════════════════════════════════════════════════════════
# 자료실
# ════════════════════════════════════════════════════════════════════════════
class ArchiveCreate(BaseModel):
    title:   str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class ArchiveUpdate(BaseModel):
    title:   Optional[str] = Field(default=None, max_length=200)
    content: Optional[str] = None


class ArchiveResponse(BaseModel):
    archive_no:  int
    title:       str
    content:     str
    view_count:  int
    author_no:   int
    created_at:  datetime
    updated_at:  datetime
    attachments: list[AttachmentResponse] = []

    model_config = {"from_attributes": True}


# ════════════════════════════════════════════════════════════════════════════
# 공통 페이지네이션
# ════════════════════════════════════════════════════════════════════════════
class PaginatedResponse(BaseModel):
    items:    list
    total:    int
    page:     int
    pages:    int
    per_page: int


# ════════════════════════════════════════════════════════════════════════════
# 버그 게시판
# ════════════════════════════════════════════════════════════════════════════
class BugPostCreate(BaseModel):
    title:   str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)


class BugPostUpdate(BaseModel):
    title:   Optional[str] = Field(default=None, max_length=200)
    content: Optional[str] = None


class BugStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(OPEN|FIXED)$")


class BugCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
