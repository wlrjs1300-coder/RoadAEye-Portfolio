"""
schemas/model_schema.py
AI 모델 버전 관리 Pydantic 요청/응답 스키마
"""

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field


class ModelVersionCreate(BaseModel):
    model_config = {"protected_namespaces": ()}

    model_name:      str            = Field(..., min_length=1, max_length=100, description="모델명 (예: yolov8-roadeye)")
    version:         str            = Field(..., min_length=1, max_length=50,  description="버전 (예: v1.0.0)")
    trained_at:      date           = Field(..., description="학습 완료일 (YYYY-MM-DD)")
    precision_score: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Precision 정밀도")
    recall_score:    Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Recall 재현율")
    map_score:       Optional[float] = Field(default=None, ge=0.0, le=1.0, description="mAP 평균 정밀도")
    model_path:      str            = Field(..., min_length=1, max_length=500, description="가중치 파일 경로")
    notes:           Optional[str]  = Field(default=None, description="비고 (변경점, 학습 조건 등)")


class ModelVersionUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}

    precision_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    recall_score:    Optional[float] = Field(default=None, ge=0.0, le=1.0)
    map_score:       Optional[float] = Field(default=None, ge=0.0, le=1.0)
    model_path:      Optional[str]   = Field(default=None, max_length=500)
    notes:           Optional[str]   = None


class ModelVersionResponse(BaseModel):
    model_config = {"from_attributes": True, "protected_namespaces": ()}

    version_no:      int
    model_name:      str
    version:         str
    trained_at:      date
    precision_score: Optional[float]
    recall_score:    Optional[float]
    map_score:       Optional[float]
    model_path:      str
    notes:           Optional[str]
    is_active:       bool
    created_at:      datetime