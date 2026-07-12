from pydantic import BaseModel
from typing import List


class DetectionBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectionResult(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    box: DetectionBox


class YoloPredictResponse(BaseModel):
    success: bool
    message: str
    count: int
    results: List[DetectionResult]


class ItsStreamItem(BaseModel):
    cctvname: str
    coordx: str
    coordy: str
    cctvurl: str
    roadsectionid: str = ""


class ItsStreamsResponse(BaseModel):
    success: bool
    count: int
    streams: List[ItsStreamItem]