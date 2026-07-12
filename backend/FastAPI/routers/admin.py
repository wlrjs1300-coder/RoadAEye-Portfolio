"""
routers/admin.py
관리자 전용 라우터 (role=admin 필수)

엔드포인트:
  [사용자 관리]
  GET    /admin/users                사용자 목록 (검색·페이지)
  GET    /admin/users/{user_no}      사용자 상세
  PATCH  /admin/users/{user_no}/role 역할 변경
  DELETE /admin/users/{user_no}      계정 삭제

  [로그 조회]
  GET    /admin/logs                 활동 로그 목록 (필터·페이지)
  PATCH  /admin/users/{user_no}/status 계정 활성화/비활성화

  [시스템 설정]
  GET    /admin/system               시스템 설정 조회
  PUT    /admin/system               시스템 설정 변경
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from core.database import get_member_db
from core.security import get_current_user
from schemas.admin_schema import (
    AdminUserResponse, AdminUserListResponse,
    RoleUpdateRequest, StatusUpdateRequest,
    ActivityLogListResponse,
    SystemConfigResponse, SystemConfigUpdate,
)
from services import admin_service as svc

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── 관리자 권한 검사 dependency ───────────────────────────────────────────────
async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한이 필요합니다.")
    return current_user


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ════════════════════════════════════════════════════════════════════════════
# 사용자 관리
# ════════════════════════════════════════════════════════════════════════════

@router.get("/users", summary="사용자 목록")
async def list_users(
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    search:   Optional[str] = Query(None, description="이름·아이디·이메일 검색"),
    role:     Optional[str] = Query(None, description="user | admin"),
    _admin  = Depends(get_admin_user),
    db      = Depends(get_member_db),
):
    result = await svc.get_users(db, page=page, per_page=per_page, search=search, role=role)
    return {
        "success": True,
        "data": AdminUserListResponse(
            users    = [AdminUserResponse.model_validate(u) for u in result["users"]],
            total    = result["total"],
            page     = result["page"],
            pages    = result["pages"],
            per_page = result["per_page"],
        ),
    }


@router.get("/users/{user_no}", summary="사용자 상세")
async def get_user(
    user_no: int,
    _admin = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    user = await svc.get_user(db, user_no)
    return {"success": True, "data": AdminUserResponse.model_validate(user)}


@router.patch("/users/{user_no}/role", summary="사용자 역할 변경")
async def update_role(
    user_no: int,
    body:    RoleUpdateRequest,
    request: Request,
    admin  = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    user = await svc.update_user_role(
        db, user_no, body,
        admin_no=int(admin["sub"]), admin_id=admin["login_id"],
        ip_address=_ip(request),
    )
    return {"success": True, "message": "역할이 변경되었습니다.", "data": AdminUserResponse.model_validate(user)}


@router.delete("/users/{user_no}", summary="사용자 계정 삭제", status_code=200)
async def delete_user(
    user_no: int,
    request: Request,
    admin  = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    await svc.delete_user(
        db, user_no,
        admin_no=int(admin["sub"]), admin_id=admin["login_id"],
        ip_address=_ip(request),
    )
    return {"success": True, "message": "계정이 삭제되었습니다."}



@router.patch("/users/{user_no}/status", summary="계정 활성화/비활성화")
async def toggle_status(
    user_no: int,
    body:    StatusUpdateRequest,
    request: Request,
    admin  = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    user = await svc.toggle_user_status(
        db, user_no, body.is_active,
        admin_no=int(admin["sub"]), admin_id=admin["login_id"],
        ip_address=_ip(request),
        suspension_reason=body.suspension_reason,
    )
    state = "활성화" if body.is_active else "정지"
    return {"success": True, "message": f"계정이 {state}되었습니다.", "data": AdminUserResponse.model_validate(user)}

# ════════════════════════════════════════════════════════════════════════════
# 로그 조회
# ════════════════════════════════════════════════════════════════════════════

@router.get("/logs", summary="활동 로그 목록")
async def list_logs(
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(30, ge=1, le=100),
    action:   Optional[str] = Query(None, description="LOGIN | USER_DELETE | USER_ROLE_CHANGE | SYSTEM_CONFIG_UPDATE"),
    login_id: Optional[str] = Query(None),
    _admin  = Depends(get_admin_user),
    db      = Depends(get_member_db),
):
    result = await svc.get_logs(db, page=page, per_page=per_page, action=action, login_id=login_id)
    return {
        "success": True,
        "data": ActivityLogListResponse(
            logs     = result["logs"],
            total    = result["total"],
            page     = result["page"],
            pages    = result["pages"],
            per_page = result["per_page"],
        ),
    }


# ════════════════════════════════════════════════════════════════════════════
# 시스템 설정
# ════════════════════════════════════════════════════════════════════════════

@router.get("/system", summary="시스템 설정 조회")
async def get_system(
    _admin = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    cfg = await svc.get_system_config(db)
    return {"success": True, "data": SystemConfigResponse.model_validate(cfg)}


@router.put("/system", summary="시스템 설정 변경")
async def update_system(
    body:    SystemConfigUpdate,
    request: Request,
    admin  = Depends(get_admin_user),
    db     = Depends(get_member_db),
):
    cfg = await svc.update_system_config(
        db, body,
        admin_no=int(admin["sub"]), admin_id=admin["login_id"],
        ip_address=_ip(request),
    )
    return {"success": True, "message": "시스템 설정이 변경되었습니다.", "data": SystemConfigResponse.model_validate(cfg)}
