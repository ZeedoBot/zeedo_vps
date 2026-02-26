"""
Rotas para reset de senha e troca de email.
Usa códigos de verificação enviados por email (Supabase Auth).
"""
import logging
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr

from backend.app.config import get_settings
from backend.app.dependencies import get_current_user_id
from backend.app.services.supabase_client import get_supabase

router = APIRouter(prefix="/account", tags=["account"])
logger = logging.getLogger(__name__)


class RequestPasswordResetBody(BaseModel):
    email: EmailStr


class ConfirmPasswordResetBody(BaseModel):
    """Supabase Auth usa token único enviado por email."""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class RequestEmailChangeBody(BaseModel):
    new_email: EmailStr
    password: str = Field(..., min_length=1)


@router.post("/request-password-reset")
def request_password_reset(body: RequestPasswordResetBody):
    """Envia email de reset de senha via Supabase Auth."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(500, "Servidor não configurado")
    
    # Supabase Auth: POST /auth/v1/recover
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/recover"
    resp = requests.post(
        url,
        json={"email": body.email},
        headers={
            "apikey": settings.supabase_service_key,
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    
    # Supabase sempre retorna 200 mesmo se o email não existir (segurança)
    if resp.status_code != 200:
        logger.error(f"Erro ao solicitar reset: {resp.status_code} {resp.text}")
        raise HTTPException(500, "Erro ao enviar email de recuperação")
    
    return {
        "success": True,
        "message": "Se o email existir, você receberá um link para redefinir sua senha.",
    }


@router.post("/change-password")
def change_password(body: ChangePasswordBody, user_id: str = Depends(get_current_user_id)):
    """Troca a senha do usuário autenticado (requer senha atual)."""
    settings = get_settings()
    supabase = get_supabase()
    
    # Busca email do usuário
    r = supabase.table("users").select("email").eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(404, "Usuário não encontrado")
    
    email = r.data[0].get("email")
    if not email:
        raise HTTPException(400, "Email não cadastrado")
    
    # Valida senha atual fazendo login
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        json={"email": email, "password": body.current_password},
        headers={
            "apikey": settings.supabase_service_key,
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    
    if resp.status_code != 200:
        raise HTTPException(401, "Senha atual incorreta")
    
    # Atualiza senha via Admin API
    admin_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    admin_resp = requests.put(
        admin_url,
        json={"password": body.new_password},
        headers={
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    
    if admin_resp.status_code not in (200, 201):
        logger.error(f"Erro ao atualizar senha: {admin_resp.status_code} {admin_resp.text}")
        raise HTTPException(500, "Erro ao atualizar senha")
    
    return {"success": True, "message": "Senha alterada com sucesso"}


@router.post("/request-email-change")
def request_email_change(body: RequestEmailChangeBody, user_id: str = Depends(get_current_user_id)):
    """Solicita troca de email (requer senha atual). Envia código de confirmação para o novo email."""
    settings = get_settings()
    supabase = get_supabase()
    
    # Busca email atual
    r = supabase.table("users").select("email").eq("id", user_id).limit(1).execute()
    if not r.data or len(r.data) == 0:
        raise HTTPException(404, "Usuário não encontrado")
    
    current_email = r.data[0].get("email")
    if not current_email:
        raise HTTPException(400, "Email não cadastrado")
    
    # Valida senha
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        json={"email": current_email, "password": body.password},
        headers={
            "apikey": settings.supabase_service_key,
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    
    if resp.status_code != 200:
        raise HTTPException(401, "Senha incorreta")
    
    # Atualiza email via Admin API (Supabase envia email de confirmação automaticamente)
    admin_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    admin_resp = requests.put(
        admin_url,
        json={"email": body.new_email},
        headers={
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    
    if admin_resp.status_code not in (200, 201):
        logger.error(f"Erro ao solicitar troca de email: {admin_resp.status_code} {admin_resp.text}")
        raise HTTPException(500, "Erro ao solicitar troca de email")
    
    return {
        "success": True,
        "message": f"Um link de confirmação foi enviado para {body.new_email}. Clique no link para confirmar a troca.",
    }
