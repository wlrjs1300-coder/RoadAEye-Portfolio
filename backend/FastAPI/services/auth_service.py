"""
services/auth_service.py
회원가입 / 로그인 / 이메일 인증 비동기 서비스
"""

from __future__ import annotations

import random
import string
from urllib.parse import quote
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException, status
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import hash_password, verify_password, create_access_token
from models.orm import User, EmailVerification

# ── 소셜 로그인 상수 ──────────────────────────────────────────────────────────
_NAVER_TOKEN_URL    = "https://nid.naver.com/oauth2.0/token"
_NAVER_PROFILE_URL  = "https://openapi.naver.com/v1/nid/me"
_KAKAO_TOKEN_URL    = "https://kauth.kakao.com/oauth/token"
_KAKAO_PROFILE_URL  = "https://kapi.kakao.com/v2/user/me"
_GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token"
_GOOGLE_PROFILE_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# ── FastAPI-Mail 설정 (실제 발송 시점에 초기화) ──────────────────────────────
def _get_fastmail() -> FastMail:
    conf = ConnectionConfig(
        MAIL_USERNAME   = settings.MAIL_USERNAME,
        MAIL_PASSWORD   = settings.MAIL_PASSWORD,
        MAIL_FROM       = settings.MAIL_FROM,
        MAIL_PORT       = settings.MAIL_PORT,
        MAIL_SERVER     = settings.MAIL_SERVER,
        MAIL_STARTTLS   = settings.MAIL_TLS,
        MAIL_SSL_TLS    = settings.MAIL_SSL,
        USE_CREDENTIALS = True,
    )
    return FastMail(conf)


# ════════════════════════════════════════════════════════════════════════════
# 관리자 계정 시딩
# ════════════════════════════════════════════════════════════════════════════
async def seed_admin_user(db: AsyncSession) -> None:
    """서버 시작 시 관리자 계정이 없으면 자동 생성"""
    result = await db.execute(select(User).where(User.login_id == settings.ADMIN_LOGIN_ID))
    if result.scalars().first():
        return
    admin = User(
        login_id = settings.ADMIN_LOGIN_ID,
        password = hash_password(settings.ADMIN_PASSWORD),
        email    = settings.ADMIN_EMAIL,
        name     = settings.ADMIN_NAME,
        role     = "admin",
    )
    db.add(admin)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 이메일 인증 코드 발송
# ════════════════════════════════════════════════════════════════════════════
def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


async def send_verification_code(db: AsyncSession, email: str) -> str:
    """
    인증 코드 생성 → 기존 미인증 코드 만료 → DB 저장 → 이메일 발송
    Returns: expires_at ISO 문자열
    """
    # 기존 미인증 코드 만료 처리
    existing = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.email == email, EmailVerification.verified_at.is_(None))
    )
    for row in existing.scalars().all():
        row.expires_at = datetime.now(timezone.utc).replace(tzinfo=None)

    code       = _generate_code()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=settings.EMAIL_CODE_EXPIRE_MINUTES)

    db.add(EmailVerification(email=email, code=code, expires_at=expires_at))
    await db.commit()

    # 메일 발송
    message = MessageSchema(
        subject    = "[Road A Eye] 이메일 인증 코드",
        recipients = [email],
        body       = _build_email_html(code, settings.EMAIL_CODE_EXPIRE_MINUTES),
        subtype    = MessageType.html,
    )
    await _get_fastmail().send_message(message)

    return expires_at.isoformat()


# ════════════════════════════════════════════════════════════════════════════
# 인증 코드 확인
# ════════════════════════════════════════════════════════════════════════════
async def verify_code(db: AsyncSession, email: str, code: str) -> None:
    result = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.email == email, EmailVerification.verified_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
    )
    record = result.scalars().first()

    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드를 먼저 발송해주세요.")
    if record.is_expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 만료되었습니다. 다시 발송해주세요.")
    if record.code != code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 올바르지 않습니다.")

    record.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()


async def _is_email_verified(db: AsyncSession, email: str) -> bool:
    result = await db.execute(
        select(EmailVerification)
        .where(
            EmailVerification.email == email,
            EmailVerification.verified_at.is_not(None),
            EmailVerification.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
        )
    )
    return result.scalars().first() is not None


# ════════════════════════════════════════════════════════════════════════════
# 아이디 중복 확인
# ════════════════════════════════════════════════════════════════════════════
async def check_login_id(db: AsyncSession, login_id: str) -> bool:
    """True = 사용 가능, False = 중복"""
    result = await db.execute(select(User).where(User.login_id == login_id))
    return result.scalars().first() is None


# ════════════════════════════════════════════════════════════════════════════
# 회원가입
# ════════════════════════════════════════════════════════════════════════════
async def register(db: AsyncSession, data) -> User:
    # 이메일 인증 완료 여부
    if not await _is_email_verified(db, data.email):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "이메일 인증이 완료되지 않았습니다. 먼저 인증을 진행해주세요.",
        )

    # 아이디 중복
    if not await check_login_id(db, data.login_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 아이디입니다.")

    # 이메일 중복
    dup_email = await db.execute(select(User).where(User.email == data.email))
    if dup_email.scalars().first():
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입된 이메일입니다.")

    user = User(
        login_id   = data.login_id,
        password   = hash_password(data.password),
        email      = str(data.email),
        name       = data.name,
        birth_date = data.birth_date,
        phone      = data.phone,
        address    = data.address,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ════════════════════════════════════════════════════════════════════════════
# 회원 정보 수정
# ════════════════════════════════════════════════════════════════════════════
async def update_me(db: AsyncSession, user_no: int, data) -> User:
    result = await db.execute(select(User).where(User.user_no == user_no))
    user: User | None = result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")

    if data.name is not None:
        user.name = data.name
    if data.phone is not None:
        user.phone = data.phone
    if data.address is not None:
        user.address = data.address
    if data.address_detail is not None:
        user.address_detail = data.address_detail
    if data.email is not None and data.email != user.email:
        dup = await db.execute(
            select(User).where(User.email == data.email, User.user_no != user_no)
        )
        if dup.scalars().first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 이메일입니다.")
        user.email = data.email

    if data.new_password:
        if not data.current_password:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "현재 비밀번호를 입력해주세요.")
        if not user.password or not verify_password(data.current_password, user.password):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "현재 비밀번호가 올바르지 않습니다.")
        user.password = hash_password(data.new_password)

    await db.commit()
    await db.refresh(user)
    return user


# ════════════════════════════════════════════════════════════════════════════
# 아이디 찾기
# ════════════════════════════════════════════════════════════════════════════
async def find_login_id(db: AsyncSession, email: str, name: str) -> str:
    """이메일 + 이름으로 아이디 조회 (뒷자리 마스킹)"""
    result = await db.execute(
        select(User).where(User.email == email, User.name == name)
    )
    user = result.scalars().first()
    if not user or not user.login_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "일치하는 회원 정보를 찾을 수 없습니다.")
    login_id = user.login_id
    return login_id[:2] + "*" * (len(login_id) - 2)


# ════════════════════════════════════════════════════════════════════════════
# 비밀번호 재설정
# ════════════════════════════════════════════════════════════════════════════
async def send_password_reset_code(db: AsyncSession, email: str) -> str:
    """가입된 이메일에만 재설정 코드 발송 (미가입이어도 동일 응답으로 이메일 노출 방지)"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user or not user.password:
        return "ok"  # 소셜 전용 계정 또는 미가입 — 조용히 무시

    # 기존 미인증 코드 만료
    existing = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.email == email, EmailVerification.verified_at.is_(None))
    )
    for row in existing.scalars().all():
        row.expires_at = datetime.now(timezone.utc).replace(tzinfo=None)

    code       = _generate_code()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=settings.EMAIL_CODE_EXPIRE_MINUTES)
    db.add(EmailVerification(email=email, code=code, expires_at=expires_at))
    await db.commit()

    message = MessageSchema(
        subject    = "[Road A Eye] 비밀번호 재설정 코드",
        recipients = [email],
        body       = _build_reset_email_html(code, settings.EMAIL_CODE_EXPIRE_MINUTES),
        subtype    = MessageType.html,
    )
    await _get_fastmail().send_message(message)
    return "ok"


async def reset_password(db: AsyncSession, email: str, code: str, new_password: str) -> None:
    """코드 검증 후 비밀번호 변경"""
    result = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.email == email, EmailVerification.verified_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
    )
    record = result.scalars().first()

    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드를 먼저 발송해주세요.")
    if record.is_expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 만료되었습니다.")
    if record.code != code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 올바르지 않습니다.")

    record.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")

    user.password = hash_password(new_password)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 로그인 (brute force 방지)
# ════════════════════════════════════════════════════════════════════════════
_MAX_LOGIN_ATTEMPTS = 5          # 최대 시도 횟수
_LOGIN_LOCK_SECONDS = 300        # 잠금 시간 (5분)
_login_attempts: dict[str, list[datetime]] = defaultdict(list)


def _check_rate_limit(login_id: str) -> None:
    """연속 실패 횟수 확인 → 초과 시 429 반환"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(seconds=_LOGIN_LOCK_SECONDS)
    # 만료된 기록 제거
    _login_attempts[login_id] = [t for t in _login_attempts[login_id] if t > cutoff]
    if len(_login_attempts[login_id]) >= _MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"로그인 시도가 {_MAX_LOGIN_ATTEMPTS}회를 초과했습니다. {_LOGIN_LOCK_SECONDS // 60}분 후 다시 시도해주세요.",
        )


async def login(db: AsyncSession, login_id: str, password: str) -> dict:
    _check_rate_limit(login_id)

    result = await db.execute(select(User).where(User.login_id == login_id))
    user: User | None = result.scalars().first()

    if not user or not user.password:
        _login_attempts[login_id].append(datetime.now(timezone.utc).replace(tzinfo=None))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.")
    if not verify_password(password, user.password):
        _login_attempts[login_id].append(datetime.now(timezone.utc).replace(tzinfo=None))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.")

    if not user.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "message": "정지된 계정입니다. 관리자에게 문의하세요.",
                "suspension_reason": user.suspension_reason or None,
            },
        )

    # 성공 시 실패 기록 초기화
    _login_attempts.pop(login_id, None)

    token = create_access_token(user.user_no, user.login_id, user.role)
    return {"token": token, "user": user}


# ════════════════════════════════════════════════════════════════════════════
# 이메일 변경
# ════════════════════════════════════════════════════════════════════════════
async def change_email(db: AsyncSession, user_no: int, new_email: str, code: str) -> User:
    """인증 코드 검증 후 이메일 변경"""
    result = await db.execute(
        select(EmailVerification)
        .where(EmailVerification.email == new_email, EmailVerification.verified_at.is_(None))
        .order_by(EmailVerification.created_at.desc())
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드를 먼저 발송해주세요.")
    if record.is_expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 만료되었습니다. 다시 발송해주세요.")
    if record.code != code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 올바르지 않습니다.")

    dup = await db.execute(
        select(User).where(User.email == new_email, User.user_no != user_no)
    )
    if dup.scalars().first():
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 이메일입니다.")

    user_result = await db.execute(select(User).where(User.user_no == user_no))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")

    record.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    user.email = new_email
    await db.commit()
    await db.refresh(user)
    return user


# ════════════════════════════════════════════════════════════════════════════
# 소셜 로그인
# ════════════════════════════════════════════════════════════════════════════
def get_naver_login_url() -> str:
    import secrets
    state = secrets.token_urlsafe(16)
    return (
        f"https://nid.naver.com/oauth2.0/authorize"
        f"?response_type=code"
        f"&client_id={settings.NAVER_CLIENT_ID}"
        f"&redirect_uri={quote(settings.NAVER_REDIRECT_URI, safe=':/')}"
        f"&state={state}"
    )


def get_kakao_login_url() -> str:
    return (
        f"https://kauth.kakao.com/oauth/authorize"
        f"?client_id={settings.KAKAO_REST_API_KEY}"
        f"&redirect_uri={quote(settings.KAKAO_REDIRECT_URI, safe=':/')}"
        f"&response_type=code"
    )


async def naver_callback(db: AsyncSession, code: str, state: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_res = await client.get(_NAVER_TOKEN_URL, params={
            "grant_type":    "authorization_code",
            "client_id":     settings.NAVER_CLIENT_ID,
            "client_secret": settings.NAVER_CLIENT_SECRET,
            "code":          code,
            "state":         state,
        })
        token_data = token_res.json()
        if "access_token" not in token_data:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "네이버 토큰 발급 실패")

        profile_res = await client.get(
            _NAVER_PROFILE_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        profile = profile_res.json().get("response", {})

    social_id = profile.get("id")
    if not social_id:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "네이버 사용자 정보 조회 실패")

    email = profile.get("email") or f"naver_{social_id}@naver.social"
    name  = profile.get("name") or email.split("@")[0]
    return await _social_login(db, "naver", str(social_id), email, name)


async def kakao_callback(db: AsyncSession, code: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_res = await client.post(_KAKAO_TOKEN_URL, data={
            "grant_type":    "authorization_code",
            "client_id":     settings.KAKAO_REST_API_KEY,
            "client_secret": settings.KAKAO_CLIENT_SECRET,
            "redirect_uri":  settings.KAKAO_REDIRECT_URI,
            "code":          code,
        })
        token_data = token_res.json()
        if "access_token" not in token_data:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "카카오 토큰 발급 실패")

        profile_res = await client.get(
            _KAKAO_PROFILE_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        profile = profile_res.json()

    social_id     = str(profile.get("id", ""))
    kakao_account = profile.get("kakao_account", {})
    email = kakao_account.get("email") or f"kakao_{social_id}@kakao.social"
    name  = kakao_account.get("profile", {}).get("nickname") or email.split("@")[0]
    return await _social_login(db, "kakao", social_id, email, name)


async def google_callback(db: AsyncSession, code: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_res = await client.post(_GOOGLE_TOKEN_URL, data={
            "grant_type":    "authorization_code",
            "client_id":     settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri":  settings.GOOGLE_REDIRECT_URI,
            "code":          code,
        })
        token_data = token_res.json()
        if "access_token" not in token_data:
            import logging
            logging.error(f"구글 토큰 발급 실패: {token_data}")
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"구글 토큰 발급 실패: {token_data}")

        profile_res = await client.get(
            _GOOGLE_PROFILE_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        profile = profile_res.json()

    social_id = str(profile.get("id", ""))
    email     = profile.get("email") or f"google_{social_id}@google.social"
    name      = profile.get("name") or email.split("@")[0]
    return await _social_login(db, "google", social_id, email, name)


def get_google_login_url() -> str:
    import secrets
    state = secrets.token_urlsafe(16)
    return (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={quote(settings.GOOGLE_REDIRECT_URI, safe=':/')}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&state={state}"
    )


async def _social_login(
    db: AsyncSession, provider: str, social_id: str, email: str, name: str
) -> dict:
    result = await db.execute(
        select(User).where(User.social_provider == provider, User.social_id == social_id)
    )
    user = result.scalars().first()

    if not user:
        # 같은 이메일로 가입된 기존 계정 확인 (일반 가입 또는 다른 소셜)
        email_result = await db.execute(select(User).where(User.email == email))
        existing = email_result.scalars().first()

        if existing:
            # 기존 계정에 소셜 정보 연결
            existing.social_provider = provider
            existing.social_id       = social_id
            await db.commit()
            await db.refresh(existing)
            user = existing
        else:
            user = User(
                login_id        = f"{provider}_{social_id}",
                password        = None,
                email           = email,
                name            = name,
                social_provider = provider,
                social_id       = social_id,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    # 기존 소셜 사용자가 placeholder 이름인 경우 업데이트
    _PLACEHOLDER_NAMES = {"사용자", "카카오사용자", "구글사용자", "네이버사용자"}
    if user.name in _PLACEHOLDER_NAMES and name not in _PLACEHOLDER_NAMES:
        user.name = name
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.user_no, user.login_id, user.role)
    return {"token": token, "user": user}



# ════════════════════════════════════════════════════════════════════════════
# 회원 탈퇴
# ════════════════════════════════════════════════════════════════════════════
async def delete_me(db: AsyncSession, user_no: int) -> None:
    from sqlalchemy import delete as sa_delete
    from models.orm import UserSetting
    result = await db.execute(select(User).where(User.user_no == user_no))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")
    await db.execute(sa_delete(UserSetting).where(UserSetting.user_no == user_no))
    await db.delete(user)
    await db.commit()

# ── 이메일 HTML ───────────────────────────────────────────────────────────────
def _build_email_html(code: str, expire_minutes: int) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Segoe UI',sans-serif;background:#f4f6fb;padding:40px;">
      <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;
                  padding:40px;box-shadow:0 4px 16px rgba(0,0,0,.08);">
        <h2 style="color:#1e40af;margin-bottom:8px;">Road A Eye</h2>
        <p style="color:#374151;margin-bottom:24px;">이메일 인증 코드입니다.</p>
        <div style="background:#eff6ff;border-radius:8px;padding:24px;text-align:center;
                    letter-spacing:12px;font-size:32px;font-weight:700;color:#1d4ed8;">
          {code}
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">
          ⏱ 이 코드는 <strong>{expire_minutes}분</strong> 동안 유효합니다.<br>
          본인이 요청하지 않은 경우 이 메일을 무시하세요.
        </p>
      </div>
    </body>
    </html>
    """


def _build_reset_email_html(code: str, expire_minutes: int) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Segoe UI',sans-serif;background:#f4f6fb;padding:40px;">
      <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;
                  padding:40px;box-shadow:0 4px 16px rgba(0,0,0,.08);">
        <h2 style="color:#1e40af;margin-bottom:8px;">Road A Eye</h2>
        <p style="color:#374151;margin-bottom:24px;">비밀번호 재설정 코드입니다.</p>
        <div style="background:#fef3c7;border-radius:8px;padding:24px;text-align:center;
                    letter-spacing:12px;font-size:32px;font-weight:700;color:#b45309;">
          {code}
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:20px;">
          ⏱ 이 코드는 <strong>{expire_minutes}분</strong> 동안 유효합니다.<br>
          본인이 요청하지 않은 경우 이 메일을 무시하세요.
        </p>
      </div>
    </body>
    </html>
    """

async def create_refresh_token_db(db: AsyncSession, user_no: int) -> str:
    from models.orm import RefreshToken
    from core.security import create_refresh_token, create_refresh_token_expiry
    token = create_refresh_token()
    rt = RefreshToken(user_no=user_no, token=token, expires_at=create_refresh_token_expiry())
    db.add(rt)
    await db.commit()
    return token


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict:
    from models.orm import RefreshToken
    from core.security import create_refresh_token, create_refresh_token_expiry
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
    rt = result.scalar_one_or_none()
    if not rt or not rt.is_valid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않거나 만료된 Refresh Token입니다.")
    user = await db.get(User, rt.user_no)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않은 사용자입니다.")
    rt.revoked = True
    new_token = create_refresh_token()
    new_rt = RefreshToken(user_no=user.user_no, token=new_token, expires_at=create_refresh_token_expiry())
    db.add(new_rt)
    await db.commit()
    access_token = create_access_token(user.user_no, user.login_id, user.role)
    return {"access_token": access_token, "refresh_token": new_token}


async def revoke_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    from models.orm import RefreshToken
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked = True
        await db.commit()
