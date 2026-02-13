"""
Pacote de persistência do bot.
Uso: storage = get_storage() (lê BOT_STORAGE=local|supabase) ou storage = LocalStorage() / SupabaseStorage()
"""
import os

from .base import StorageBase
from .local_storage import LocalStorage
from .supabase_storage import SupabaseStorage
from .user_storage import UserStorage


def get_storage() -> StorageBase:
    """Retorna implementação de persistência conforme BOT_STORAGE (local|supabase)."""
    backend = (os.environ.get("BOT_STORAGE") or "local").strip().lower()
    if backend == "supabase":
        return SupabaseStorage()
    return LocalStorage()


__all__ = ["StorageBase", "LocalStorage", "SupabaseStorage", "UserStorage", "get_storage"]
