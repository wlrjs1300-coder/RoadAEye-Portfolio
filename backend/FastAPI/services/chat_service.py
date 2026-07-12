"""
services/chat_service.py
AI 챗봇 비즈니스 로직

흐름:
  1. 세션 조회 또는 신규 생성
  2. 해당 세션의 이전 메시지 전체를 history로 로드
  3. 사용자 메시지 DB 저장
  4. history + 새 메시지를 Claude API에 전달
  5. Claude 응답 DB 저장
  6. 세션 last_message_at 갱신
  7. 응답 반환

스트리밍 흐름 (stream_chat):
  4~5번 대신 SSE(Server-Sent Events)로 토큰을 실시간 전송,
  스트리밍 완료 후 전체 응답을 DB에 저장
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import openai
from fastapi import HTTPException, status
from sqlalchemy import select, text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from models.chat_orm import ChatSession, ChatMessage, MessageRole

# ── OpenAI API 클라이언트 ─────────────────────────────────────────────────────
_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ── 챗봇 시스템 프롬프트 ──────────────────────────────────────────────────────
_SYSTEM_PROMPT = """
당신은 Road A Eye 고속도로 CCTV AI 관제 시스템의 전문 AI 어시스턴트입니다.

담당 업무:
- 고속도로 CCTV 감지 기록 분석 및 설명
- 위험 차량(킥보드, 오토바이, 건설차량, 역주행 차량 등) 감지 현황 안내
- 위험도 지도(HeatMap) 해석 및 위험 지역 안내
- 반복 출현 차량 패턴 분석
- CCTV 운영 현황 및 시스템 상태 안내
- 관제 업무 관련 질문 응대

응답 규칙:
- 한국어로 명확하고 간결하게 답변하세요.
- 모르는 감지 데이터는 추측하지 말고 "시스템에서 직접 확인이 필요합니다"라고 안내하세요.
- 관제 시스템과 무관한 질문은 정중히 거절하세요.
""".strip()

# 세션당 최대 불러올 이전 메시지 수 (토큰 절약)
_MAX_HISTORY = 20


async def _find_keyword_response(db: AsyncSession, message: str) -> Optional[str]:
    """chat_keywords 테이블에서 사용자 입력에 매칭되는 고정 답변을 찾는다.

    priority가 높은 키워드를 우선하고, 같은 priority라면 더 긴 키워드를 먼저 본다.
    mode가 exact이면 전체 문장 일치, 그 외에는 포함 여부로 판단한다.
    """
    normalized_message = _normalize_keyword_text(message)
    if not normalized_message:
        return None

    result = await db.execute(sql_text(
        """
        SELECT keyword, response, mode
        FROM chat_keywords
        WHERE is_active = 1
        ORDER BY priority DESC, CHAR_LENGTH(keyword) DESC, keyword_no ASC
        """
    ))

    for row in result.mappings().all():
        raw_keyword = str(row.get("keyword") or "").strip()
        response = str(row.get("response") or "").strip()
        mode = str(row.get("mode") or "contains").lower()
        if not raw_keyword or not response:
            continue

        keywords = [part.strip() for part in raw_keyword.replace("|", ",").split(",") if part.strip()]
        for keyword in keywords:
            normalized_keyword = _normalize_keyword_text(keyword)
            if not normalized_keyword:
                continue
            if mode == "exact" and normalized_message == normalized_keyword:
                return response
            if mode != "exact" and normalized_keyword in normalized_message:
                return response

    return None


def _normalize_keyword_text(value: str) -> str:
    return "".join(str(value or "").casefold().split())


async def _save_assistant_answer(db: AsyncSession, session: ChatSession, answer: str) -> datetime:
    now = datetime.now(timezone.utc)
    db.add(ChatMessage(
        session_no = session.session_no,
        role       = MessageRole.ASSISTANT,
        content    = answer,
        created_at = now,
    ))
    session.last_message_at = now
    await db.commit()
    return now


# ════════════════════════════════════════════════════════════════════════════
# 세션 관리
# ════════════════════════════════════════════════════════════════════════════
async def get_sessions(db: AsyncSession, user_no: int) -> list[dict]:
    """사용자의 전체 세션 목록 (최신순, 마지막 메시지 미리보기 포함)"""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_no == user_no)
        .order_by(ChatSession.last_message_at.desc().nullslast())
    )
    sessions = result.scalars().all()

    output = []
    for s in sessions:
        # 마지막 user 메시지를 미리보기로 사용
        last_user_msg = next(
            (m.content for m in reversed(s.messages) if m.role == MessageRole.USER),
            None,
        )
        output.append({
            "session_no":      s.session_no,
            "user_no":         s.user_no,
            "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
            "created_at":      s.created_at.isoformat(),
            "preview":         last_user_msg[:50] + "..." if last_user_msg and len(last_user_msg) > 50
                               else last_user_msg,
        })
    return output


async def get_session_with_messages(
    db: AsyncSession, session_no: int, user_no: int
) -> dict:
    """세션 단일 조회 + 전체 메시지"""
    session = await _get_session(db, session_no, user_no)
    return _session_dict(session)


async def delete_session(db: AsyncSession, session_no: int, user_no: int) -> None:
    session = await _get_session(db, session_no, user_no)
    await db.delete(session)
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════
# 일반 채팅 (단일 응답)
# ════════════════════════════════════════════════════════════════════════════
async def chat(
    db:         AsyncSession,
    user_no:    int,
    message:    str,
    session_no: Optional[int] = None,
) -> dict:
    """
    사용자 메시지를 받아 Claude 응답을 반환.

    Returns:
        {"session_no", "answer", "created_at"}
    """
    # 1. 세션 확보
    session = await _get_or_create_session(db, user_no, session_no)

    # 2. 사용자 메시지 저장
    user_msg = ChatMessage(
        session_no = session.session_no,
        role       = MessageRole.USER,
        content    = message,
    )
    db.add(user_msg)
    await db.flush()

    # 3. DB 키워드 고정 답변 우선 적용
    keyword_answer = await _find_keyword_response(db, message)
    if keyword_answer:
        now = await _save_assistant_answer(db, session, keyword_answer)
        return {
            "session_no": session.session_no,
            "answer":     keyword_answer,
            "created_at": now.isoformat(),
            "source":     "keyword",
        }

    # 4. 이전 대화 히스토리 로드 후 OpenAI API 호출
    history = await _load_history(db, session.session_no)
    api_messages = [{"role": "system", "content": _SYSTEM_PROMPT}] + history + [{"role": "user", "content": message}]
    try:
        response = await _client.chat.completions.create(
            model      = settings.OPENAI_MODEL,
            max_tokens = 1024,
            messages   = api_messages,
        )
        answer = response.choices[0].message.content
    except openai.APIError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"OpenAI API 오류: {str(e)}")

    # 5. AI 응답 저장
    now = await _save_assistant_answer(db, session, answer)

    return {
        "session_no": session.session_no,
        "answer":     answer,
        "created_at": now.isoformat(),
        "source":     "openai",
    }


# ════════════════════════════════════════════════════════════════════════════
# 스트리밍 채팅 (SSE)
# ════════════════════════════════════════════════════════════════════════════
async def stream_chat(
    db:         AsyncSession,
    user_no:    int,
    message:    str,
    session_no: Optional[int] = None,
) -> AsyncGenerator[str, None]:
    """
    SSE(Server-Sent Events) 스트리밍 응답 제너레이터.

    FastAPI에서:
        return StreamingResponse(
            stream_chat(db, user_no, message, session_no),
            media_type="text/event-stream"
        )

    프론트엔드에서:
        const es = new EventSource("/chat/stream?...");
        es.onmessage = (e) => { ... }

    이벤트 포맷:
        data: {"type": "session",  "session_no": 1}
        data: {"type": "token",    "content": "안녕"}
        data: {"type": "done",     "content": "전체 응답"}
        data: {"type": "error",    "message": "오류 내용"}
    """
    import json

    # 1. 세션 확보
    session = await _get_or_create_session(db, user_no, session_no)

    # 세션 번호 먼저 전송 (프론트에서 세션 추적용)
    yield f"data: {json.dumps({'type': 'session', 'session_no': session.session_no}, ensure_ascii=False)}\n\n"

    # 2. 사용자 메시지 저장
    user_msg = ChatMessage(
        session_no = session.session_no,
        role       = MessageRole.USER,
        content    = message,
    )
    db.add(user_msg)
    await db.flush()

    # 3. DB 키워드 고정 답변 우선 적용
    keyword_answer = await _find_keyword_response(db, message)
    if keyword_answer:
        now = await _save_assistant_answer(db, session, keyword_answer)
        yield f"data: {json.dumps({'type': 'token', 'content': keyword_answer}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'content': keyword_answer, 'source': 'keyword', 'created_at': now.isoformat()}, ensure_ascii=False)}\n\n"
        return

    # 4. 히스토리 로드 후 OpenAI API 스트리밍 호출
    history = await _load_history(db, session.session_no)
    api_messages = [{"role": "system", "content": _SYSTEM_PROMPT}] + history + [{"role": "user", "content": message}]
    full_answer  = ""

    try:
        stream = await _client.chat.completions.create(
            model      = settings.OPENAI_MODEL,
            max_tokens = 1024,
            messages   = api_messages,
            stream     = True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"

    except openai.APIError as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        return

    # 5. 완료된 전체 응답 저장
    now = await _save_assistant_answer(db, session, full_answer)

    # 6. 완료 이벤트
    yield f"data: {json.dumps({'type': 'done', 'content': full_answer, 'source': 'openai', 'created_at': now.isoformat()}, ensure_ascii=False)}\n\n"


# ════════════════════════════════════════════════════════════════════════════
# 내부 헬퍼
# ════════════════════════════════════════════════════════════════════════════
async def _get_or_create_session(
    db: AsyncSession, user_no: int, session_no: Optional[int]
) -> ChatSession:
    """session_no가 주어지면 기존 세션 반환, 없으면 새 세션 생성"""
    if session_no:
        return await _get_session(db, session_no, user_no)

    session = ChatSession(user_no=user_no)
    db.add(session)
    await db.flush()
    return session


async def _get_session(
    db: AsyncSession, session_no: int, user_no: int
) -> ChatSession:
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(
            ChatSession.session_no == session_no,
            ChatSession.user_no    == user_no,     # 본인 세션만 접근 가능
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "세션을 찾을 수 없습니다.")
    return session


async def _load_history(db: AsyncSession, session_no: int) -> list[dict]:
    """Claude API messages 형식으로 이전 대화 반환 (최근 N개)"""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_no == session_no)
        .order_by(ChatMessage.created_at.desc())
        .limit(_MAX_HISTORY)
    )
    messages = result.scalars().all()
    # 시간 오름차순으로 재정렬
    messages = list(reversed(messages))
    return [{"role": m.role.value.lower(), "content": m.content} for m in messages]


def _session_dict(s: ChatSession) -> dict:
    return {
        "session_no":      s.session_no,
        "user_no":         s.user_no,
        "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
        "created_at":      s.created_at.isoformat(),
        "messages": [
            {
                "message_no": m.message_no,
                "session_no": m.session_no,
                "role":       m.role.value.lower(),
                "content":    m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in s.messages
        ],
    }
