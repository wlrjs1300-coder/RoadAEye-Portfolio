"""
services/ws_service.py
WebSocket 연결 관리 — 실시간 감지 알림용
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """연결된 WebSocket 클라이언트 목록 관리"""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        logger.info("WS 연결 (+%d)", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.remove(ws)
        logger.info("WS 해제 (-%d)", len(self._connections))

    async def broadcast(self, data: dict[str, Any]) -> None:
        """연결된 모든 클라이언트에 JSON 전송, 끊긴 소켓은 자동 제거"""
        dead: list[WebSocket] = []
        message = json.dumps(data, ensure_ascii=False)
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)


ws_manager = ConnectionManager()
