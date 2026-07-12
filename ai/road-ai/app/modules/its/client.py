from typing import List

import httpx

from app.core.config import settings
from app.common.logger import logger
from app.modules.its.schemas import ItsCamera


async def fetch_cameras(
    min_x: float = 126.0,
    max_x: float = 130.0,
    min_y: float = 34.0,
    max_y: float = 38.5,
) -> List[ItsCamera]:
    params = {
        "apiKey": settings.its_api_key,
        "type": "1",
        "cctvType": "2",
        "minX": str(min_x),
        "maxX": str(max_x),
        "minY": str(min_y),
        "maxY": str(max_y),
        "getType": "json",
    }
    async with httpx.AsyncClient(verify=False) as client:
        response = await client.get(
            settings.its_api_base_url, params=params, timeout=10.0
        )
        response.raise_for_status()
        data = response.json()

    items = data.get("response", {}).get("data", [])
    cameras = []
    for item in items:
        cameras.append(
            ItsCamera(
                camera_id=item.get("roadsectionid") or item.get("cctvname", ""),
                name=item.get("cctvname", ""),
                coord_x=str(item.get("coordx", "")),
                coord_y=str(item.get("coordy", "")),
                stream_url=item.get("cctvurl", ""),
                road_section_id=item.get("roadsectionid", ""),
            )
        )

    logger.info(f"ITS API 카메라 {len(cameras)}개 조회 완료")
    return cameras
