from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Road-AI API"
    debug: bool = False
    keras_model_version: str = "v1"

    its_api_key: str = ""
    its_api_base_url: str = "https://openapi.its.go.kr:9443/cctvInfo"

    ai_backend_url: str = "http://localhost:8000"
    ai_server_url: str = "http://localhost:8001"

    db_host: str = ""
    db_port: int = 3306
    db_user: str = ""
    db_password: str = ""
    db_name: str = ""

    ai_api_key: str = ""
    keras_threshold: float = 0.3

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.strip().lower() in {"release", "prod", "production"}:
            return False
        return value

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
