"""Cliente Supabase (service role) para uso no backend."""
from supabase import create_client
from backend.app.config import get_settings


def get_supabase():
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios")
    return create_client(s.supabase_url, s.supabase_service_key)
