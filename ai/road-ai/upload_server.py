"""임시 모델 파일 업로드 서버"""
import os, uvicorn
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import HTMLResponse

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
app = FastAPI()

HTML = """<!DOCTYPE html><html><head><meta charset=utf-8>
<title>모델 업로드 | Road-AI</title>
<style>
body{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#fff5f5}
h2{color:#e11d48;margin-bottom:4px}p{color:#666;margin-bottom:20px;font-size:14px}
.card{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.08);margin-bottom:16px}
label{display:block;margin-bottom:6px;font-weight:600;font-size:14px}
select,input[type=file]{width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;margin-bottom:16px;box-sizing:border-box}
button{background:#e11d48;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;width:100%}
button:hover{background:#be123c}.note{background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:20px}
</style></head><body>
<h2>🚗 Road-AI 모델 파일 업로드</h2>
<p>AI 서버(<AI_SERVER_IP>)에 학습 모델을 업로드합니다.</p>
<div class=note>
  <b>YOLO 파일:</b> yolov11m_v3_best.pt<br>
  <b>Keras 파일:</b> highway_model_v3_fp16.tflite
</div>
<div class=card>
  <form action=/upload method=post enctype=multipart/form-data>
    <label>모델 타입 선택</label>
    <select name=model_type>
      <option value=yolo>YOLO v3 &nbsp;→&nbsp; models/yolo/v3/</option>
      <option value=keras>Keras v3 &nbsp;→&nbsp; models/keras/v3/</option>
    </select>
    <label>파일 선택</label>
    <input type=file name=file accept=".pt,.tflite,.keras,.h5" required>
    <button type=submit>업로드 시작</button>
  </form>
</div>
</body></html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

@app.post("/upload", response_class=HTMLResponse)
async def upload(model_type: str = Form(...), file: UploadFile = File(...)):
    dest_dir = os.path.join(UPLOAD_DIR, model_type, "v3")
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, file.filename)
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)
    size_mb = len(content) / 1024 / 1024
    return f"""<!DOCTYPE html><html><head><meta charset=utf-8><title>업로드 완료</title>
<style>body{{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px}}
.ok{{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:24px;text-align:center}}
h2{{color:#16a34a}}a{{color:#e11d48;font-weight:bold}}</style></head><body>
<div class=ok><h2>✅ 업로드 완료!</h2>
<p><b>{file.filename}</b></p>
<p>저장 위치: <code>{dest_path}</code></p>
<p>파일 크기: <b>{size_mb:.1f} MB</b></p>
<p><a href='/'>← 다른 파일 업로드</a></p></div>
</body></html>"""

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9999)
