from pydantic import BaseModel


class ClassifyResponse(BaseModel):
    vehicle_class: str
    class_index: int
    confidence: float
    is_prohibited: bool
    prohibited_prob: float
    alert: str


class AlertItem(BaseModel):
    time: str
    type: str
    confidence: float


class StatsResponse(BaseModel):
    total: int
    prohibited: int
    allowed: int
    by_type: dict[str, int]
    recent_alerts: list[AlertItem]


class ModelInfoResponse(BaseModel):
    version: str
    backbone: str
    classes: list[str]
    prohibited: list[str]
    allowed: list[str]
    trained_at: str
    description: str
    status: str
