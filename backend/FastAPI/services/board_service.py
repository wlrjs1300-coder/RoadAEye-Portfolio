"""
services/board_service.py
게시판 전체 비즈니스 로직 (비동기)

- 공지사항 CRUD
- 1:1 문의 CRUD + 첨부파일 업로드/다운로드 + 관리자 답변
- FAQ CRUD
- 자료실 CRUD + 첨부파일 업로드/다운로드
- 버그 게시판 CRUD + 첨부파일 업로드/다운로드
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from models.board_orm import (
    Notice, Inquiry, InquiryAttachment, InquiryStatus,
    FAQ, Archive, ArchiveAttachment,
    BugAttachment,
)
from schemas.board_schema import (
    NoticeCreate, NoticeUpdate,
    InquiryCreate, InquiryUpdate, InquiryAnswerRequest,
    FAQCreate, FAQUpdate,
    ArchiveCreate, ArchiveUpdate,
)

# 허용 확장자
_ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".txt", ".zip", ".png",
    ".jpg", ".jpeg", ".gif",
    ".mp4", ".wav",
}
_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB (기본)

# 확장자별 최대 크기 (미지정 확장자는 _MAX_FILE_SIZE 적용)
_MAX_FILE_SIZE_BY_EXT = {
    ".mp4": 150 * 1024 * 1024,  # 150MB
    ".wav": 150 * 1024 * 1024,  # 150MB
}


# ════════════════════════════════════════════════════════════════════════════
# 공지사항
# ════════════════════════════════════════════════════════════════════════════
async def get_notices(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    keyword: Optional[str] = None,
) -> dict:
    stmt = select(Notice)
    if keyword:
        stmt = stmt.where(Notice.title.contains(keyword))

    # 고정 공지 먼저, 그 다음 최신순
    stmt = stmt.order_by(Notice.is_pinned.desc(), Notice.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar()

    rows = (await db.execute(
        stmt.offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {
        "items":    [_notice_dict(n) for n in rows],
        "total":    total,
        "page":     page,
        "pages":    -(-total // per_page),
        "per_page": per_page,
    }


async def get_notice(db: AsyncSession, notice_no: int, increment_view: bool = False) -> Notice:
    result = await db.execute(select(Notice).where(Notice.notice_no == notice_no))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "공지사항을 찾을 수 없습니다.")
    if increment_view:
        notice.view_count += 1
        await db.commit()
        await db.refresh(notice)
    return notice


async def create_notice(db: AsyncSession, data: NoticeCreate, author_no: int) -> Notice:
    notice = Notice(
        title     = data.title,
        content   = data.content,
        is_pinned = data.is_pinned,
        author_no = author_no,
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    return notice


async def update_notice(db: AsyncSession, notice_no: int, data: NoticeUpdate) -> Notice:
    notice = await get_notice(db, notice_no)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(notice, field, value)
    await db.commit()
    await db.refresh(notice)
    return notice


async def delete_notice(db: AsyncSession, notice_no: int) -> None:
    notice = await get_notice(db, notice_no)
    await db.delete(notice)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 1:1 문의
# ════════════════════════════════════════════════════════════════════════════
async def get_inquiries(
    db: AsyncSession,
    user_no: Optional[int] = None,   # None이면 전체(관리자용)
    page: int = 1,
    per_page: int = 20,
    include_public: bool = False,    # True: 본인 글 + 타인의 공개글
) -> dict:
    stmt = select(Inquiry).options(selectinload(Inquiry.attachments))
    if user_no:
        if include_public:
            # 본인 글(공개+비공개) OR 타인의 공개글
            stmt = stmt.where(
                or_(
                    Inquiry.user_no == user_no,
                    Inquiry.is_private == 0,
                )
            )
        else:
            stmt = stmt.where(Inquiry.user_no == user_no)
    stmt = stmt.order_by(Inquiry.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar()

    rows = (await db.execute(
        stmt.offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {
        "items":    [_inquiry_dict(i) for i in rows],
        "total":    total,
        "page":     page,
        "pages":    -(-total // per_page),
        "per_page": per_page,
    }


async def get_inquiry(db: AsyncSession, inquiry_no: int) -> Inquiry:
    result = await db.execute(
        select(Inquiry)
        .options(selectinload(Inquiry.attachments))
        .where(Inquiry.inquiry_no == inquiry_no)
    )
    inquiry = result.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "문의를 찾을 수 없습니다.")
    return inquiry


async def create_inquiry(
    db: AsyncSession,
    data: InquiryCreate,
    user_no: int,
    files: list[UploadFile] | None = None,
) -> Inquiry:
    inquiry = Inquiry(
        user_no    = user_no,
        title      = data.title,
        content    = data.content,
        status     = InquiryStatus.PENDING,
        is_private = data.is_private,
    )
    db.add(inquiry)
    await db.flush()  # inquiry_no 확보

    # 첨부파일 저장
    if files:
        save_dir = os.path.join(settings.IMAGE_SAVE_DIR, "inquiries", str(inquiry.inquiry_no))
        os.makedirs(save_dir, exist_ok=True)
        for file in files:
            attachment = await _save_file(file, save_dir)
            db.add(InquiryAttachment(
                inquiry_no    = inquiry.inquiry_no,
                original_name = attachment["original_name"],
                stored_path   = attachment["stored_path"],
                file_size     = attachment["file_size"],
            ))

    await db.commit()
    return await get_inquiry(db, inquiry.inquiry_no)


async def answer_inquiry(
    db: AsyncSession,
    inquiry_no: int,
    data: InquiryAnswerRequest,
    handler_no: int = 0,
) -> Inquiry:
    inquiry = await get_inquiry(db, inquiry_no)
    if inquiry.status == InquiryStatus.ANSWERED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 답변이 완료된 문의입니다.")

    inquiry.answer      = data.answer
    inquiry.answered_by = handler_no
    inquiry.answered_at = datetime.now(timezone.utc).replace(tzinfo=None)
    inquiry.status      = InquiryStatus.ANSWERED
    await db.commit()
    return await get_inquiry(db, inquiry.inquiry_no)


async def update_answer(
    db: AsyncSession,
    inquiry_no: int,
    data: InquiryAnswerRequest,
    handler_no: int = 0,
) -> Inquiry:
    inquiry = await get_inquiry(db, inquiry_no)
    if inquiry.status != InquiryStatus.ANSWERED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "아직 답변이 등록되지 않은 문의입니다.")
    inquiry.answer      = data.answer
    inquiry.answered_by = handler_no
    inquiry.answered_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return await get_inquiry(db, inquiry.inquiry_no)


async def delete_answer(db: AsyncSession, inquiry_no: int) -> Inquiry:
    inquiry = await get_inquiry(db, inquiry_no)
    if inquiry.status != InquiryStatus.ANSWERED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "삭제할 답변이 없습니다.")
    inquiry.answer      = None
    inquiry.answered_by = None
    inquiry.answered_at = None
    inquiry.status      = InquiryStatus.PENDING
    await db.commit()
    return await get_inquiry(db, inquiry.inquiry_no)


async def update_inquiry(
    db: AsyncSession,
    inquiry_no: int,
    user_no: int,
    data: InquiryUpdate,
) -> "Inquiry":
    inquiry = await get_inquiry(db, inquiry_no)
    if inquiry.user_no != user_no:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인이 작성한 문의만 수정할 수 있습니다.")
    inquiry.title      = data.title
    inquiry.content    = data.content
    inquiry.is_private = data.is_private
    await db.commit()
    return await get_inquiry(db, inquiry_no)


async def delete_inquiry(db: AsyncSession, inquiry_no: int) -> None:
    inquiry = await get_inquiry(db, inquiry_no)
    await db.delete(inquiry)
    await db.commit()


async def get_inquiry_attachment(
    db: AsyncSession, attachment_no: int
) -> InquiryAttachment:
    result = await db.execute(
        select(InquiryAttachment).where(InquiryAttachment.attachment_no == attachment_no)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "첨부파일을 찾을 수 없습니다.")
    return att


# ════════════════════════════════════════════════════════════════════════════
# FAQ
# ════════════════════════════════════════════════════════════════════════════
async def get_faqs(db: AsyncSession, keyword: Optional[str] = None) -> list[FAQ]:
    stmt = select(FAQ)
    if keyword:
        stmt = stmt.where(FAQ.question.contains(keyword))
    stmt = stmt.order_by(FAQ.sort_order.asc(), FAQ.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_faq(db: AsyncSession, faq_no: int) -> FAQ:
    result = await db.execute(select(FAQ).where(FAQ.faq_no == faq_no))
    faq = result.scalar_one_or_none()
    if not faq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ를 찾을 수 없습니다.")
    return faq


async def create_faq(db: AsyncSession, data: FAQCreate) -> FAQ:
    faq = FAQ(**data.model_dump())
    db.add(faq)
    await db.commit()
    await db.refresh(faq)
    return faq


async def update_faq(db: AsyncSession, faq_no: int, data: FAQUpdate) -> FAQ:
    faq = await get_faq(db, faq_no)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(faq, field, value)
    await db.commit()
    await db.refresh(faq)
    return faq


async def delete_faq(db: AsyncSession, faq_no: int) -> None:
    faq = await get_faq(db, faq_no)
    await db.delete(faq)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 자료실
# ════════════════════════════════════════════════════════════════════════════
async def get_archives(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    keyword: Optional[str] = None,
) -> dict:
    stmt = select(Archive).options(selectinload(Archive.attachments))
    if keyword:
        stmt = stmt.where(Archive.title.contains(keyword))
    stmt = stmt.order_by(Archive.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar()

    rows = (await db.execute(
        stmt.offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {
        "items":    [_archive_dict(a) for a in rows],
        "total":    total,
        "page":     page,
        "pages":    -(-total // per_page),
        "per_page": per_page,
    }


async def get_archive(
    db: AsyncSession, archive_no: int, increment_view: bool = False
) -> Archive:
    result = await db.execute(
        select(Archive)
        .options(selectinload(Archive.attachments))
        .where(Archive.archive_no == archive_no)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "자료를 찾을 수 없습니다.")
    if increment_view:
        archive.view_count += 1
        await db.commit()
        await db.refresh(archive)
    return archive


async def create_archive(
    db: AsyncSession,
    data: ArchiveCreate,
    author_no: int,
    files: list[UploadFile] | None = None,
) -> Archive:
    archive = Archive(
        title     = data.title,
        content   = data.content,
        author_no = author_no,
    )
    db.add(archive)
    await db.flush()  # archive_no 확보

    if files:
        save_dir = os.path.join(settings.IMAGE_SAVE_DIR, "archives", str(archive.archive_no))
        os.makedirs(save_dir, exist_ok=True)
        for file in files:
            attachment = await _save_file(file, save_dir)
            db.add(ArchiveAttachment(
                archive_no    = archive.archive_no,
                original_name = attachment["original_name"],
                stored_path   = attachment["stored_path"],
                file_size     = attachment["file_size"],
            ))

    await db.commit()
    return await get_archive(db, archive.archive_no)


async def update_archive(
    db: AsyncSession,
    archive_no: int,
    data: ArchiveUpdate,
    files: list[UploadFile] | None = None,
) -> Archive:
    archive = await get_archive(db, archive_no)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(archive, field, value)

    # 추가 첨부파일 업로드
    if files:
        save_dir = os.path.join(settings.IMAGE_SAVE_DIR, "archives", str(archive_no))
        os.makedirs(save_dir, exist_ok=True)
        for file in files:
            attachment = await _save_file(file, save_dir)
            db.add(ArchiveAttachment(
                archive_no    = archive_no,
                original_name = attachment["original_name"],
                stored_path   = attachment["stored_path"],
                file_size     = attachment["file_size"],
            ))

    await db.commit()
    await db.refresh(archive)
    return archive


async def delete_archive(db: AsyncSession, archive_no: int) -> None:
    archive = await get_archive(db, archive_no)
    # 첨부파일 물리 삭제
    for att in archive.attachments:
        _remove_file(att.stored_path)
    await db.delete(archive)
    await db.commit()


async def delete_archive_attachment(db: AsyncSession, attachment_no: int) -> None:
    result = await db.execute(
        select(ArchiveAttachment).where(ArchiveAttachment.attachment_no == attachment_no)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "첨부파일을 찾을 수 없습니다.")
    _remove_file(att.stored_path)
    await db.delete(att)
    await db.commit()


async def get_archive_attachment(
    db: AsyncSession, attachment_no: int
) -> ArchiveAttachment:
    result = await db.execute(
        select(ArchiveAttachment).where(ArchiveAttachment.attachment_no == attachment_no)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "첨부파일을 찾을 수 없습니다.")
    return att


# ════════════════════════════════════════════════════════════════════════════
# 내부 헬퍼
# ════════════════════════════════════════════════════════════════════════════
async def _save_file(file: UploadFile, save_dir: str) -> dict:
    """파일 유효성 검사 후 서버에 저장, 메타 반환"""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"허용되지 않는 파일 형식입니다: {ext}",
        )

    contents = await file.read()
    max_size = _MAX_FILE_SIZE_BY_EXT.get(ext, _MAX_FILE_SIZE)
    if len(contents) > max_size:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"파일 크기는 {max_size // (1024 * 1024)}MB를 초과할 수 없습니다.",
        )

    unique_name  = f"{uuid.uuid4().hex}{ext}"
    stored_path  = os.path.join(save_dir, unique_name)

    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(contents)

    return {
        "original_name": file.filename,
        "stored_path":   stored_path,
        "file_size":     len(contents),
    }


def _remove_file(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def _notice_dict(n: Notice) -> dict:
    return {
        "notice_no":  n.notice_no,
        "title":      n.title,
        "content":    n.content,
        "is_pinned":  bool(n.is_pinned),
        "view_count": n.view_count,
        "author_no":  n.author_no,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


def _inquiry_dict(i: Inquiry) -> dict:
    return {
        "inquiry_no":  i.inquiry_no,
        "user_no":     i.user_no,
        "title":       i.title,
        "content":     i.content,
        "answer":      i.answer,
        "answered_by": i.answered_by,
        "answered_at": i.answered_at.isoformat() if i.answered_at else None,
        "status":      i.status.value,
        "is_private":  i.is_private,
        "created_at":  i.created_at.isoformat() if i.created_at else None,
        "updated_at":  i.updated_at.isoformat() if i.updated_at else None,
        "attachments": [_att_dict(a, "inquiries") for a in i.attachments],
    }


def _archive_dict(a: Archive) -> dict:
    return {
        "archive_no":  a.archive_no,
        "title":       a.title,
        "content":     a.content,
        "view_count":  a.view_count,
        "author_no":   a.author_no,
        "created_at":  a.created_at.isoformat() if a.created_at else None,
        "updated_at":  a.updated_at.isoformat() if a.updated_at else None,
        "attachments": [_att_dict(att, "archives") for att in a.attachments],
    }


def _att_dict(a, kind: str) -> dict:
    return {
        "attachment_no": a.attachment_no,
        "original_name": a.original_name,
        "file_size":     a.file_size,
        "download_url":  f"/board/{kind}/attachments/{a.attachment_no}/download",
        "created_at":    a.created_at.isoformat() if a.created_at else None,
    }


# ════════════════════════════════════════════════════════════════════════════
# 버그 게시판
# ════════════════════════════════════════════════════════════════════════════
from sqlalchemy.orm import selectinload as _sload
from models.board_orm import BugPost, BugComment, BugAttachment, BugStatus as _BugStatus
from schemas.board_schema import BugPostCreate, BugPostUpdate


async def get_bugs(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    keyword: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    q = select(BugPost).options(_sload(BugPost.comments), _sload(BugPost.attachments)).order_by(BugPost.created_at.desc())
    if keyword:
        q = q.where(BugPost.title.ilike(f"%{keyword}%"))
    if status:
        q = q.where(BugPost.status == status)

    cnt_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(cnt_q)).scalar_one()

    rows = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {
        "items":    [_bug_list_dict(b) for b in rows],
        "total":    total,
        "page":     page,
        "pages":    max(1, -(-total // per_page)),
        "per_page": per_page,
    }


async def get_bug(db: AsyncSession, bug_no: int) -> BugPost:
    res = await db.execute(
        select(BugPost)
        .options(_sload(BugPost.comments), _sload(BugPost.attachments))
        .where(BugPost.bug_no == bug_no)
    )
    bug = res.scalar_one_or_none()
    if not bug:
        raise HTTPException(status_code=404, detail="버그 게시물을 찾을 수 없습니다.")
    return bug


async def create_bug(
    db: AsyncSession,
    data: BugPostCreate,
    user_no: int,
    files: list[UploadFile] | None = None,
) -> BugPost:
    bug = BugPost(title=data.title, content=data.content, user_no=user_no)
    db.add(bug)
    await db.flush()

    if files:
        save_dir = os.path.join(settings.IMAGE_SAVE_DIR, "bugs", str(bug.bug_no))
        os.makedirs(save_dir, exist_ok=True)
        for file in files:
            attachment = await _save_file(file, save_dir)
            db.add(BugAttachment(
                bug_no        = bug.bug_no,
                original_name = attachment["original_name"],
                stored_path   = attachment["stored_path"],
                file_size     = attachment["file_size"],
            ))

    await db.commit()
    return await get_bug(db, bug.bug_no)


async def update_bug(db: AsyncSession, bug_no: int, data: BugPostUpdate) -> BugPost:
    bug = await get_bug(db, bug_no)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(bug, field, value)
    await db.commit()
    await db.refresh(bug)
    return bug


async def delete_bug(db: AsyncSession, bug_no: int) -> None:
    bug = await get_bug(db, bug_no)
    for att in getattr(bug, "attachments", []) or []:
        _remove_file(att.stored_path)
    await db.delete(bug)
    await db.commit()


async def get_bug_attachment(db: AsyncSession, attachment_no: int) -> BugAttachment:
    result = await db.execute(
        select(BugAttachment).where(BugAttachment.attachment_no == attachment_no)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "첨부파일을 찾을 수 없습니다.")
    return att


async def update_bug_status(db: AsyncSession, bug_no: int, new_status: str) -> BugPost:
    bug = await get_bug(db, bug_no)
    bug.status = new_status
    await db.commit()
    await db.refresh(bug)
    return bug


async def add_bug_comment(db: AsyncSession, bug_no: int, content: str, user_no: int) -> BugComment:
    await get_bug(db, bug_no)  # 존재 확인
    comment = BugComment(bug_no=bug_no, content=content, user_no=user_no)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_bug_comment(db: AsyncSession, comment_no: int) -> None:
    res = await db.execute(select(BugComment).where(BugComment.comment_no == comment_no))
    comment = res.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    await db.delete(comment)
    await db.commit()


def _bug_list_dict(b: BugPost) -> dict:
    return {
        "bug_no":     b.bug_no,
        "user_no":    b.user_no,
        "title":      b.title,
        "status":     b.status,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "attachments": [_att_dict(att, "bugs") for att in getattr(b, "attachments", [])],
        "comment_count": len(b.comments) if hasattr(b, "comments") and b.comments is not None else 0,
    }


def _bug_dict(b: BugPost) -> dict:
    d = _bug_list_dict(b)
    d["content"]    = b.content
    d["updated_at"] = b.updated_at.isoformat() if b.updated_at else None
    d["attachments"] = [_att_dict(att, "bugs") for att in getattr(b, "attachments", [])]
    if hasattr(b, "comments") and b.comments is not None:
        d["comments"] = [
            {
                "comment_no": c.comment_no,
                "bug_no":     c.bug_no,
                "user_no":    c.user_no,
                "content":    c.content,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in sorted(b.comments, key=lambda x: x.created_at)
        ]
    else:
        d["comments"] = []
    return d


async def update_bug_with_files(
    db: AsyncSession,
    bug_no: int,
    title: str | None,
    content: str | None,
    files: list[UploadFile] | None = None,
) -> BugPost:
    bug = await get_bug(db, bug_no)
    if title is not None:
        bug.title = title
    if content is not None:
        bug.content = content
    if files:
        save_dir = os.path.join(settings.IMAGE_SAVE_DIR, "bugs", str(bug_no))
        os.makedirs(save_dir, exist_ok=True)
        for file in files:
            att = await _save_file(file, save_dir)
            db.add(BugAttachment(
                bug_no        = bug_no,
                original_name = att["original_name"],
                stored_path   = att["stored_path"],
                file_size     = att["file_size"],
            ))
    await db.commit()
    return await get_bug(db, bug_no)


async def delete_bug_attachment(db: AsyncSession, attachment_no: int) -> None:
    result = await db.execute(
        select(BugAttachment).where(BugAttachment.attachment_no == attachment_no)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")
    _remove_file(att.stored_path)
    await db.delete(att)
    await db.commit()
