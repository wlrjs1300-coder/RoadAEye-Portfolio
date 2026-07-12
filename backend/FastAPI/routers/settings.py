"""
routers/settings.py
계정 설정 라우터

엔드포인트:
  GET/PUT /profile                        프로필 조회·수정
  PUT     /settings/email                 이메일 변경 (인증 코드 확인 후)
  GET/PUT /settings/notifications/push    푸시 알림 설정
  GET/PUT /settings/notifications/info    알림 정보 설정
  GET/PUT /settings/other                 그 외 설정
  GET     /settings/all                   전체 설정 한번에 조회
"""

from fastapi import APIRouter, Depends, Request

from core.database import get_member_db
from core.security import get_current_user
from schemas.auth_schema import ChangeEmailRequest, UserResponse, UserUpdate
from schemas.settings_schema import (
    EmailSettingsRequest,
    PushNotificationSettings,
    NotificationInfoSettings,
    OtherSettings,
)
from services import auth_service as svc
from services import settings_service as ssvc

router = APIRouter(prefix="/settings", tags=["Settings"])
profile_router = APIRouter(tags=["Settings"])


@profile_router.get("/profile", summary="프로필 조회", response_model=UserResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    from sqlalchemy import select
    from models.orm import User
    result = await db.execute(select(User).where(User.user_no == int(current_user["sub"])))
    user = result.scalars().first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return UserResponse.model_validate(user)


@profile_router.put("/profile", summary="프로필 수정", response_model=UserResponse)
async def update_profile(
    body:         UserUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    user = await svc.update_me(db, int(current_user["sub"]), body)
    return UserResponse.model_validate(user)


@profile_router.delete("/profile", summary="회원 탈퇴", status_code=200)
async def delete_profile(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    await svc.delete_me(db, int(current_user["sub"]))
    return {"success": True, "message": "회원 탈퇴가 완료되었습니다."}


@router.get("/email", summary="이메일 설정 조회")
async def get_email_settings(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.get_email_settings(db, int(current_user["sub"]))
    return {"success": True, "data": data}


@router.put("/email", summary="이메일 설정 변경 (마케팅 수신 동의)")
async def update_email_settings(
    body:         EmailSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.update_email_settings(db, int(current_user["sub"]), body)
    return {"success": True, "data": data}


# ════════════════════════════════════════════════════════════════════════════
# 전체 설정 한번에 조회
# ════════════════════════════════════════════════════════════════════════════

@router.get("/all", summary="전체 설정 조회")
async def get_all_settings(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.get_all_settings(db, int(current_user["sub"]))
    return {"success": True, "data": data}


# ════════════════════════════════════════════════════════════════════════════
# 푸시 알림 설정
# ════════════════════════════════════════════════════════════════════════════

@router.get("/notifications/push", summary="푸시 알림 설정 조회")
async def get_push(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.get_push_settings(db, int(current_user["sub"]))
    return {"success": True, "data": data}


@router.put("/notifications/push", summary="푸시 알림 설정 변경")
async def update_push(
    body:         PushNotificationSettings,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.update_push_settings(db, int(current_user["sub"]), body)
    return {"success": True, "data": data}


# ════════════════════════════════════════════════════════════════════════════
# 알림 정보 설정
# ════════════════════════════════════════════════════════════════════════════

@router.get("/notifications/info", summary="알림 정보 설정 조회")
async def get_notify_info(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.get_notification_info(db, int(current_user["sub"]))
    return {"success": True, "data": data}


@router.put("/notifications/info", summary="알림 정보 설정 변경")
async def update_notify_info(
    body:         NotificationInfoSettings,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.update_notification_info(db, int(current_user["sub"]), body)
    return {"success": True, "data": data}


# ════════════════════════════════════════════════════════════════════════════
# 그 외 설정
# ════════════════════════════════════════════════════════════════════════════

@router.get("/other", summary="그 외 설정 조회")
async def get_other(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.get_other_settings(db, int(current_user["sub"]))
    return {"success": True, "data": data}


@router.put("/other", summary="그 외 설정 변경")
async def update_other(
    body:         OtherSettings,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_member_db),
):
    data = await ssvc.update_other_settings(db, int(current_user["sub"]), body)
    return {"success": True, "data": data}
