"""
routers/chat.py
AI 챗봇 라우터

엔드포인트:
──────────────────────────────────────────────────────────
[세션 관리]
  GET    /chat/sessions              내 세션 목록
  GET    /chat/sessions/{no}         세션 + 전체 메시지 조회
  DELETE /chat/sessions/{no}         세션 삭제

[채팅]
  POST   /chat                       일반 채팅 (단일 응답)
  GET    /chat/stream                스트리밍 채팅 (SSE)
──────────────────────────────────────────────────────────
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional

from core.database import get_chat_db
from core.security import get_current_user
from schemas.chat_schema import ChatRequest
from services import chat_service as svc

router = APIRouter(prefix="/chat", tags=["Chat"])


# ════════════════════════════════════════════════════════════════════════════
# 세션 관리
# ════════════════════════════════════════════════════════════════════════════

@router.get("/sessions", summary="내 대화 세션 목록")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_chat_db),
):
    sessions = await svc.get_sessions(db, user_no=int(current_user["sub"]))
    return {"success": True, "data": {"sessions": sessions}}


@router.get("/sessions/{session_no}", summary="세션 상세 조회 (전체 메시지 포함)")
async def get_session(
    session_no:   int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_chat_db),
):
    session = await svc.get_session_with_messages(
        db,
        session_no = session_no,
        user_no    = int(current_user["sub"]),
    )
    return {"success": True, "data": {"session": session}}


@router.delete("/sessions/{session_no}", summary="세션 삭제 (메시지 포함)")
async def delete_session(
    session_no:   int,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_chat_db),
):
    await svc.delete_session(db, session_no, user_no=int(current_user["sub"]))
    return {"success": True, "message": "대화 세션이 삭제되었습니다."}


# ════════════════════════════════════════════════════════════════════════════
# 채팅
# ════════════════════════════════════════════════════════════════════════════

@router.post("", summary="AI 챗봇 질문 (단일 응답)")
async def chat(
    body:         ChatRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_chat_db),
):
    """
    Request body:
    ```json
    {
        "message":    "오늘 가장 위험한 지역 알려줘",
        "session_no": 1   // 생략 시 새 세션 자동 생성
    }
    ```
    """
    result = await svc.chat(
        db,
        user_no    = int(current_user["sub"]),
        message    = body.message,
        session_no = body.session_no,
    )
    return {"success": True, "data": result}


@router.get(
    "/stream",
    summary="AI 챗봇 스트리밍 (SSE)",
    description="""
Server-Sent Events 방식으로 Claude 응답을 실시간 토큰 단위로 전송합니다.

**프론트엔드 사용 예시 (React):**
```javascript
const response = await fetch('/chat/stream?message=안녕&session_no=1', {
  headers: { Authorization: `Bearer ${token}` }
});
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\\n\\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === 'token')   appendToken(event.content);
    if (event.type === 'done')    finalize(event.content);
    if (event.type === 'session') setSessionNo(event.session_no);
  }
}
```

**SSE 이벤트 포맷:**
- `{"type": "session",  "session_no": 1}`          세션 번호 (첫 이벤트)
- `{"type": "token",    "content": "안녕"}`         토큰 단위 응답
- `{"type": "done",     "content": "전체 응답"}`    스트리밍 완료
- `{"type": "error",    "message": "오류 내용"}`    오류 발생 시
    """,
    response_class=StreamingResponse,
)
async def stream_chat(
    message:      str           = Query(..., description="사용자 입력 메시지"),
    session_no:   Optional[int] = Query(default=None, description="세션 번호 (없으면 새 세션)"),
    current_user: dict          = Depends(get_current_user),
    db=Depends(get_chat_db),
):
    return StreamingResponse(
        svc.stream_chat(
            db,
            user_no    = int(current_user["sub"]),
            message    = message,
            session_no = session_no,
        ),
        media_type = "text/event-stream",
        headers    = {
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # nginx 버퍼링 비활성화
        },
    )
