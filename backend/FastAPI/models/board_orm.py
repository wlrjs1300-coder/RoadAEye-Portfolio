"""
models/board_orm.py
게시판 관련 SQLAlchemy ORM 모델

- Notice            공지사항
- Inquiry           1:1 문의
- InquiryAttachment 1:1 문의 첨부파일
- FAQ               자주 묻는 질문
- Archive           자료실
- ArchiveAttachment 자료실 첨부파일
- BugAttachment     버그 게시판 첨부파일
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger, String, Text, SmallInteger,
    Integer, DateTime, Enum, ForeignKey, func,  # ForeignKey: inquiry/archive 내부 FK에 사용
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


# ════════════════════════════════════════════════════════════════════════════
# 공지사항
# ════════════════════════════════════════════════════════════════════════════
class Notice(Base):
    __tablename__ = "notices"

    notice_no:  Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title:      Mapped[str]      = mapped_column(String(200), nullable=False)
    content:    Mapped[str]      = mapped_column(Text,        nullable=False)
    is_pinned:  Mapped[int]      = mapped_column(SmallInteger, nullable=False, default=0)
    view_count: Mapped[int]      = mapped_column(Integer,     nullable=False, default=0)
    author_no:  Mapped[int]      = mapped_column(BigInteger, nullable=False)  # logical FK → member_db.users
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False,
                                                  default=func.now(), onupdate=func.now())


# ════════════════════════════════════════════════════════════════════════════
# 1:1 문의
# ════════════════════════════════════════════════════════════════════════════
class InquiryStatus(str, enum.Enum):
    PENDING  = "PENDING"
    ANSWERED = "ANSWERED"


class Inquiry(Base):
    __tablename__ = "inquiries"

    inquiry_no:  Mapped[int]                = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:     Mapped[int]                = mapped_column(BigInteger, nullable=False)  # logical FK → member_db.users
    title:       Mapped[str]                = mapped_column(String(200), nullable=False)
    content:     Mapped[str]                = mapped_column(Text, nullable=False)
    answer:      Mapped[str | None]         = mapped_column(Text, nullable=True)
    answered_by: Mapped[int | None]         = mapped_column(BigInteger, nullable=True)  # logical FK → member_db.users
    answered_at: Mapped[datetime | None]    = mapped_column(DateTime, nullable=True)
    status:      Mapped[InquiryStatus]      = mapped_column(
                                                 Enum(InquiryStatus),
                                                 nullable=False,
                                                 default=InquiryStatus.PENDING,
                                             )
    is_private:  Mapped[int]               = mapped_column(SmallInteger, nullable=False, default=0)
    created_at:  Mapped[datetime]           = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at:  Mapped[datetime]           = mapped_column(DateTime, nullable=False,
                                                             default=func.now(), onupdate=func.now())

    attachments: Mapped[list["InquiryAttachment"]] = relationship(
        "InquiryAttachment", back_populates="inquiry", cascade="all, delete-orphan"
    )


class InquiryAttachment(Base):
    __tablename__ = "inquiry_attachments"

    attachment_no: Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    inquiry_no:    Mapped[int]      = mapped_column(ForeignKey("inquiries.inquiry_no", ondelete="CASCADE"), nullable=False)
    original_name: Mapped[str]      = mapped_column(String(255), nullable=False)
    stored_path:   Mapped[str]      = mapped_column(String(500), nullable=False)
    file_size:     Mapped[int]      = mapped_column(BigInteger,  nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    inquiry: Mapped["Inquiry"] = relationship("Inquiry", back_populates="attachments")


# ════════════════════════════════════════════════════════════════════════════
# FAQ
# ════════════════════════════════════════════════════════════════════════════
class FAQ(Base):
    __tablename__ = "faqs"

    faq_no:     Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    question:   Mapped[str]      = mapped_column(String(500), nullable=False)
    answer:     Mapped[str]      = mapped_column(Text,        nullable=False)
    sort_order: Mapped[int]      = mapped_column(Integer,     nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False,
                                                  default=func.now(), onupdate=func.now())


# ════════════════════════════════════════════════════════════════════════════
# 자료실
# ════════════════════════════════════════════════════════════════════════════
class Archive(Base):
    __tablename__ = "archives"

    archive_no: Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title:      Mapped[str]      = mapped_column(String(200), nullable=False)
    content:    Mapped[str]      = mapped_column(Text,        nullable=False)
    view_count: Mapped[int]      = mapped_column(Integer,     nullable=False, default=0)
    author_no:  Mapped[int]      = mapped_column(BigInteger, nullable=False)  # logical FK → member_db.users
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False,
                                                  default=func.now(), onupdate=func.now())

    attachments: Mapped[list["ArchiveAttachment"]] = relationship(
        "ArchiveAttachment", back_populates="archive", cascade="all, delete-orphan"
    )


class ArchiveAttachment(Base):
    __tablename__ = "archive_attachments"

    attachment_no: Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    archive_no:    Mapped[int]      = mapped_column(ForeignKey("archives.archive_no", ondelete="CASCADE"), nullable=False)
    original_name: Mapped[str]      = mapped_column(String(255), nullable=False)
    stored_path:   Mapped[str]      = mapped_column(String(500), nullable=False)
    file_size:     Mapped[int]      = mapped_column(BigInteger,  nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    archive: Mapped["Archive"] = relationship("Archive", back_populates="attachments")


# ════════════════════════════════════════════════════════════════════════════
# 버그 게시판
# ════════════════════════════════════════════════════════════════════════════
class BugStatus(str, enum.Enum):
    OPEN  = "OPEN"
    FIXED = "FIXED"


class BugPost(Base):
    __tablename__ = "bug_posts"

    bug_no:     Mapped[int]       = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_no:    Mapped[int]       = mapped_column(BigInteger, nullable=False)
    title:      Mapped[str]       = mapped_column(String(200), nullable=False)
    content:    Mapped[str]       = mapped_column(Text, nullable=False)
    status:     Mapped[BugStatus] = mapped_column(
                                        Enum(BugStatus), nullable=False, default=BugStatus.OPEN
                                    )
    created_at: Mapped[datetime]  = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime]  = mapped_column(DateTime, nullable=False,
                                                    default=func.now(), onupdate=func.now())

    comments: Mapped[list["BugComment"]] = relationship(
        "BugComment", back_populates="bug_post", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["BugAttachment"]] = relationship(
        "BugAttachment", back_populates="bug_post", cascade="all, delete-orphan"
    )


class BugAttachment(Base):
    __tablename__ = "bug_attachments"

    attachment_no: Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    bug_no:        Mapped[int]      = mapped_column(ForeignKey("bug_posts.bug_no", ondelete="CASCADE"), nullable=False)
    original_name: Mapped[str]      = mapped_column(String(255), nullable=False)
    stored_path:   Mapped[str]      = mapped_column(String(500), nullable=False)
    file_size:     Mapped[int]      = mapped_column(BigInteger, nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    bug_post: Mapped["BugPost"] = relationship("BugPost", back_populates="attachments")


class BugComment(Base):
    __tablename__ = "bug_comments"

    comment_no: Mapped[int]      = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    bug_no:     Mapped[int]      = mapped_column(
                                        ForeignKey("bug_posts.bug_no", ondelete="CASCADE"),
                                        nullable=False
                                    )
    user_no:    Mapped[int]      = mapped_column(BigInteger, nullable=False)
    content:    Mapped[str]      = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    bug_post: Mapped["BugPost"] = relationship("BugPost", back_populates="comments")
