"""
routers/board.py
게시판 전체 라우터

엔드포인트:
──────────────────────────────────────────────────────────────────
[공지사항]
  GET    /board/notices                  목록 (검색+페이지)
  POST   /board/notices                  등록 (관리자)
  GET    /board/notices/{no}             단일 조회 + 조회수 증가
  PUT    /board/notices/{no}             수정 (관리자)
  DELETE /board/notices/{no}             삭제 (관리자)

[1:1 문의]
  GET    /board/inquiries                전체 목록 (관리자)
  GET    /board/inquiries/my             내 문의 목록 (로그인 유저)
  POST   /board/inquiries                문의 등록 + 첨부파일
  GET    /board/inquiries/{no}           단일 조회
  DELETE /board/inquiries/{no}           삭제
  POST   /board/inquiries/{no}/answer    관리자 답변
  GET    /board/inquiries/attachments/{attachment_no}/download  첨부 다운로드

[FAQ]
  GET    /board/faqs                     목록 (검색)
  POST   /board/faqs                     등록 (관리자)
  GET    /board/faqs/{no}                단일 조회
  PUT    /board/faqs/{no}                수정 (관리자)
  DELETE /board/faqs/{no}                삭제 (관리자)

[자료실]
  GET    /board/archives                 목록 (검색+페이지)
  POST   /board/archives                 등록 + 첨부파일
  GET    /board/archives/{no}            단일 조회 + 조회수 증가
  PUT    /board/archives/{no}            수정 + 추가 첨부파일
  DELETE /board/archives/{no}            삭제 (첨부 포함)
  DELETE /board/archives/attachments/{attachment_no}  첨부 단건 삭제
  GET    /board/archives/attachments/{attachment_no}/download  첨부 다운로드

[버그 게시판]
  GET    /board/bugs                    목록
  POST   /board/bugs                    등록 + 첨부파일
  GET    /board/bugs/{no}               단일 조회
  GET    /board/bugs/attachments/{attachment_no}/download  첨부 다운로드
──────────────────────────────────────────────────────────────────
"""

import os
from typing import Optional, List

from fastapi import (
    APIRouter, Depends, HTTPException, Query,
    UploadFile, File, Form, status,
)
from fastapi.responses import FileResponse

from core.database import get_board_db
from core.security import get_current_user, require_admin
from schemas.board_schema import (
    NoticeCreate, NoticeUpdate,
    InquiryCreate, InquiryUpdate, InquiryAnswerRequest,
    FAQCreate, FAQUpdate,
    ArchiveCreate, ArchiveUpdate,
    BugPostCreate, BugPostUpdate, BugStatusUpdate, BugCommentCreate,
)
from services import board_service as svc
from models.board_orm import FAQ

router = APIRouter(prefix="/board", tags=["Board"])


# ════════════════════════════════════════════════════════════════════════════
# 공지사항
# ════════════════════════════════════════════════════════════════════════════

@router.get("/notices", summary="공지사항 목록")
async def list_notices(
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    keyword:  Optional[str] = Query(None, description="제목 검색"),
    db=Depends(get_board_db),
):
    result = await svc.get_notices(db, page=page, per_page=per_page, keyword=keyword)
    return {"success": True, "data": result}


@router.post("/notices", status_code=201, summary="공지사항 등록 (관리자)")
async def create_notice(
    body:         NoticeCreate,
    current_user: dict = Depends(require_admin),
    db=Depends(get_board_db),
):
    notice = await svc.create_notice(db, body, author_no=int(current_user["sub"]))
    return {"success": True, "message": "공지사항이 등록되었습니다.", "data": svc._notice_dict(notice)}


@router.get("/notices/{notice_no}", summary="공지사항 단일 조회")
async def get_notice(notice_no: int, db=Depends(get_board_db)):
    notice = await svc.get_notice(db, notice_no, increment_view=True)
    return {"success": True, "data": svc._notice_dict(notice)}


@router.put("/notices/{notice_no}", summary="공지사항 수정 (관리자)")
async def update_notice(
    notice_no: int,
    body:      NoticeUpdate,
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    notice = await svc.update_notice(db, notice_no, body)
    return {"success": True, "message": "수정되었습니다.", "data": svc._notice_dict(notice)}


@router.delete("/notices/{notice_no}", summary="공지사항 삭제 (관리자)")
async def delete_notice(
    notice_no: int,
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    await svc.delete_notice(db, notice_no)
    return {"success": True, "message": "삭제되었습니다."}


# ════════════════════════════════════════════════════════════════════════════
# 1:1 문의
# ════════════════════════════════════════════════════════════════════════════


@router.get("/inquiries", summary="전체 문의 목록 (관리자)")
async def list_all_inquiries(
    page:     int = Query(1,  ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    result = await svc.get_inquiries(db, page=page, per_page=per_page)
    return {"success": True, "data": result}


@router.get("/inquiries/my", summary="문의 목록 (내 글 전체 + 타인의 공개글)")
async def list_my_inquiries(
    page:         int  = Query(1,  ge=1),
    per_page:     int  = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    result = await svc.get_inquiries(
        db, user_no=int(current_user["sub"]), page=page, per_page=per_page,
        include_public=True,
    )
    return {"success": True, "data": result}


@router.post("/inquiries", status_code=201, summary="문의 등록 (첨부파일 포함)")
async def create_inquiry(
    title:        str               = Form(...),
    content:      str               = Form(...),
    is_private:   int               = Form(default=0),
    files:        List[UploadFile]  = File(default=[]),
    current_user: dict              = Depends(get_current_user),
    db=Depends(get_board_db),
):
    """
    multipart/form-data 로 전송.
    - title, content : Form 필드
    - is_private     : 1=비공개, 0=공개 (기본값 0)
    - files          : 첨부파일 (여러 개 가능, 선택)
    """
    data    = InquiryCreate(title=title, content=content, is_private=is_private)
    inquiry = await svc.create_inquiry(
        db, data,
        user_no = int(current_user["sub"]),
        files   = files or None,
    )
    return {"success": True, "message": "문의가 등록되었습니다.", "data": svc._inquiry_dict(inquiry)}


@router.get("/inquiries/{inquiry_no}", summary="문의 단일 조회")
async def get_inquiry(
    inquiry_no:   int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    inquiry = await svc.get_inquiry(db, inquiry_no)
    is_owner = inquiry.user_no == int(current_user["sub"])
    is_admin = current_user.get("role") == "admin"
    # 비공개 글: 작성자·관리자만 열람 / 공개 글: 로그인 사용자 누구나 열람
    if inquiry.is_private and not is_owner and not is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "접근 권한이 없습니다. 작성자 본인 또는 관리자만 열람 가능한 글입니다.",
        )
    return {"success": True, "data": svc._inquiry_dict(inquiry)}


@router.post("/inquiries/{inquiry_no}/answer", summary="문의 답변 등록 (관리자)")
async def answer_inquiry(
    inquiry_no:   int,
    body:         InquiryAnswerRequest,
    current_user: dict = Depends(require_admin),
    db=Depends(get_board_db),
):
    inquiry = await svc.answer_inquiry(db, inquiry_no, body, handler_no=int(current_user["sub"]))
    return {"success": True, "message": "답변이 등록되었습니다.", "data": svc._inquiry_dict(inquiry)}


@router.put("/inquiries/{inquiry_no}/answer", summary="문의 답변 수정 (관리자)")
async def update_answer(
    inquiry_no:   int,
    body:         InquiryAnswerRequest,
    current_user: dict = Depends(require_admin),
    db=Depends(get_board_db),
):
    inquiry = await svc.update_answer(db, inquiry_no, body, handler_no=int(current_user["sub"]))
    return {"success": True, "message": "답변이 수정되었습니다.", "data": svc._inquiry_dict(inquiry)}


@router.delete("/inquiries/{inquiry_no}/answer", summary="문의 답변 삭제 (관리자)")
async def delete_answer(
    inquiry_no:   int,
    _:            dict = Depends(require_admin),
    db=Depends(get_board_db),
):
    inquiry = await svc.delete_answer(db, inquiry_no)
    return {"success": True, "message": "답변이 삭제되었습니다.", "data": svc._inquiry_dict(inquiry)}


@router.put("/inquiries/{inquiry_no}", summary="문의 수정 (본인만)")
async def update_inquiry(
    inquiry_no:   int,
    body:         InquiryUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    inquiry = await svc.update_inquiry(db, inquiry_no, int(current_user["sub"]), body)
    return {"success": True, "message": "문의가 수정되었습니다.", "data": svc._inquiry_dict(inquiry)}


@router.delete("/inquiries/{inquiry_no}", summary="문의 삭제")
async def delete_inquiry(
    inquiry_no:   int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    inquiry = await svc.get_inquiry(db, inquiry_no)
    is_owner = inquiry.user_no == int(current_user["sub"])
    is_admin = current_user.get("role") == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "작성자 본인 또는 관리자만 삭제할 수 있습니다.")
    await svc.delete_inquiry(db, inquiry_no)
    return {"success": True, "message": "삭제되었습니다."}


@router.get(
    "/inquiries/attachments/{attachment_no}/download",
    summary="문의 첨부파일 다운로드",
)
async def download_inquiry_attachment(
    attachment_no: int,
    db=Depends(get_board_db),
    _=Depends(get_current_user),
):
    att = await svc.get_inquiry_attachment(db, attachment_no)
    if not os.path.exists(att.stored_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "파일이 존재하지 않습니다.")
    return FileResponse(
        path      = att.stored_path,
        filename  = att.original_name,
        media_type= "application/octet-stream",
    )


# ════════════════════════════════════════════════════════════════════════════
# FAQ
# ════════════════════════════════════════════════════════════════════════════

@router.get("/faqs", summary="FAQ 목록")
async def list_faqs(
    keyword: Optional[str] = Query(None, description="질문 검색"),
    db=Depends(get_board_db),
):
    faqs = await svc.get_faqs(db, keyword=keyword)
    return {"success": True, "data": {"faqs": [_faq_dict(f) for f in faqs]}}


@router.post("/faqs", status_code=201, summary="FAQ 등록 (관리자)")
async def create_faq(
    body: FAQCreate,
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    faq = await svc.create_faq(db, body)
    return {"success": True, "message": "FAQ가 등록되었습니다.", "data": _faq_dict(faq)}


@router.get("/faqs/{faq_no}", summary="FAQ 단일 조회")
async def get_faq(faq_no: int, db=Depends(get_board_db)):
    faq = await svc.get_faq(db, faq_no)
    return {"success": True, "data": _faq_dict(faq)}


@router.put("/faqs/{faq_no}", summary="FAQ 수정 (관리자)")
async def update_faq(
    faq_no: int,
    body:   FAQUpdate,
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    faq = await svc.update_faq(db, faq_no, body)
    return {"success": True, "message": "수정되었습니다.", "data": _faq_dict(faq)}


@router.delete("/faqs/{faq_no}", summary="FAQ 삭제 (관리자)")
async def delete_faq(
    faq_no: int,
    db=Depends(get_board_db),
    _=Depends(require_admin),
):
    await svc.delete_faq(db, faq_no)
    return {"success": True, "message": "삭제되었습니다."}


# ════════════════════════════════════════════════════════════════════════════
# 자료실
# ════════════════════════════════════════════════════════════════════════════

@router.get("/archives", summary="자료실 목록")
async def list_archives(
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    keyword:  Optional[str] = Query(None, description="제목 검색"),
    db=Depends(get_board_db),
):
    result = await svc.get_archives(db, page=page, per_page=per_page, keyword=keyword)
    return {"success": True, "data": result}


@router.post("/archives", status_code=201, summary="자료 등록 (첨부파일 포함)")
async def create_archive(
    title:        str              = Form(...),
    content:      str              = Form(...),
    files:        List[UploadFile] = File(default=[]),
    current_user: dict             = Depends(get_current_user),
    db=Depends(get_board_db),
):
    """
    multipart/form-data 로 전송.
    - title, content : Form 필드
    - files          : 첨부파일 (여러 개 가능, 선택)
    """
    data    = ArchiveCreate(title=title, content=content)
    archive = await svc.create_archive(
        db, data,
        author_no = int(current_user["sub"]),
        files     = files or None,
    )
    return {"success": True, "message": "자료가 등록되었습니다.", "data": svc._archive_dict(archive)}


@router.get("/archives/{archive_no}", summary="자료 단일 조회")
async def get_archive(archive_no: int, db=Depends(get_board_db)):
    archive = await svc.get_archive(db, archive_no, increment_view=True)
    return {"success": True, "data": svc._archive_dict(archive)}


@router.put("/archives/{archive_no}", summary="자료 수정 (추가 첨부 가능)")
async def update_archive(
    archive_no:   int,
    title:        Optional[str]    = Form(default=None),
    content:      Optional[str]    = Form(default=None),
    files:        List[UploadFile] = File(default=[]),
    current_user: dict             = Depends(get_current_user),
    db=Depends(get_board_db),
):
    data    = ArchiveUpdate(title=title, content=content)
    archive = await svc.update_archive(
        db, archive_no, data, files=files or None
    )
    return {"success": True, "message": "수정되었습니다.", "data": svc._archive_dict(archive)}


@router.delete("/archives/{archive_no}", summary="자료 삭제 (첨부파일 포함)")
async def delete_archive(
    archive_no: int,
    db=Depends(get_board_db),
    _=Depends(get_current_user),
):
    await svc.delete_archive(db, archive_no)
    return {"success": True, "message": "삭제되었습니다."}


@router.delete(
    "/archives/attachments/{attachment_no}",
    summary="자료 첨부파일 단건 삭제",
)
async def delete_archive_attachment(
    attachment_no: int,
    db=Depends(get_board_db),
    _=Depends(get_current_user),
):
    await svc.delete_archive_attachment(db, attachment_no)
    return {"success": True, "message": "첨부파일이 삭제되었습니다."}


@router.get(
    "/archives/attachments/{attachment_no}/download",
    summary="자료 첨부파일 다운로드",
)
async def download_archive_attachment(
    attachment_no: int,
    db=Depends(get_board_db),
):
    att = await svc.get_archive_attachment(db, attachment_no)
    if not os.path.exists(att.stored_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "파일이 존재하지 않습니다.")
    return FileResponse(
        path       = att.stored_path,
        filename   = att.original_name,
        media_type = "application/octet-stream",
    )


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────
def _faq_dict(f: FAQ) -> dict:
    return {
        "faq_no":     f.faq_no,
        "question":   f.question,
        "answer":     f.answer,
        "sort_order": f.sort_order,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


# ════════════════════════════════════════════════════════════════════════════
# 버그 게시판
# ════════════════════════════════════════════════════════════════════════════

@router.get("/bugs", summary="버그 게시판 목록")
async def list_bugs(
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    keyword:  Optional[str] = Query(None),
    status:   Optional[str] = Query(None),
    db=Depends(get_board_db),
):
    result = await svc.get_bugs(db, page=page, per_page=per_page, keyword=keyword, status=status)
    return {"success": True, "data": result}


@router.post("/bugs", status_code=201, summary="버그 게시판 글 등록 (첨부파일 포함)")
async def create_bug_post(
    title:        str = Form(...),
    content:      str = Form(...),
    files:        List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    body = BugPostCreate(title=title, content=content)
    bug = await svc.create_bug(db, body, user_no=int(current_user["sub"]), files=files or None)
    return {"success": True, "message": "등록되었습니다.", "data": svc._bug_dict(bug)}


@router.delete("/bugs/comments/{comment_no}", summary="버그 댓글 삭제")
async def delete_bug_comment(
    comment_no:   int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    await svc.delete_bug_comment(db, comment_no)
    return {"success": True, "message": "댓글이 삭제되었습니다."}




@router.get(
    "/bugs/attachments/{attachment_no}/download",
    summary="버그 게시판 첨부파일 다운로드",
)
async def download_bug_attachment(attachment_no: int, db=Depends(get_board_db)):
    att = await svc.get_bug_attachment(db, attachment_no)
    if not os.path.exists(att.stored_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="파일이 존재하지 않습니다.")
    return FileResponse(
        path=att.stored_path,
        filename=att.original_name,
        media_type="application/octet-stream",
    )


@router.get("/bugs/{bug_no}", summary="버그 게시판 단일 조회")
async def get_bug_post(bug_no: int, db=Depends(get_board_db)):
    bug = await svc.get_bug(db, bug_no)
    return {"success": True, "data": svc._bug_dict(bug)}


@router.put("/bugs/{bug_no}", summary="버그 게시판 글 수정 (첨부파일 추가 가능)")
async def update_bug_post(
    bug_no:       int,
    title:        Optional[str]    = Form(default=None),
    content:      Optional[str]    = Form(default=None),
    files:        List[UploadFile] = File(default=[]),
    current_user: dict             = Depends(get_current_user),
    db=Depends(get_board_db),
):
    bug = await svc.get_bug(db, bug_no)
    if bug.user_no != int(current_user["sub"]) and current_user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다.")
    updated = await svc.update_bug_with_files(
        db, bug_no, title=title, content=content, files=files or None
    )
    return {"success": True, "message": "수정되었습니다.", "data": svc._bug_dict(updated)}


@router.delete("/bugs/attachments/{attachment_no}", summary="버그 첨부파일 삭제")
async def delete_bug_attachment(
    attachment_no: int,
    current_user:  dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    await svc.delete_bug_attachment(db, attachment_no)
    return {"success": True, "message": "첨부파일이 삭제되었습니다."}


@router.delete("/bugs/{bug_no}", summary="버그 게시판 글 삭제")
async def delete_bug_post(
    bug_no:       int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    bug = await svc.get_bug(db, bug_no)
    if bug.user_no != int(current_user["sub"]) and current_user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    await svc.delete_bug(db, bug_no)
    return {"success": True, "message": "삭제되었습니다."}


@router.patch("/bugs/{bug_no}/status", summary="버그 상태 변경 (OPEN/FIXED)")
async def update_bug_status(
    bug_no:       int,
    body:         BugStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    updated = await svc.update_bug_status(db, bug_no, body.status)
    return {"success": True, "message": "상태가 변경되었습니다.", "data": svc._bug_dict(updated)}


@router.post("/bugs/{bug_no}/comments", status_code=201, summary="버그 댓글 등록")
async def add_bug_comment(
    bug_no:       int,
    body:         BugCommentCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_board_db),
):
    comment = await svc.add_bug_comment(
        db, bug_no=bug_no, content=body.content, user_no=int(current_user["sub"])
    )
    return {"success": True, "message": "댓글이 등록되었습니다.", "data": {
        "comment_no": comment.comment_no,
        "bug_no":     comment.bug_no,
        "user_no":    comment.user_no,
        "content":    comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }}
