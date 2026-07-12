"""
core/config.py
환경변수 설정 (Pydantic Settings)
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    # member_db (VIP: localhost → 247 백엔드서버 / 장애시 249 DB서버)
    DB_MEMBER_HOST:     str = "localhost"
    DB_MEMBER_PORT:     int = 3306
    DB_MEMBER_NAME:     str = "member_db"
    DB_MEMBER_USER:     str = "member_user"
    DB_MEMBER_PASSWORD: str = ""

    # board_db (VIP: localhost)
    DB_BOARD_HOST:     str = "localhost"
    DB_BOARD_PORT:     int = 3306
    DB_BOARD_NAME:     str = "board_db"
    DB_BOARD_USER:     str = "board_user"
    DB_BOARD_PASSWORD: str = ""

    # ai_db (VIP: localhost → 246 AI서버 / 장애시 249 DB서버)
    DB_AI_HOST:     str = "localhost"
    DB_AI_PORT:     int = 3306
    DB_AI_NAME:     str = "ai_db"
    DB_AI_USER:     str = "ai_user"
    DB_AI_PASSWORD: str = ""

    # chat_db (VIP: localhost)
    DB_CHAT_HOST:     str = "localhost"
    DB_CHAT_PORT:     int = 3306
    DB_CHAT_NAME:     str = "chat_db"
    DB_CHAT_USER:     str = "chat_user"
    DB_CHAT_PASSWORD: str = ""

    # JWT
    JWT_SECRET_KEY:            str = "change-me"
    JWT_ALGORITHM:             str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_EXPIRE_DAYS:   int = 7

    # Mail
    MAIL_USERNAME: str  = ""
    MAIL_PASSWORD: str  = ""
    MAIL_FROM:     str  = ""
    MAIL_SERVER:   str  = "smtp.gmail.com"
    MAIL_PORT:     int  = 587
    MAIL_TLS:      bool = True
    MAIL_SSL:      bool = False

    # 인증 코드 만료
    EMAIL_CODE_EXPIRE_MINUTES: int = 10

    # ITS API
    ITS_API_KEY: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL:   str = "gpt-4o"

    # 소셜 로그인
    NAVER_CLIENT_ID:     str = ""
    NAVER_CLIENT_SECRET: str = ""
    NAVER_REDIRECT_URI:  str = "http://localhost:8000/auth/naver/callback"
    KAKAO_REST_API_KEY:    str = ""
    KAKAO_CLIENT_SECRET:   str = ""
    KAKAO_REDIRECT_URI:    str = "http://localhost:8000/auth/kakao/callback"
    GOOGLE_CLIENT_ID:     str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI:  str = "http://localhost:8000/auth/google/callback"

    # 관리자 초기 계정 (.env에서 관리)
    ADMIN_LOGIN_ID: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_EMAIL:    str = ""
    ADMIN_NAME:     str = ""

    # 이미지
    IMAGE_SAVE_DIR: str = "./captures"
    IMAGE_BASE_URL: str = "http://localhost:8000/images"

    # AI 서버 주소
    AI_SERVER_URL: str = "http://localhost:8001"
    AI_API_KEY:    str = ""

    # 프론트엔드 주소 (CORS)
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    # 소셜 로그인 완료 후 프론트 리다이렉트 URL
    FRONTEND_AUTH_CALLBACK_URL: str = "http://localhost:3000/auth/callback"

    @property
    def MEMBER_DB_URL(self) -> str:
        return (f"mysql+aiomysql://{self.DB_MEMBER_USER}:{self.DB_MEMBER_PASSWORD}"
                f"@{self.DB_MEMBER_HOST}:{self.DB_MEMBER_PORT}/{self.DB_MEMBER_NAME}?charset=utf8mb4")

    @property
    def BOARD_DB_URL(self) -> str:
        return (f"mysql+aiomysql://{self.DB_BOARD_USER}:{self.DB_BOARD_PASSWORD}"
                f"@{self.DB_BOARD_HOST}:{self.DB_BOARD_PORT}/{self.DB_BOARD_NAME}?charset=utf8mb4")

    @property
    def AI_DB_URL(self) -> str:
        return (f"mysql+aiomysql://{self.DB_AI_USER}:{self.DB_AI_PASSWORD}"
                f"@{self.DB_AI_HOST}:{self.DB_AI_PORT}/{self.DB_AI_NAME}?charset=utf8mb4")

    @property
    def CHAT_DB_URL(self) -> str:
        return (f"mysql+aiomysql://{self.DB_CHAT_USER}:{self.DB_CHAT_PASSWORD}"
                f"@{self.DB_CHAT_HOST}:{self.DB_CHAT_PORT}/{self.DB_CHAT_NAME}?charset=utf8mb4")


settings = Settings()