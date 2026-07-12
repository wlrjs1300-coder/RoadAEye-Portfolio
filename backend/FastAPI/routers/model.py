"""
routers/model.py
AI 모델 버전 관리 라우터

엔드포인트:
──────────────────────────────────────────────────────────
[버전 관리]
  GET    /models                      버전 목록 (필터+페이지)
  POST   /models                      버전 등록
  GET    /models/{version_no}         버전 단일 조회
  PUT    /models/{version_no}         버전 수정 (성능 지표, 비고)
  DELETE /models/{version_no}         버전 삭제 (비활성 모델만)

[배포 관리]
  PATCH  /models/{version_no}/activate    활성화 (서비스 전환)
  PATCH  /models/{version_no}/deactivate  비활성화

[조회/분석]
  GET    /models/active               현재 서비스 중인 모델 목록
  GET    /models/names                등록된 모델명 목록
  GET    /models/compare/{model_name} 버전별 성능 지표 비교
──────────────────────────────────────────────────────────
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.database import get_ai_db
from core.security import get_current_user
from schemas.model_schema import ModelVersionCreate, ModelVersionUpdate
from services import model_service as svc

router = APIRouter(prefix="/models", tags=["AI Models"])


# ════════════════════════════════════════════════════════════════════════════
# 버전 목록 / 등록 / 조회 / 수정 / 삭제
# ════════════════════════════════════════════════════════════════════════════

@router.get("", summary="AI 모델 버전 목록")
async def list_model_versions(
    model_name:  Optional[str] = Query(default=None, description="모델명 필터 (예: yolov8-roadeye)"),
    active_only: bool          = Query(default=False, description="서비스 중인 모델만 조회"),
    page:        int           = Query(default=1,  ge=1),
    per_page:    int           = Query(default=20, ge=1, le=100),
    db=Depends(get_ai_db),
):
    result = await svc.get_model_versions(
        db,
        model_name  = model_name,
        active_only = active_only,
        page        = page,
        per_page    = per_page,
    )
    return {"success": True, "data": result}


@router.post("", status_code=201, summary="AI 모델 버전 등록")
async def create_model_version(
    body: ModelVersionCreate,
    db=Depends(get_ai_db),
    _=Depends(get_current_user),
):
    model = await svc.create_model_version(db, body)
    return {
        "success": True,
        "message": f"'{model.model_name} {model.version}' 버전이 등록되었습니다.",
        "data":    svc._to_dict(model),
    }


@router.get("/active", summary="현재 서비스 중인 모델 조회")
async def get_active_models(
    model_name: Optional[str] = Query(default=None, description="모델명 필터"),
    db=Depends(get_ai_db),
):
    models = await svc.get_active_model(db, model_name=model_name)
    return {"success": True, "data": {"models": [svc._to_dict(m) for m in models]}}


@router.get("/names", summary="등록된 모델명 목록")
async def get_model_names(db=Depends(get_ai_db)):
    names = await svc.get_model_names(db)
    return {"success": True, "data": {"model_names": names}}


@router.get("/compare/{model_name}", summary="버전별 성능 지표 비교 (mAP 기준 정렬)")
async def compare_versions(model_name: str, db=Depends(get_ai_db)):
    data = await svc.compare_versions(db, model_name=model_name)
    return {"success": True, "data": {"model_name": model_name, "versions": data}}


@router.get("/{version_no}", summary="AI 모델 버전 단일 조회")
async def get_model_version(version_no: int, db=Depends(get_ai_db)):
    model = await svc.get_model_version(db, version_no)
    return {"success": True, "data": svc._to_dict(model)}


@router.put("/{version_no}", summary="AI 모델 버전 수정 (성능 지표 / 비고)")
async def update_model_version(
    version_no: int,
    body:       ModelVersionUpdate,
    db=Depends(get_ai_db),
    _=Depends(get_current_user),
):
    model = await svc.update_model_version(db, version_no, body)
    return {"success": True, "message": "수정되었습니다.", "data": svc._to_dict(model)}


@router.delete("/{version_no}", summary="AI 모델 버전 삭제 (비활성 모델만 가능)")
async def delete_model_version(
    version_no: int,
    db=Depends(get_ai_db),
    _=Depends(get_current_user),
):
    await svc.delete_model_version(db, version_no)
    return {"success": True, "message": "삭제되었습니다."}


# ════════════════════════════════════════════════════════════════════════════
# 배포 관리
# ════════════════════════════════════════════════════════════════════════════

@router.patch("/{version_no}/activate", summary="모델 활성화 (서비스 전환)")
async def activate_model(
    version_no: int,
    db=Depends(get_ai_db),
    _=Depends(get_current_user),
):
    """
    선택한 버전을 서비스 중 모델로 전환합니다.
    같은 model_name의 기존 활성 모델은 자동으로 비활성화됩니다.
    """
    model = await svc.activate_model(db, version_no)
    return {
        "success": True,
        "message": f"'{model.model_name} {model.version}'이 활성화되었습니다.",
        "data":    svc._to_dict(model),
    }


@router.patch("/{version_no}/deactivate", summary="모델 비활성화")
async def deactivate_model(
    version_no: int,
    db=Depends(get_ai_db),
    _=Depends(get_current_user),
):
    model = await svc.deactivate_model(db, version_no)
    return {
        "success": True,
        "message": f"'{model.model_name} {model.version}'이 비활성화되었습니다.",
        "data":    svc._to_dict(model),
    }
