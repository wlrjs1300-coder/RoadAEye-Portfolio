"""
schemas/auth_schema.py
회원가입 / 로그인 Pydantic 스키마
"""

import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

_RE_LOGIN_ID = re.compile(r"^[a-zA-Z0-9_]{4,50}$")
_RE_PASSWORD = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]).{8,}$")
_RE_PHONE    = re.compile(r"^01[0-9]-?\d{3,4}-?\d{4}$")


# ── 이메일 인증 ───────────────────────────────────────────────────────────────
class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code:  str = Field(..., min_length=6, max_length=6, description="6자리 인증 코드")


# ── 중복 확인 ─────────────────────────────────────────────────────────────────
class CheckLoginIdRequest(BaseModel):
    login_id: str


# ── 회원가입 ─────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    login_id:   str      = Field(..., description="영문·숫자·밑줄 4~50자")
    password:   str      = Field(..., description="8자 이상, 영문+숫자+특수문자")
    email:      EmailStr
    name:       str      = Field(..., min_length=2, max_length=50)
    birth_date: date     = Field(..., description="YYYY-MM-DD")
    phone:      Optional[str] = None
    address:    Optional[str] = None

    @field_validator("login_id")
    @classmethod
    def validate_login_id(cls, v: str) -> str:
        if not _RE_LOGIN_ID.match(v):
            raise ValueError("아이디는 영문·숫자·밑줄(_) 4~50자여야 합니다.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not _RE_PASSWORD.match(v):
            raise ValueError("비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and not _RE_PHONE.match(v):
            raise ValueError("올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)")
        return v


# ── 회원 정보 수정 ────────────────────────────────────────────────────────────
class UserUpdate(BaseModel):
    name:             Optional[str] = Field(default=None, min_length=2, max_length=50)
    phone:            Optional[str] = None
    address:          Optional[str] = None
    address_detail:   Optional[str] = None
    email:            Optional[str] = None
    current_password: Optional[str] = None
    new_password:     Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and not _RE_PHONE.match(v):
            raise ValueError("올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)")
        return v

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: Optional[str]) -> Optional[str]:
        if v and not _RE_PASSWORD.match(v):
            raise ValueError("비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.")
        return v


# ── 아이디 찾기 ──────────────────────────────────────────────────────────────
class FindLoginIdRequest(BaseModel):
    email: EmailStr
    name:  str = Field(..., min_length=2, max_length=50)


# ── 비밀번호 재설정 ───────────────────────────────────────────────────────────
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email:        EmailStr
    code:         str  = Field(..., min_length=6, max_length=6)
    new_password: str  = Field(..., description="새 비밀번호")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not _RE_PASSWORD.match(v):
            raise ValueError("비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.")
        return v


# ── 설정 ─────────────────────────────────────────────────────────────────────
class ChangeEmailRequest(BaseModel):
    email: EmailStr
    code:  str = Field(..., min_length=6, max_length=6, description="새 이메일로 받은 6자리 인증 코드")


# ── 로그인 ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    login_id: str
    password: str


# ── 응답 ─────────────────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    user_no:    int
    login_id:   str
    email:      Optional[str]
    name:       str
    birth_date: Optional[date]
    phone:      Optional[str]
    address:         Optional[str]
    address_detail:  Optional[str] = None
    role:       str
    created_at: datetime

    model_config = {"from_attributes": True}


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user:          UserResponse
