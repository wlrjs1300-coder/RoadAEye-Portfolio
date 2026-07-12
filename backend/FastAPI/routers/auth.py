"""
routers/auth.py
회원가입 / 로그인 라우터

엔드포인트:
  POST /auth/email/send-code     이메일 인증 코드 발송
  POST /auth/email/verify        인증 코드 확인
  POST /auth/check/login-id      아이디 중복 확인
  POST /auth/register            회원가입
  POST /auth/login               로그인
  GET  /auth/me                  내 정보 조회 (JWT 필요)

  GET  /auth/naver               네이버 로그인 URL 반환
  GET  /auth/naver/callback      네이버 OAuth 콜백
  GET  /auth/kakao               카카오 로그인 URL 반환
  GET  /auth/kakao/callback      카카오 OAuth 콜백
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from core.config import settings
from core.database import get_member_db
from core.security import get_current_user
from core.security import create_access_token
from schemas.auth_schema import (
    SendCodeRequest, VerifyCodeRequest,
    CheckLoginIdRequest, RegisterRequest,
    LoginRequest, UserResponse, TokenResponse, UserUpdate,
    PasswordResetRequest, PasswordResetConfirm,
    FindLoginIdRequest, RefreshTokenRequest,
)
from services import auth_service as svc

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/email/send-code", summary="이메일 인증 코드 발송")
async def send_code(body: SendCodeRequest, db=Depends(get_member_db)):
    expires_at = await svc.send_verification_code(db, str(body.email))
    return {
        "success": True,
        "message": f"인증 코드를 {body.email}로 발송했습니다.",
        "data":    {"expires_at": expires_at},
    }


@router.post("/email/verify", summary="이메일 인증 코드 확인")
async def verify_email(body: VerifyCodeRequest, db=Depends(get_member_db)):
    await svc.verify_code(db, str(body.email), body.code)
    return {"success": True, "message": "이메일 인증이 완료되었습니다."}


@router.post("/check/login-id", summary="아이디 중복 확인")
async def check_login_id(body: CheckLoginIdRequest, db=Depends(get_member_db)):
    available = await svc.check_login_id(db, body.login_id)
    if not available:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 아이디입니다.")
    return {"success": True, "message": "사용 가능한 아이디입니다."}


@router.post("/register", status_code=201, summary="회원가입")
async def register(body: RegisterRequest, db=Depends(get_member_db)):
    user  = await svc.register(db, body)
    token = create_access_token(user.user_no, user.login_id, user.role)
    return {
        "success": True,
        "message": "회원가입이 완료되었습니다.",
        "data": {
            "user":         UserResponse.model_validate(user),
            "access_token": token,   # 자동 로그인 시 사용 가능
        },
    }


@router.post("/login", summary="로그인")
async def login(body: LoginRequest, db=Depends(get_member_db)):
    result = await svc.login(db, body.login_id, body.password)
    user = result["user"]
    refresh_token = await svc.create_refresh_token_db(db, user.user_no)
    return {
        "success": True,
        "message": "로그인 성공",
        "data": TokenResponse(
            access_token  = result["token"],
            refresh_token = refresh_token,
            user          = UserResponse.model_validate(user),
        ),
    }


@router.get("/me", summary="내 정보 조회", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user), db=Depends(get_member_db)):
    from sqlalchemy import select
    from models.orm import User
    result = await db.execute(
        select(User).where(User.user_no == int(current_user["sub"]))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "정지된 계정입니다.")
    return UserResponse.model_validate(user)


@router.put("/me", summary="내 정보 수정", response_model=UserResponse)
async def update_me(
    body:         UserUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    user = await svc.update_me(db, int(current_user["sub"]), body)
    return UserResponse.model_validate(user)


# ── 아이디 찾기 ───────────────────────────────────────────────────────────────

@router.post("/find-id", summary="아이디 찾기 (이메일 + 이름 확인)")
async def find_login_id(body: FindLoginIdRequest, db=Depends(get_member_db)):
    masked_id = await svc.find_login_id(db, str(body.email), body.name)
    return {
        "success": True,
        "message": "아이디를 찾았습니다.",
        "data":    {"login_id": masked_id},
    }


# ── 비밀번호 재설정 ───────────────────────────────────────────────────────────

@router.post("/password/reset-request", summary="비밀번호 재설정 코드 발송")
async def password_reset_request(body: PasswordResetRequest, db=Depends(get_member_db)):
    await svc.send_password_reset_code(db, str(body.email))
    return {"success": True, "message": "입력하신 이메일로 재설정 코드를 발송했습니다."}


@router.post("/password/reset", summary="비밀번호 재설정 (코드 검증 + 변경)")
async def password_reset(body: PasswordResetConfirm, db=Depends(get_member_db)):
    await svc.reset_password(db, str(body.email), body.code, body.new_password)
    return {"success": True, "message": "비밀번호가 성공적으로 변경되었습니다."}


# ── 소셜 로그인 ───────────────────────────────────────────────────────────────

@router.get("/naver", summary="네이버 로그인 URL 반환")
async def naver_login():
    return {"url": svc.get_naver_login_url()}


def _social_redirect(result: dict, provider: str) -> RedirectResponse:
    """소셜 로그인 공통 리다이렉트 — 정지 계정은 error 파라미터로 전달"""
    user = result.get("user")
    if user and not user.is_active:
        login_id = user.login_id or ""
        return RedirectResponse(
            f"{settings.FRONTEND_AUTH_CALLBACK_URL}?error=suspended&login_id={login_id}&provider={provider}"
        )
    token = result["token"]
    return RedirectResponse(f"{settings.FRONTEND_AUTH_CALLBACK_URL}?token={token}&provider={provider}")


@router.get("/naver/callback", summary="네이버 OAuth 콜백")
async def naver_callback(code: str, state: str, db=Depends(get_member_db)):
    result = await svc.naver_callback(db, code, state)
    return _social_redirect(result, "naver")


@router.get("/kakao", summary="카카오 로그인 URL 반환")
async def kakao_login():
    return {"url": svc.get_kakao_login_url()}


@router.get("/kakao/callback", summary="카카오 OAuth 콜백")
async def kakao_callback(code: str, db=Depends(get_member_db)):
    result = await svc.kakao_callback(db, code)
    return _social_redirect(result, "kakao")


@router.get("/google", summary="구글 로그인 URL 반환")
async def google_login():
    return {"url": svc.get_google_login_url()}


@router.get("/google/callback", summary="구글 OAuth 콜백")
async def google_callback(code: str, db=Depends(get_member_db)):
    result = await svc.google_callback(db, code)
    return _social_redirect(result, "google")


# ── 정지 계정 공개 문의 (인증 불필요) ────────────────────────────────────────

from pydantic import BaseModel as _BM, EmailStr as _ES

class SuspendedInquiryRequest(_BM):
    login_id:   str
    email:      _ES
    email_code: str
    message:    str


@router.post("/suspended-inquiry", summary="정지 계정 문의 (이메일 인증 후 공개 제출)")
async def suspended_inquiry(
    body: SuspendedInquiryRequest,
    member_db=Depends(get_member_db),
):
    from sqlalchemy import text
    from core.database import get_board_db
    from schemas.board_schema import InquiryCreate
    from services import board_service as board_svc

    # 1. 이메일 인증 코드 검증
    await svc.verify_code(member_db, str(body.email), body.email_code)

    # 2. login_id → user_no 조회
    result = await member_db.execute(
        text("SELECT user_no FROM users WHERE login_id = :lid"),
        {"lid": body.login_id}
    )
    row = result.fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="해당 아이디를 찾을 수 없습니다.")
    user_no = row[0]

    # 3. 문의 생성 (board_db)
    board_session = get_board_db()
    async for db in board_session:
        title   = f"[계정 정지 문의] {body.login_id}"
        content = f"아이디: {body.login_id}\n이메일: {body.email}\n\n{body.message}"
        inquiry = await board_svc.create_inquiry(
            db,
            InquiryCreate(title=title, content=content, is_private=1),
            user_no=user_no,
        )
        return {"success": True, "message": "문의가 접수되었습니다.", "inquiry_no": inquiry.inquiry_no}

@router.post("/refresh", summary="Access Token 갱신")
async def refresh_token(body: RefreshTokenRequest, db=Depends(get_member_db)):
    result = await svc.refresh_access_token(db, body.refresh_token)
    return {"success": True, "message": "토큰 갱신 성공", "data": result}


@router.post("/logout", summary="로그아웃 (Refresh Token 폐기)")
async def logout(body: RefreshTokenRequest, db=Depends(get_member_db)):
    await svc.revoke_refresh_token(db, body.refresh_token)
    return {"success": True, "message": "로그아웃 완료"}
