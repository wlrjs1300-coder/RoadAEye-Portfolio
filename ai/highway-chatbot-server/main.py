# ============================================================
# 파일 위치: highway-chatbot-server/main.py
# 역할: 브라우저의 질문을 받아 (1) 대화를 MySQL DB에 저장하고
#       (2) OpenAI에 전달해 SSE 스트리밍으로 답변을 돌려주는 AI 서버
# ============================================================

from dotenv import load_dotenv
load_dotenv()

import os
import json
from typing import Optional, Generator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
import pymysql

app = FastAPI()

# --- CORS ---
# CORS_ORIGIN 환경변수 또는 기본값(http://localhost:3000) 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:3000"),
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OpenAI 클라이언트 ---
client = OpenAI()

# --- DB 연결 ---
def get_db():
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

# --- 시스템 프롬프트 ---
# OO고속도로, 고객센터 번호, 자주 묻는 정보 등은 실제 내용으로 바꾸세요.
SYSTEM_PROMPT = """당신은 'ROAD A EYE' 고속도로 안전 관제 플랫폼의 AI 어시스턴트입니다.
- 고속도로 안전, CCTV 관제, 위험 객체 탐지와 관련된 질문에 친절하고 간결하게 답합니다.
- 확실하지 않은 내용은 추측하지 않고 담당 기관 또는 관리자 확인을 안내합니다.
- 시스템 운영과 무관한 질문은 정중히 거절합니다.

[서비스 안내]
- AI 객체 탐지: 고속도로 진입이 제한되거나 위험할 수 있는 객체를 탐지합니다.
- CCTV 관제: 연동된 CCTV 영상과 감지 결과를 관제 화면에서 확인할 수 있습니다.
- 감지 기록: 감지 결과와 관련 정보를 데이터베이스에 저장하고 조회할 수 있습니다.
"""


# ============================================================
# 키워드 검사 함수
# 질문 문장에 등록된 키워드가 포함되어 있으면 (mode, response) 반환,
# 없으면 None 반환. priority 높은 순으로 먼저 검사합니다.
# ============================================================
def find_keyword(conn, message: str):
    lowered = message.lower()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT keyword, response, mode FROM chat_keywords "
            "WHERE is_active = 1 ORDER BY priority DESC, keyword_no ASC"
        )
        for row in cur.fetchall():
            if row["keyword"].lower() in lowered:
                return row["mode"], row["response"]
    return None


# ============================================================
# SSE 스트리밍 엔드포인트 (프론트엔드 ChatBot.tsx가 사용)
# GET /chat/stream?message=...&session_no=...&user_no=...
# ============================================================
@app.get("/chat/stream")
def chat_stream(
    message: str,
    session_no: Optional[int] = None,
    user_no: int = 0,
):
    def generate() -> Generator[str, None, None]:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                s_no = session_no

                # (1) 첫 질문이면 새 세션 생성
                if s_no is None:
                    cur.execute(
                        "INSERT INTO chat_sessions (user_no) VALUES (%s)",
                        (user_no,),
                    )
                    s_no = cur.lastrowid

                # (2) 세션 번호를 가장 먼저 전송
                yield f"data: {json.dumps({'type': 'session', 'session_no': s_no})}\n\n"

                # (3) 이 세션의 이전 대화 불러오기
                cur.execute(
                    "SELECT role, content FROM chat_messages "
                    "WHERE session_no = %s ORDER BY message_no",
                    (s_no,),
                )
                history = cur.fetchall()

                # (4) 이번 질문 DB에 저장
                cur.execute(
                    "INSERT INTO chat_messages (session_no, role, content) "
                    "VALUES (%s, 'user', %s)",
                    (s_no, message),
                )

                # (5) 키워드 검사 후 분기
                hit = find_keyword(conn, message)

                if hit and hit[0] == "fixed":
                    # fixed: OpenAI 없이 정해둔 텍스트를 토큰처럼 한 번에 전송
                    full_reply = hit[1]
                    yield f"data: {json.dumps({'type': 'token', 'content': full_reply})}\n\n"
                else:
                    # reference 이거나 키워드 없음: OpenAI 스트리밍 호출
                    system_text = SYSTEM_PROMPT
                    if hit and hit[0] == "reference":
                        system_text = system_text + "\n\n[참고자료]\n" + hit[1]

                    stream = client.chat.completions.create(
                        model="gpt-4.1-mini",
                        messages=[
                            {"role": "system", "content": system_text},
                            *history,
                            {"role": "user", "content": message},
                        ],
                        stream=True,
                    )

                    # (6) 토큰 단위로 SSE 이벤트 전송
                    full_reply = ""
                    for chunk in stream:
                        delta = chunk.choices[0].delta
                        if delta.content:
                            full_reply += delta.content
                            yield f"data: {json.dumps({'type': 'token', 'content': delta.content})}\n\n"

                # (7) 완성된 답변 DB에 저장
                cur.execute(
                    "INSERT INTO chat_messages (session_no, role, content) "
                    "VALUES (%s, 'assistant', %s)",
                    (s_no, full_reply),
                )
                cur.execute(
                    "UPDATE chat_sessions SET last_message_at = NOW() "
                    "WHERE session_no = %s",
                    (s_no,),
                )
                conn.commit()

                yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            conn.rollback()
            print(e)
            yield f"data: {json.dumps({'type': 'error', 'message': '일시적인 오류가 발생했습니다.'})}\n\n"
        finally:
            conn.close()

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================================================
# 단순 JSON 엔드포인트 (필요 시 사용)
# POST /api/chat
# ============================================================
class ChatRequest(BaseModel):
    session_no: Optional[int] = None
    user_no: int = 0
    message: str


@app.post("/api/chat")
def chat(req: ChatRequest):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            session_no = req.session_no

            if session_no is None:
                cur.execute(
                    "INSERT INTO chat_sessions (user_no) VALUES (%s)",
                    (req.user_no,),
                )
                session_no = cur.lastrowid

            cur.execute(
                "SELECT role, content FROM chat_messages "
                "WHERE session_no = %s ORDER BY message_no",
                (session_no,),
            )
            history = cur.fetchall()

            cur.execute(
                "INSERT INTO chat_messages (session_no, role, content) "
                "VALUES (%s, 'user', %s)",
                (session_no, req.message),
            )

            hit = find_keyword(conn, req.message)

            if hit and hit[0] == "fixed":
                reply = hit[1]
            else:
                system_text = SYSTEM_PROMPT
                if hit and hit[0] == "reference":
                    system_text = system_text + "\n\n[참고자료]\n" + hit[1]

                completion = client.chat.completions.create(
                    model="gpt-4.1-mini",
                    messages=[
                        {"role": "system", "content": system_text},
                        *history,
                        {"role": "user", "content": req.message},
                    ],
                )
                reply = completion.choices[0].message.content

            cur.execute(
                "INSERT INTO chat_messages (session_no, role, content) "
                "VALUES (%s, 'assistant', %s)",
                (session_no, reply),
            )
            cur.execute(
                "UPDATE chat_sessions SET last_message_at = NOW() "
                "WHERE session_no = %s",
                (session_no,),
            )
            conn.commit()

            return {"session_no": session_no, "reply": reply}

    except Exception as e:
        conn.rollback()
        print(e)
        return {"error": "일시적인 오류가 발생했습니다."}
    finally:
        conn.close()
