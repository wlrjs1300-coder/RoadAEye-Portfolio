from fastapi import Request
from fastapi.responses import JSONResponse


class ModelNotLoadedError(Exception):
    pass


class InvalidImageError(Exception):
    pass


async def model_not_loaded_handler(request: Request, exc: ModelNotLoadedError):
    return JSONResponse(
        status_code=503,
        content={"error": "모델이 로드되지 않았습니다. 잠시 후 다시 시도해주세요."},
    )


async def invalid_image_handler(request: Request, exc: InvalidImageError):
    return JSONResponse(
        status_code=400,
        content={"error": f"이미지 처리 오류: {exc}"},
    )


async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
    )
