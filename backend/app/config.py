"""Configuração do backend (variáveis de ambiente)."""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# .env na raiz do projeto (independente do CWD ao iniciar)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""  # JWT Secret (Settings > API no Supabase)
    encryption_master_key: str = ""
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    telegram_bot_token: str = ""  # Token do bot (do .env)

    class Config:
        env_file = str(_ENV_FILE) if _ENV_FILE.exists() else ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
