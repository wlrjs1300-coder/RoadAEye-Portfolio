"""
services/model_service.py
AI 모델 버전 관리 비즈니스 로직

주요 기능:
- 모델 버전 등록 / 조회 / 수정 / 삭제
- 서비스 중 모델 활성화 (is_active = 1, 기존 활성 모델은 자동 비활성)
- 모델명별 버전 목록 조회
- 성능 지표(Precision / Recall / mAP) 비교
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.model_orm import ModelVersion
from schemas.model_schema import ModelVersionCreate, ModelVersionUpdate


# ════════════════════════════════════════════════════════════════════════════
# 조회
# ════════════════════════════════════════════════════════════════════════════
async def get_model_versions(
    db:         AsyncSession,
    model_name: Optional[str] = None,   # 특정 모델명 필터
    active_only: bool         = False,  # 활성 모델만
    page:        int          = 1,
    per_page:    int          = 20,
) -> dict:
    stmt = select(ModelVersion)

    if model_name:
        stmt = stmt.where(ModelVersion.model_name == model_name)
    if active_only:
        stmt = stmt.where(ModelVersion.is_active == 1)

    stmt = stmt.order_by(ModelVersion.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar()

    rows = (await db.execute(
        stmt.offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {
        "items":    [_to_dict(m) for m in rows],
        "total":    total,
        "page":     page,
        "pages":    -(-total // per_page),
        "per_page": per_page,
    }


async def get_model_version(db: AsyncSession, version_no: int) -> ModelVersion:
    result = await db.execute(
        select(ModelVersion).where(ModelVersion.version_no == version_no)
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "모델 버전을 찾을 수 없습니다.")
    return model


async def get_active_model(
    db: AsyncSession, model_name: Optional[str] = None
) -> list[ModelVersion]:
    """
    현재 서비스 중인 모델 조회.
    model_name 지정 시 해당 모델의 활성 버전만 반환.
    """
    stmt = select(ModelVersion).where(ModelVersion.is_active == 1)
    if model_name:
        stmt = stmt.where(ModelVersion.model_name == model_name)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_model_names(db: AsyncSession) -> list[str]:
    """등록된 모델명 목록 (중복 제거)"""
    result = await db.execute(
        select(ModelVersion.model_name).distinct().order_by(ModelVersion.model_name)
    )
    return [row[0] for row in result.all()]


async def compare_versions(
    db: AsyncSession, model_name: str
) -> list[dict]:
    """
    특정 모델의 전체 버전 성능 지표 비교.
    mAP 기준 내림차순 정렬.
    """
    result = await db.execute(
        select(ModelVersion)
        .where(ModelVersion.model_name == model_name)
        .order_by(ModelVersion.map_score.desc().nullslast())
    )
    versions = result.scalars().all()

    if not versions:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"'{model_name}' 모델의 버전이 없습니다.",
        )

    return [_to_dict(v) for v in versions]


# ════════════════════════════════════════════════════════════════════════════
# 등록
# ════════════════════════════════════════════════════════════════════════════
async def create_model_version(
    db: AsyncSession, data: ModelVersionCreate
) -> ModelVersion:
    # 동일 모델명 + 버전 중복 확인
    dup = await db.execute(
        select(ModelVersion).where(
            ModelVersion.model_name == data.model_name,
            ModelVersion.version    == data.version,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"'{data.model_name} {data.version}'은 이미 등록된 버전입니다.",
        )

    model = ModelVersion(**data.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


# ════════════════════════════════════════════════════════════════════════════
# 수정
# ════════════════════════════════════════════════════════════════════════════
async def update_model_version(
    db: AsyncSession, version_no: int, data: ModelVersionUpdate
) -> ModelVersion:
    model = await get_model_version(db, version_no)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(model, field, value)
    await db.commit()
    await db.refresh(model)
    return model


# ════════════════════════════════════════════════════════════════════════════
# 활성화 (배포 전환)
# ════════════════════════════════════════════════════════════════════════════
async def activate_model(db: AsyncSession, version_no: int) -> ModelVersion:
    """
    특정 버전을 활성 모델로 전환.

    - 같은 model_name의 기존 활성 모델을 모두 비활성(is_active=0)으로 변경
    - 선택한 버전만 is_active=1 로 설정
    → 동일 모델명 내에서 항상 1개만 활성 상태 유지
    """
    target = await get_model_version(db, version_no)

    if target.is_active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "이미 활성화된 모델입니다.",
        )

    # 같은 model_name의 기존 활성 모델 비활성화
    existing_active = await db.execute(
        select(ModelVersion).where(
            ModelVersion.model_name == target.model_name,
            ModelVersion.is_active  == 1,
        )
    )
    for m in existing_active.scalars().all():
        m.is_active = 0

    target.is_active = 1
    await db.commit()
    await db.refresh(target)
    return target


async def deactivate_model(db: AsyncSession, version_no: int) -> ModelVersion:
    """활성 모델 비활성화"""
    model = await get_model_version(db, version_no)
    if not model.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 비활성화된 모델입니다.")
    model.is_active = 0
    await db.commit()
    await db.refresh(model)
    return model


# ════════════════════════════════════════════════════════════════════════════
# 삭제
# ════════════════════════════════════════════════════════════════════════════
async def delete_model_version(db: AsyncSession, version_no: int) -> None:
    model = await get_model_version(db, version_no)
    if model.is_active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "서비스 중인 모델은 삭제할 수 없습니다. 먼저 비활성화 후 삭제하세요.",
        )
    await db.delete(model)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 내부 헬퍼
# ════════════════════════════════════════════════════════════════════════════
def _to_dict(m: ModelVersion) -> dict:
    return {
        "version_no":      m.version_no,
        "model_name":      m.model_name,
        "version":         m.version,
        "trained_at":      m.trained_at.isoformat() if m.trained_at else None,
        "precision_score": float(m.precision_score) if m.precision_score is not None else None,
        "recall_score":    float(m.recall_score)    if m.recall_score    is not None else None,
        "map_score":       float(m.map_score)        if m.map_score       is not None else None,
        "model_path":      m.model_path,
        "notes":           m.notes,
        "is_active":       bool(m.is_active),
        "created_at":      m.created_at.isoformat() if m.created_at else None,
    }
