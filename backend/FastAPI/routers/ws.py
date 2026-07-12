"""
routers/ws.py
WebSocket 라우터 — 실시간 감지 알림

엔드포인트:
  WS  /ws/detections   감지 알림 실시간 수신 (로그인 필수)

사용 예시 (React):
  const ws = new WebSocket(
    `ws://서버주소/ws/detections?token=${accessToken}`
  );
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    // data.type === 'detection' 일 때 알림 표시
  };
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status

from core.security import decode_token
from services.ws_service import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/detections")
async def detection_ws(
    websocket: WebSocket,
    token: str = Query(..., description="JWT 액세스 토큰"),
):
    """
    JWT 토큰으로 인증 후 WebSocket 연결 유지.
    AI 서버가 새 감지를 저장할 때마다 JSON 메시지가 푸시됩니다.

    메시지 포맷:
    {
      "type": "detection",
      "data": {
        "detection_no": 1,
        "cctv_no": 3,
        "cctv_name": "경부고속도로 1-1",
        "class_name": "보행자",
        "confidence": 0.92,
        "detected_at": "2025-05-15T10:30:00"
      }
    }
    """
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # 연결 유지 (클라이언트 ping 수신)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
