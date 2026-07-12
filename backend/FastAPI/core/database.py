"""
core/database.py
비동기 SQLAlchemy 세션 관리 — 4개 DB 분리
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from core.config import settings


def _make_engine(url: str):
    return create_async_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False,
    )


def _make_session(engine):
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


member_engine = _make_engine(settings.MEMBER_DB_URL)
board_engine  = _make_engine(settings.BOARD_DB_URL)
ai_engine     = _make_engine(settings.AI_DB_URL)
chat_engine   = _make_engine(settings.CHAT_DB_URL)

MemberSessionLocal = _make_session(member_engine)
BoardSessionLocal  = _make_session(board_engine)
AISessionLocal     = _make_session(ai_engine)
ChatSessionLocal   = _make_session(chat_engine)


class Base(DeclarativeBase):
    pass


async def get_member_db():
    async with MemberSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_board_db():
    async with BoardSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_ai_db():
    async with AISessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_chat_db():
    async with ChatSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
