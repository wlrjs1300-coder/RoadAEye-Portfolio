import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.events import lifespan
from app.common.exceptions import (
    ModelNotLoadedError,
    InvalidImageError,
    model_not_loaded_handler,
    invalid_image_handler,
    general_exception_handler,
)
from app.api.v1 import yolo as yolo_router
from app.api.v1 import its as its_router
from app.api.v1 import keras as keras_router

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ModelNotLoadedError, model_not_loaded_handler)
app.add_exception_handler(InvalidImageError, invalid_image_handler)
app.add_exception_handler(Exception, general_exception_handler)

from app.api.deps import verify_api_key
app.include_router(yolo_router.router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(keras_router.router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
app.include_router(its_router.router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])


os.makedirs("uploads/detections", exist_ok=True)
app.mount("/images", StaticFiles(directory="uploads/detections"), name="images")

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/health")
async def health():
    """서버 상태 확인"""
    return {"status": "ok", "service": settings.app_name}


# ── 임시 모델 업로드 엔드포인트 (파일 전송용) ──────────────────────────────
from fastapi import File, UploadFile, Form
from fastapi.responses import HTMLResponse

_UPLOAD_PAGE = """<!DOCTYPE html><html><head><meta charset=utf-8>
<title>모델 업로드 | Road-AI</title>
<style>body{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#fff5f5}
h2{color:#e11d48}p{color:#666;font-size:14px}
.card{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.08);margin-bottom:16px}
label{display:block;margin-bottom:6px;font-weight:600;font-size:14px}
select,input[type=file]{width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;margin-bottom:16px;box-sizing:border-box}
button{background:#e11d48;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;width:100%}
.note{background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:20px}
</style></head><body>
<h2>🚗 Road-AI 모델 파일 업로드</h2>
<p>AI 서버에 학습 완료된 모델 파일을 업로드합니다.</p>
<div class=note>
<b>YOLO:</b> yolov11m_v3_best.pt → models/yolo/v3/<br>
<b>Keras:</b> highway_model_v3_fp16.tflite → models/keras/v3/
</div>
<div class=card>
<form action=/model-upload method=post enctype=multipart/form-data>
  <label>모델 타입</label>
  <select name=model_type>
    <option value=yolo>YOLO v3 (yolo/v3/)</option>
    <option value=keras>Keras v3 (keras/v3/)</option>
  </select>
  <label>파일 선택 (.pt / .tflite)</label>
  <input type=file name=file accept=".pt,.tflite,.keras,.h5" required>
  <button type=submit>업로드</button>
</form>
</div></body></html>"""

@app.get("/model-upload", response_class=HTMLResponse)
async def upload_page():
    return _UPLOAD_PAGE

@app.post("/model-upload", response_class=HTMLResponse)
async def upload_model(model_type: str = Form(...), file: UploadFile = File(...)):
    import pathlib
    dest_dir = pathlib.Path(f"models/{model_type}/v3")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file.filename
    content = await file.read()
    dest_path.write_bytes(content)
    size_mb = len(content) / 1024 / 1024
    return f"""<!DOCTYPE html><html><head><meta charset=utf-8><title>완료</title>
<style>body{{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px}}
.ok{{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:24px;text-align:center}}
h2{{color:#16a34a}}a{{color:#e11d48;font-weight:bold}}</style></head><body>
<div class=ok><h2>✅ 업로드 완료!</h2>
<p><b>{file.filename}</b></p>
<p>저장 경로: <code>{dest_path}</code></p>
<p>파일 크기: <b>{size_mb:.1f} MB</b></p>
<p><a href='/model-upload'>← 다른 파일 업로드</a></p></div>
</body></html>"""


# ── 데모 영상 교체 엔드포인트 ───────────────────────────────────────────────
_DEMO_UPLOAD_PAGE = """<!DOCTYPE html><html><head><meta charset=utf-8>
<title>시연 영상 교체 | Road-AI</title>
<style>body{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#fff5f5}
h2{color:#e11d48}p{color:#666;font-size:14px}
.card{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.08);margin-bottom:16px}
label{display:block;margin-bottom:6px;font-weight:600;font-size:14px}
input[type=file]{width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;margin-bottom:16px;box-sizing:border-box}
button{background:#e11d48;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;width:100%}
.note{background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:20px}
</style></head><body>
<h2>🎬 시연 영상 교체</h2>
<p>대시보드 시연용 CCTV 영상을 교체합니다. 업로드 즉시 스트림이 새 영상으로 전환됩니다.</p>
<div class=note>
<b>지원 형식:</b> MP4, WebM, AVI<br>
<b>권장:</b> 진입금지 차량(지게차, 굴착기, 오토바이 등)이 포함된 고속도로 영상
</div>
<div class=card>
<form action=/demo-upload method=post enctype=multipart/form-data>
  <label>새 시연 영상 선택</label>
  <input type=file name=file accept=".mp4,.webm,.avi,.mov" required>
  <button type=submit>🔄 영상 교체</button>
</form>
</div></body></html>"""

@app.get("/demo-upload", response_class=HTMLResponse)
async def demo_upload_page():
    return _DEMO_UPLOAD_PAGE

@app.post("/demo-upload", response_class=HTMLResponse)
async def demo_upload_video(file: UploadFile = File(...)):
    import pathlib
    from app.modules.its.service import manager

    demo_dir = pathlib.Path("uploads/demo")
    demo_dir.mkdir(parents=True, exist_ok=True)
    demo_path = demo_dir / "demo_prohibited.mp4"

    content = await file.read()
    demo_path.write_bytes(content)
    size_mb = len(content) / 1024 / 1024

    # 기존 데모 스트림 중지 후 새 영상으로 재시작
    DEMO_CAM_ID = "demo-prohibited-vehicle"
    manager.stop_stream(DEMO_CAM_ID)
    import asyncio
    await asyncio.sleep(1)
    manager.start_stream(
        camera_id=DEMO_CAM_ID,
        stream_url=str(demo_path.resolve()),
        name="[시연용] 진입금지 차량 탐지 데모",
    )

    return f"""<!DOCTYPE html><html><head><meta charset=utf-8><title>교체 완료</title>
<style>body{{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px}}
.ok{{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:24px;text-align:center}}
h2{{color:#16a34a}}p{{color:#555;font-size:14px}}a{{color:#e11d48;font-weight:bold}}</style></head><body>
<div class=ok>
<h2>✅ 시연 영상 교체 완료!</h2>
<p><b>{file.filename}</b> ({size_mb:.1f} MB)</p>
<p>대시보드 스트림이 새 영상으로 전환됐습니다.</p>
<p><a href='/demo-upload'>← 다시 교체하기</a></p>
</div></body></html>"""
