"""
Rotas de autenticação.
O login/cadastro é feito pelo frontend via Supabase Auth (client-side).
Estas rotas servem para: health check e, no futuro, refresh ou dados do usuário.
"""
from fastapi import APIRouter, Depends
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    """Retorna dados do usuário logado (id e email do Supabase/public.users)."""
    supabase = get_supabase()
    r = supabase.table("users").select("id, email, subscription_status, subscription_tier, created_at").eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"id": user_id, "email": None}
    row = r.data[0]
    return {
        "id": row["id"],
        "email": row.get("email"),
        "subscription_status": row.get("subscription_status"),
        "subscription_tier": row.get("subscription_tier"),
        "created_at": row.get("created_at"),
    }


@router.get("/health")
def health():
    """Health check (público)."""
    return {"status": "ok"}
