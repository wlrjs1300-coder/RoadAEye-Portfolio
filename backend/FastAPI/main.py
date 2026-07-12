"""
main.py
FastAPI 애플리케이션 진입점
실행: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.database import (
    Base,
    member_engine, board_engine, ai_engine, chat_engine,
    MemberSessionLocal,
)
from routers import auth, cctv, board, chat, model, ws, admin, its
from routers import settings as settings_router
from services.auth_service import seed_admin_user
from services.stream_service import stream_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── 앱 생명주기 ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── 시작 ──────────────────────────────────────────
    logger.info("Road A Eye API 서버 시작")

    # ORM 모델 임포트 (create_all 전에 반드시 필요)
    from models.orm import User, EmailVerification, UserSetting, CCTV, ForbiddenClass, Detection, RefreshToken
    from models.board_orm import (
        Notice, Inquiry, InquiryAttachment, FAQ, Archive, ArchiveAttachment,
        BugPost, BugComment, BugAttachment
    )
    from models.chat_orm import ChatSession, ChatMessage
    from models.model_orm import ModelVersion
    from models.admin_orm import ActivityLog, SystemConfig

    # 테이블 자동 생성 — 이 서버(247) 담당 DB만 생성
    # ai_db(localhost)는 AI 서버(246)가 담당 → 여기서 생성하지 않음
    async with member_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[
            User.__table__, EmailVerification.__table__, UserSetting.__table__,
            ActivityLog.__table__, SystemConfig.__table__, RefreshToken.__table__,
        ])

    async with board_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[
            Notice.__table__, Inquiry.__table__, InquiryAttachment.__table__,
            FAQ.__table__, Archive.__table__, ArchiveAttachment.__table__,
            BugPost.__table__, BugComment.__table__, BugAttachment.__table__,
        ])

    async with chat_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[
            ChatSession.__table__, ChatMessage.__table__,
        ])

    # 기본 데이터 시딩 (이 서버 담당 DB만)
    # seed_default_classes(ai_db)는 AI 서버(246)에서 담당
    async with MemberSessionLocal() as db:
        await seed_admin_user(db)

    yield

    # ── 종료 ──────────────────────────────────────────
    logger.info("서버 종료 — 스트림 정리")
    stream_manager.release_all()
    await member_engine.dispose()
    await board_engine.dispose()
    await ai_engine.dispose()
    await chat_engine.dispose()


# ── FastAPI 앱 ────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Road A Eye API",
    description = "고속도로 CCTV AI 위험차량 감지 관제 시스템",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# ── 오류 응답 통일 ───────────────────────────────────────────────────────────
def _error(code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=code,
        content={
            "success": False,
            "error":   {"code": code, "message": message},
            "detail":  message,   # 프론트 호환 (err.detail)
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return _error(exc.status_code, exc.detail)


_FIELD_KO = {
    "login_id":     "아이디",
    "password":     "비밀번호",
    "new_password": "새 비밀번호",
    "email":        "이메일",
    "name":         "이름",
    "birth_date":   "생년월일",
    "phone":        "휴대전화",
    "code":         "인증코드",
}
_TYPE_KO = {
    "missing":                 "필수 항목입니다.",
    "string_too_short":        "입력값이 너무 짧습니다.",
    "string_too_long":         "입력값이 너무 깁니다.",
    "string_pattern_mismatch": "형식이 올바르지 않습니다.",
    "int_parsing":             "숫자를 입력해주세요.",
    "value_error":             None,  # 커스텀 validator 메시지 그대로 사용
}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first   = exc.errors()[0]
    err_type = first.get("type", "")
    raw_msg  = first.get("msg", "")

    # "Value error, XXX" → "XXX" 접두사 제거
    msg = raw_msg.removeprefix("Value error, ")

    # 타입별 한국어 메시지 우선 적용 (value_error는 None → 커스텀 메시지 유지)
    ko_msg = _TYPE_KO.get(err_type)
    if ko_msg is not None:
        msg = ko_msg

    # 필드명 한국어 변환 ("body"·"query"·"path" 같은 위치 구분자는 제외)
    field_raw = next((str(loc) for loc in first["loc"] if loc not in ("body", "query", "path")), "")
    field_ko  = _FIELD_KO.get(field_raw, field_raw)

    message = f"{field_ko}: {msg}" if field_ko else msg
    return _error(422, message)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return _error(500, "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")


# ── CORS (React 프론트 허용) ──────────────────────────────────────────────────
_allowed_origins = list({
    settings.FRONTEND_ORIGIN,
    "https://borrower-grandpa-implosion.ngrok-free.dev",
    "https://mbc-sw.iptime.org:3241",
    "http://localhost:3000",
    "http://localhost:3000",
})
app.add_middleware(
    CORSMiddleware,
    allow_origins     = _allowed_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── 라우터 등록 ───────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(cctv.router)
app.include_router(board.router)
app.include_router(chat.router)
app.include_router(model.router)
app.include_router(ws.router)
app.include_router(settings_router.router)
app.include_router(settings_router.profile_router)
app.include_router(admin.router)
app.include_router(its.router)

# ── 감지 이미지 정적 파일 서빙 ────────────────────────────────────────────────
import os
os.makedirs(settings.IMAGE_SAVE_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=settings.IMAGE_SAVE_DIR), name="images")


# ── 헬스체크 ─────────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "Road A Eye API"}
