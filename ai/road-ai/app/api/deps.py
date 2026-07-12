from fastapi import Header, HTTPException, status
from app.core.config import settings

async def verify_api_key(x_api_key: str = Header(default=None)):
    if not settings.ai_api_key:
        return
    if x_api_key != settings.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key",
        )
