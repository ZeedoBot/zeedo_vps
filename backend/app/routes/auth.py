"""
Rotas de autenticação.
O login pode ser feito com email ou username.
"""
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email_or_username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


@router.post("/login")
def login_with_email_or_username(body: LoginBody):
    """Login com email ou username. Retorna access_token e refresh_token para o frontend usar com setSession."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(500, "Servidor não configurado")

    raw = body.email_or_username.strip()
    password = body.password

    if "@" in raw:
        email = raw.lower()
    else:
        supabase = get_supabase()
        r = supabase.table("users").select("email").ilike("username", raw).limit(1).execute()
        if not r.data or len(r.data) == 0:
            raise HTTPException(401, "Nome de usuário ou senha incorretos.")
        email = r.data[0].get("email")
        if not email:
            raise HTTPException(401, "Nome de usuário ou senha incorretos.")

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        json={"email": email, "password": password},
        headers={
            "apikey": settings.supabase_service_key,
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(401, "E-mail (ou nome de usuário) ou senha incorretos.")
    data = resp.json()
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }


@router.get("/me")
def get_me(user_id: str = Depends(get_current_user_id)):
    """Retorna dados do usuário logado (id, email, username do public.users)."""
    supabase = get_supabase()
    r = supabase.table("users").select("id, email, username, subscription_status, subscription_tier, created_at").eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        return {"id": user_id, "email": None, "username": None}
    row = r.data[0]
    return {
        "id": row["id"],
        "email": row.get("email"),
        "username": row.get("username"),
        "subscription_status": row.get("subscription_status"),
        "subscription_tier": row.get("subscription_tier"),
        "created_at": row.get("created_at"),
    }


@router.get("/health")
def health():
    """Health check (público)."""
    return {"status": "ok"}
